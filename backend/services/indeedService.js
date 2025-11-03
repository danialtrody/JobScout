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

// 🆕 Fetch free proxies
async function getFreeProxies() {
  try {
    console.log("🔄 Fetching free proxies...");
    const response = await fetch(
      "https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all"
    );
    const text = await response.text();
    const proxies = text.split("\n").filter((p) => p.trim());
    console.log(`✅ Found ${proxies.length} proxies`);
    return proxies;
  } catch (err) {
    console.error("❌ Failed to fetch proxies:", err.message);
    return [];
  }
}

// 🆕 Test if a proxy works
async function testProxy(proxy) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch("https://www.google.com", {
      signal: controller.signal,
      method: "HEAD",
    });
    
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

// 🆕 Get a working proxy
async function getWorkingProxy() {
  const proxies = await getFreeProxies();
  
  if (proxies.length === 0) {
    console.log("⚠️ No proxies available, continuing without proxy");
    return null;
  }

  // Test first 5 proxies
  for (let i = 0; i < Math.min(5, proxies.length); i++) {
    const proxy = proxies[i];
    console.log(`🧪 Testing proxy ${i + 1}: ${proxy}`);
    
    const works = await testProxy(proxy);
    if (works) {
      console.log(`✅ Proxy works: ${proxy}`);
      return proxy;
    }
  }

  console.log("⚠️ No working proxy found, continuing without proxy");
  return null;
}

// ✅ Improved job card detection
async function waitForJobCards(page, retries = 10, delay = 3000) {
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
    document.body.innerText.slice(0, 400)
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
      await wait(2000);
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
    console.log(isRender ? "🟢 Running on Render — setting up Chromium..." : "💻 Running locally...");

    // 🆕 Get working proxy only on Render
    const proxy = isRender ? await getWorkingProxy() : null;

    const { browser: br, page } = await connect({
      headless: isRender,
      args: isRender
        ? [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-features=IsolateOrigins",
            "--disable-site-isolation-trials",
            ...(proxy ? [`--proxy-server=${proxy}`] : []), // 🆕 Add proxy if available
          ]
        : [],
      turnstile: true,
    });

    browser = br;

    if (proxy) {
      console.log(`🔐 Using proxy: ${proxy}`);
    }

    const url = `https://il.indeed.com/q-${encodeURIComponent(
      keyword
    )}-jobs.html?from=relatedQueries&saIdx=3&rqf=1`;

    console.log("🔎 Navigating to:", url);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    console.log("⏳ Waiting for the page to fully load before scrolling...");
    await wait(10000);

    const jobs = await scrollAndCollectAllJobs(page, 200);

    console.log("🧹 Closing browser...");
    await browser.close();

    console.log(`✅ Total jobs collected: ${jobs.length}`);
    return jobs;
  } catch (err) {
    console.error("❌ Error fetching Indeed jobs:", err);
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    return [];
  }
}