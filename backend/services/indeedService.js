import { connect } from "puppeteer-real-browser";
import chromium from "@sparticuz/chromium";

// Small delay helper
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Detect if running on Render
const isRender = process.env.RENDER === "true";

// Ensure CHROME_PATH is set correctly
async function ensureChromePath() {
  if (isRender) {
    process.env.CHROME_PATH = await chromium.executablePath();
  } else if (!process.env.CHROME_PATH) {
    process.env.CHROME_PATH =
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  }
}

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

// Scroll and collect jobs
async function scrollAndCollectAllJobs(page, maxJobs = 100) {
  console.log("🖱️ Starting to scroll and collect jobs...");

  const allJobs = new Map();
  const experienceKeywords = [
    "junior","intern","internship","no experience","entry level",
    "graduate","trainee","associate","new grad","apprentice",
    "fresh graduate","recent graduate","recent grad","beginner",
    "starter","novice","first job","early career","graduate trainee",
    "graduate program","cadet","probationary","junior developer","junior engineer"
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
  await ensureChromePath();

  try {
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
          ]
        : [],
      turnstile: true, // ✅ bypass Turnstile bot check
    });

    // Sort by date and show jobs from last 24 hours
    const url = `https://il.indeed.com/q-${encodeURIComponent(
      keyword
    )}-jobs.html?from=relatedQueries&saIdx=3&rqf=1&sort=date&fromage=1`;

    console.log("🔎 Navigating to:", url);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    console.log("⏳ Waiting for the page to fully load before scrolling...");
    await wait(10000);

    const jobs = await scrollAndCollectAllJobs(page, 200);

    if (isRender) await browser.close();

    console.log(`✅ Total jobs collected: ${jobs.length}`);
    return jobs;
  } catch (err) {
    console.error("❌ Error fetching Indeed jobs:", err);
    return [];
  }
}
