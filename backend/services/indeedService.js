// backend/services/indeedService.js

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer"; // For local development

// Detect if running on Render
const isRender = process.env.RENDER === "true" || process.env.NODE_ENV === "production";

// Helper: small delay
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ✅ Browser launcher that works locally + Render
async function launchBrowser() {
  if (!isRender) {
    console.log("💻 Launching local Puppeteer...");
    return await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--start-maximized"],
      defaultViewport: null,
    });
  }

  console.log("🧠 Launching browser on Render...");
  const chromePath = await chromium.executablePath();
  process.env.CHROME_PATH = chromePath;

  // Must import puppeteer-real-browser **after** setting CHROME_PATH
  const { connect } = await import("puppeteer-real-browser");

  const browser = await connect({
    headless: true,
    executablePath: chromePath,
    args: [
      ...chromium.args,
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--single-process",
      "--disable-gpu",
    ],
    defaultViewport: chromium.defaultViewport,
  });

  console.log("✅ Connected to browser (Render mode)!");
  return browser;
}

// ✅ Helper: Scroll & collect all job cards
async function scrollAndCollectJobs(page, maxJobs = 100) {
  console.log("🖱️ Starting to scroll and collect jobs...");

  const allJobs = new Map();
  let scrollCount = 0;
  let noNewJobs = 0;

  while (scrollCount < 50 && allJobs.size < maxJobs) {
    const before = allJobs.size;

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await wait(2500);

    // Try clicking "See more jobs" buttons
    const seeMoreButtons = await page.$$("button.infinite-scroller__show-more-button");
    for (const btn of seeMoreButtons) {
      try {
        await btn.click();
        await wait(1500);
      } catch {}
    }

    // Extract job data
    const jobs = await page.evaluate(() => {
      const results = [];
      const cards = document.querySelectorAll("ul.jobs-search__results-list li, .base-card");

      cards.forEach((card) => {
        const title = card.querySelector(".base-search-card__title")?.innerText?.trim();
        const company = card.querySelector(".base-search-card__subtitle")?.innerText?.trim();
        const location = card.querySelector(".job-search-card__location")?.innerText?.trim();
        const link = card.querySelector("a")?.href;
        const date = card.querySelector(".job-search-card__listdate, .job-search-card__listdate--new")?.innerText?.trim();

        if (title && company && link) {
          results.push({ title, company, location, link, dateTime: date || "N/A", source: "LinkedIn" });
        }
      });

      return results;
    });

    jobs.forEach((job) => {
      if (!allJobs.has(job.link) && allJobs.size < maxJobs) {
        allJobs.set(job.link, job);
      }
    });

    const added = allJobs.size - before;
    console.log(`✨ Added ${added} jobs. Total: ${allJobs.size}`);

    if (added === 0) noNewJobs++;
    else noNewJobs = 0;

    if (noNewJobs >= 2) break;

    scrollCount++;
  }

  console.log("✅ Finished collecting jobs!");
  return Array.from(allJobs.values());
}

// ✅ Main: fetch LinkedIn/Indeed jobs
export async function fetchLinkedInJobs(keyword, location) {
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const blocked = ["image", "font", "media"];
      if (blocked.includes(req.resourceType())) req.abort();
      else req.continue();
    });

    const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
      keyword
    )}&location=${encodeURIComponent(location)}&f_TPR=r86400&f_E=1,2&sortBy=DD`;

    console.log("🌍 Navigating to:", url);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("ul.jobs-search__results-list li, .base-card", { timeout: 30000 });

    console.log("✅ Page loaded. Collecting jobs...");
    const jobs = await scrollAndCollectJobs(page, 200);

    console.log(`🎉 Collected ${jobs.length} jobs!`);
    return jobs;
  } catch (err) {
    console.error("❌ Error fetching jobs:", err);
    return [];
  } finally {
    try {
      if (browser) await browser.close();
    } catch {}
  }
}
