import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

// Small delay helper
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Detect if running on Render
const isRender = process.env.RENDER === "true";

console.log("🔧 Environment:", isRender ? "RENDER" : "LOCAL");

// Retry waiting for job cards to appear
async function waitForJobCards(page, retries = 5, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    const exists = await page.$(
      ".job_seen_beacon, .cardOutline, div[data-jk], .jobsearch-ResultsList > li"
    );
    if (exists) return true;
    await wait(delay);
  }
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
      ".job_seen_beacon, .cardOutline, div[data-jk], .jobsearch-ResultsList > li",
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

// Main function
export async function fetchIndeedJobs(keyword) {
  let browser;
  try {
    // Configure browser options based on environment
    let launchOptions;

    if (isRender) {
      // Get the executable path
      const executablePath = await chromium.executablePath();
      console.log("📍 Chrome executable path:", executablePath);

      launchOptions = {
        executablePath: executablePath,
        headless: chromium.headless,
        args: [
          ...chromium.args,
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-software-rasterizer",
          "--disable-dev-tools",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
          "--disable-extensions",
          "--disable-features=IsolateOrigins,site-per-process",
        ],
        defaultViewport: chromium.defaultViewport,
        ignoreHTTPSErrors: true,
      };
    } else {
      // Local development
      launchOptions = {
        executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        headless: false,
        args: [],
      };
    }

    console.log("🚀 Launching browser...");
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    // Set a realistic user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    );

    // Set extra headers
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    });

    const url = `https://il.indeed.com/q-${encodeURIComponent(
      keyword
    )}-jobs.html?from=relatedQueries&saIdx=3&rqf=1`;
    console.log("🔎 Navigating to:", url);

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    console.log("⏳ Waiting for the page to fully load...");
    await wait(5000);

    const jobs = await scrollAndCollectAllJobs(page, 200);

    console.log(`✅ Total jobs collected: ${jobs.length}`);
    return jobs;
  } catch (err) {
    console.error("❌ Error fetching Indeed jobs:", err);
    console.error("Stack trace:", err.stack);
    return [];
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log("🔒 Browser closed");
      } catch (closeErr) {
        console.error("⚠️ Error closing browser:", closeErr);
      }
    }
  }
}