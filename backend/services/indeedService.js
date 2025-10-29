import { connect } from "puppeteer-real-browser";
import chromium from "@sparticuz/chromium";

// Small delay helper
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const isRender = !!process.env.RENDER;

// ✅ Properly set CHROME_PATH for Render (no top-level await)
async function ensureChromePath() {
  console.log("🔧 Ensuring Chrome path...");
  if (isRender) {
    const chromePath = await chromium.executablePath();
    process.env.CHROME_PATH = chromePath;
    console.log("✅ Chrome path set for Render:", chromePath);
  } else if (!process.env.CHROME_PATH) {
    process.env.CHROME_PATH =
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    console.log("✅ Chrome path set for local:", process.env.CHROME_PATH);
  }
}

// 🧠 Attach browser debug listeners
function attachDebugListeners(page) {
  page.on("console", (msg) => console.log("🧠 BROWSER LOG:", msg.text()));
  page.on("response", (res) => {
    const status = res.status();
    if (res.url().includes("indeed.com"))
      console.log(`📡 RESPONSE: ${status} → ${res.url()}`);
  });
  page.on("requestfailed", (req) => {
    console.log(
      `❌ REQUEST FAILED: ${req.url()} - ${req.failure()?.errorText || "unknown"}`
    );
  });
}

// Retry waiting for job cards to appear
async function waitForJobCards(page, retries = 5, delay = 2000) {
  console.log("⏳ Waiting for job cards to appear...");
  for (let i = 0; i < retries; i++) {
    const exists = await page.$(
      ".job_seen_beacon, .cardOutline, div[data-jk], .jobsearch-ResultsList > li"
    );
    console.log(`🔄 Attempt ${i + 1}/${retries}, cards found: ${!!exists}`);
    if (exists) return true;
    await wait(delay);
  }

  console.log("❌ Job cards not found after retries");

  // 🧾 Dump HTML snapshot for debugging
  const html = await page.content();
  console.log("🧾 PAGE SNAPSHOT (first 1000 chars):\n", html.slice(0, 1000));

  // 🖼 Save screenshot for Render
  try {
    await page.screenshot({ path: "/tmp/debug.png", fullPage: true });
    console.log("🖼 Screenshot saved at /tmp/debug.png");
  } catch (err) {
    console.log("⚠️ Could not save screenshot:", err.message);
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
    console.log(`📄 On page ${currentPage + 1}...`);
    const cardsExist = await waitForJobCards(page);
    if (!cardsExist) {
      console.log("❌ Job cards did not appear, stopping.");
      break;
    }

    console.log("🔍 Collecting jobs from the current page...");
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
          const jobId =
            card.getAttribute("data-jk") || linkEl?.getAttribute("data-jk");
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

    console.log(`🔹 Found ${currentJobs.length} relevant jobs on this page.`);
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

    console.log("➡️ Looking for next page button...");
    const nextButton = await page.$(
      'a[data-testid="pagination-page-next"], a[aria-label="Next Page"]'
    );
    if (!nextButton) {
      console.log("❌ No next page button found, stopping.");
      break;
    }

    try {
      console.log("⏳ Clicking next page...");
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }),
        nextButton.click(),
      ]);
      currentPage++;
      console.log("✅ Navigated to next page.");
      await wait(2000);
    } catch (err) {
      console.log("❌ Error navigating to next page:", err.message);
      break;
    }
  }

  console.log("🎉 Finished collecting jobs!");
  return Array.from(allJobs.values());
}

// 🧭 Main function
export async function fetchIndeedJobs(keyword) {
  console.log("🚀 Starting job fetch for keyword:", keyword);
  try {
    await ensureChromePath();

    console.log("🌐 Launching browser...");
    const { browser, page } = await connect({
      headless: isRender,
      args: isRender
        ? [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-features=IsolateOrigins",
            "--disable-site-isolation-trials",
            "--single-process",
            "--ignore-certificate-errors",
            "--window-size=1920,1080",
          ]
        : [],
      turnstile: true,
      executablePath: process.env.CHROME_PATH,
    });

    attachDebugListeners(page);

    // 🧍‍♂️ Simulate human-like interaction
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    );

    const url = `https://il.indeed.com/q-${encodeURIComponent(
      keyword
    )}-jobs.html?from=relatedQueries&saIdx=3&rqf=1`;

    console.log("🔎 Navigating to:", url);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    console.log("⏳ Waiting for the page to fully load before scrolling...");
    await wait(8000);

    // Move mouse slightly (human behavior)
    await page.mouse.move(100, 200);
    await page.mouse.wheel({ deltaY: 500 });

    const jobs = await scrollAndCollectAllJobs(page, 200);

    if (isRender) {
      console.log("🛑 Closing browser (Render environment)...");
      await browser.close();
    }

    console.log(`✅ Total jobs collected: ${jobs.length}`);
    return jobs;
  } catch (err) {
    console.error("❌ Error fetching Indeed jobs:", err);
    return [];
  }
}
