import { connect } from "puppeteer-real-browser";
import chromium from "@sparticuz/chromium";

// Small delay helper
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Detect if running on Render
const isRender = process.env.RENDER === "true";

// Set CHROME_PATH for Render or fallback to local Chrome
if (isRender) {
  process.env.CHROME_PATH = await chromium.executablePath();
  console.log("✅ CHROME_PATH set to:", process.env.CHROME_PATH);
} else if (!process.env.CHROME_PATH) {
  process.env.CHROME_PATH =
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
}

// 🆕 Random user agents to rotate
const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
];

// 🆕 Get random user agent
function getRandomUserAgent() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// ✅ Improved job card detection
async function waitForJobCards(page, retries = 15, delay = 4000) {
  for (let i = 0; i < retries; i++) {
    const exists = await page.$(
      ".job_seen_beacon, .cardOutline, div[data-jk], .jobsearch-ResultsList li, .jobCard_mainContent"
    );
    if (exists) return true;

    console.log(`⏳ Waiting for job cards... attempt ${i + 1}/${retries}`);
    await wait(delay);
  }

  // Debug what's actually rendered on page before giving up
  const htmlSnippet = await page.evaluate(() =>
    document.body.innerText.slice(0, 500)
  );
  console.log("❌ Still no job cards found. HTML preview:", htmlSnippet);
  return false;
}

// Scroll and collect all jobs
async function scrollAndCollectAllJobs(page, maxJobs = 100) {
  console.log("🖱️ Starting to scroll and collect jobs...");

  const allJobs = new Map();
  const experienceKeywords = [
    "junior",
    "intern",
    "internship",
    "no experience",
    "entry level",
    "graduate",
    "trainee",
    "associate",
    "new grad",
    "apprentice",
    "fresh graduate",
    "recent graduate",
    "recent grad",
    "beginner",
    "starter",
    "novice",
    "first job",
    "early career",
    "graduate trainee",
    "graduate program",
    "cadet",
    "probationary",
    "junior developer",
    "junior engineer",
  ];

  let currentPage = 0;
  const maxPages = 10;

  while (currentPage < maxPages && allJobs.size < maxJobs) {
    const cardsExist = await waitForJobCards(page);
    if (!cardsExist) {
      console.log("❌ Job cards did not appear, stopping.");
      break;
    }

    const currentJobs = await page.$$eval(
      ".job_seen_beacon, .cardOutline, div[data-jk], .jobsearch-ResultsList > li, .jobCard_mainContent",
      (cards, experienceKeywords) => {
        const results = [];
        cards.forEach((card) => {
          const titleEl =
            card.querySelector("h2.jobTitle a, h2.jobTitle span[title], .jobTitle a");
          const title =
            titleEl?.innerText?.trim() || titleEl?.getAttribute("title")?.trim();

          const company =
            card.querySelector("[data-testid='company-name'], .companyName")
              ?.innerText.trim() || "N/A";

          const location =
            card.querySelector("[data-testid='text-location'], .companyLocation")
              ?.innerText.trim() || "N/A";

          const linkEl = card.querySelector("h2.jobTitle a, .jcs-JobTitle");
          const jobId = card.getAttribute("data-jk") || linkEl?.getAttribute("data-jk");
          const link = jobId
            ? `https://www.indeed.com/viewjob?jk=${jobId}`
            : linkEl?.href;

          if (title && company && link) {
            const lowerTitle = title.toLowerCase();
            const isRelevant = experienceKeywords.some((word) =>
              lowerTitle.includes(word)
            );
            if (!isRelevant) return;
            results.push({ title, company, location, link, source: "Indeed" });
          }
        });
        return results;
      },
      experienceKeywords
    );

    const jobsBeforeAdd = allJobs.size;
    currentJobs.forEach((job) => {
      if (!allJobs.has(job.link) && allJobs.size < maxJobs) {
        allJobs.set(job.link, job);
      }
    });

    console.log(
      `✨ Jobs added: ${allJobs.size - jobsBeforeAdd}, Total unique jobs: ${allJobs.size}`
    );

    if (allJobs.size >= maxJobs) break;

    const nextButton = await page.$(
      'a[data-testid="pagination-page-next"], a[aria-label="Next Page"]'
    );
    if (!nextButton) break;

    try {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }),
        nextButton.click(),
      ]);
      currentPage++;
      await wait(3000); // Longer delay between pages
    } catch {
      break;
    }
  }

  console.log("🎉 Finished collecting jobs!");
  return Array.from(allJobs.values());
}

export async function fetchIndeedJobs(keyword) {
  let browser;
  try {
    console.log(isRender ? "🟢 Running on Render — setting up Chromium with Stealth Mode..." : "💻 Running locally...");

    const userAgent = getRandomUserAgent();
    console.log("🎭 Using User-Agent:", userAgent.substring(0, 50) + "...");

    // 🆕 Enhanced stealth configuration
    const { browser: br, page } = await connect({
      headless: isRender ? "new" : false, // Use new headless mode (better for stealth)
      args: isRender
        ? [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--window-size=1920,1080",
            "--disable-blink-features=AutomationControlled", // Hide automation
            "--disable-features=IsolateOrigins,site-per-process",
            `--user-agent=${userAgent}`,
            "--lang=en-US,en;q=0.9",
            "--disable-web-security",
            "--disable-features=VizDisplayCompositor",
          ]
        : [],
      turnstile: true,
      customConfig: {}, // Enables puppeteer-real-browser's anti-detection
    });

    browser = br;

    // 🆕 Additional stealth injections
    await page.evaluateOnNewDocument(() => {
      // Hide webdriver property
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });

      // Mock chrome object
      window.chrome = {
        runtime: {},
      };

      // Mock permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) =>
        parameters.name === "notifications"
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters);

      // Mock plugins
      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3, 4, 5],
      });

      // Mock languages
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en"],
      });
    });

    // 🆕 Set additional headers
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1",
    });

    // 🆕 Try different Indeed URL formats
    const urls = [
      `https://il.indeed.com/jobs?q=${encodeURIComponent(keyword)}&l=Israel`, // Simpler format
      `https://il.indeed.com/q-${encodeURIComponent(keyword)}-jobs.html`,
    ];

    let success = false;
    for (const url of urls) {
      try {
        console.log("🔎 Navigating to:", url);
        await page.goto(url, { 
          waitUntil: "networkidle2", 
          timeout: 60000 
        });

        // 🆕 Random human-like delay
        const randomDelay = Math.floor(Math.random() * 5000) + 10000; // 10-15 seconds
        console.log(`⏳ Waiting ${randomDelay / 1000}s for page to load (human-like behavior)...`);
        await wait(randomDelay);

        // Check if we got blocked
        const bodyText = await page.evaluate(() => document.body.innerText);
        if (bodyText.includes("Request Blocked") || bodyText.includes("Ray ID")) {
          console.log("❌ Still blocked on this URL, trying next...");
          continue;
        }

        success = true;
        break;
      } catch (err) {
        console.log(`❌ Failed with URL: ${url}`, err.message);
      }
    }

    if (!success) {
      throw new Error("All URL formats failed - site is blocking requests");
    }

    const jobs = await scrollAndCollectAllJobs(page, 200);

    console.log("🧹 Closing browser...");
    await browser.close();

    console.log(`✅ Total jobs collected: ${jobs.length}`);
    return jobs;
  } catch (err) {
    console.error("❌ Error fetching Indeed jobs:", err.message);
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    return [];
  }
}