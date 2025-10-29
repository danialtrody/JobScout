import puppeteer from "puppeteer";
import puppeteerCore from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import puppeteerExtra from "puppeteer-extra";

let browser;
const isLocal = process.env.NODE_ENV !== "production";

// Use Puppeteer Extra with Stealth
const puppeteerToUse = isLocal ? puppeteer : puppeteerCore;
if (!isLocal) puppeteerExtra.use(StealthPlugin());

// Convert LinkedIn relative dates to actual Date objects
function parseLinkedInDate(dateStr) {
  if (!dateStr) return new Date(0);
  const lower = dateStr.toLowerCase();
  const now = new Date();

  if (lower.includes("hour")) {
    const hours = parseInt(lower.match(/\d+/)?.[0] || "0", 10);
    return new Date(now.getTime() - hours * 60 * 60 * 1000);
  }
  if (lower.includes("minute")) {
    const minutes = parseInt(lower.match(/\d+/)?.[0] || "0", 10);
    return new Date(now.getTime() - minutes * 60 * 1000);
  }
  if (lower.includes("day")) {
    const days = parseInt(lower.match(/\d+/)?.[0] || "0", 10);
    return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  }
  return now;
}

// Small delay helper
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Scroll and collect all jobs
async function scrollAndCollectAllJobs(page, maxJobs = 200) {
  console.log("🖱️ Starting to scroll and collect jobs...");
  const allJobs = new Map();
  let scrollAttempts = 0;
  const maxScrollAttempts = 50;
  let noNewJobsCount = 0;

  while (scrollAttempts < maxScrollAttempts) {
    const jobsBeforeScroll = allJobs.size;

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await wait(3000);

    // Click "See more jobs" buttons
    const seeMoreButtons = await page.$$("button.infinite-scroller__show-more-button");
    for (const btn of seeMoreButtons) {
      try {
        await btn.click();
        await wait(2000);
      } catch {}
    }

    // Collect jobs
    const currentJobs = await page.evaluate(() => {
      const results = [];
      const cards = document.querySelectorAll("ul.jobs-search__results-list li, .base-card");
      cards.forEach((card) => {
        const title = card.querySelector(".base-search-card__title")?.innerText.trim();
        const company = card.querySelector(".base-search-card__subtitle")?.innerText.trim();
        const location = card.querySelector(".job-search-card__location")?.innerText.trim();
        let link = card.querySelector("a")?.href;

        // Strip tracking params to make the URL permanent
        if (link) {
          const urlObj = new URL(link);
          link = `https://www.linkedin.com/jobs/view/${urlObj.pathname.split("-").pop()}`;
        }

        const date = card.querySelector(".job-search-card__listdate, .job-search-card__listdate--new")?.innerText.trim();

        if (title && company && link) {
          results.push({
            title,
            company,
            location,
            link,
            dateTime: date || "N/A",
            source: "LinkedIn",
          });
        }
      });
      return results;
    });

    currentJobs.forEach((job) => {
      if (!allJobs.has(job.link) && allJobs.size < maxJobs) {
        allJobs.set(job.link, job);
      }
    });

    const jobsAdded = allJobs.size - jobsBeforeScroll;
    console.log(`✨ Jobs added: ${jobsAdded}, Total unique jobs: ${allJobs.size}`);

    if (allJobs.size >= maxJobs) break;

    if (jobsAdded === 0) {
      noNewJobsCount++;
      if (noNewJobsCount >= 2) break;
    } else {
      noNewJobsCount = 0;
    }

    scrollAttempts++;
    await wait(2000);
  }

  console.log("🎉 Finished collecting jobs!");
  return Array.from(allJobs.values());
}

// Main function to fetch LinkedIn jobs
export async function fetchLinkedInJobs(keyword, location) {
  try {
    if (!browser || !browser.isConnected()) {
      browser = await puppeteerToUse.launch(
        isLocal
          ? {
              headless: !isLocal,
              args: ["--no-sandbox", "--disable-setuid-sandbox", "--start-maximized"],
              defaultViewport: null,
            }
          : {
              args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
              defaultViewport: chromium.defaultViewport,
              executablePath: await chromium.executablePath(),
              headless: chromium.headless,
            }
      );
    }

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
    );

    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const blocked = ["image", "font", "media"];
      if (blocked.includes(req.resourceType())) req.abort();
      else req.continue();
    });

    const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
      keyword
    )}&location=${encodeURIComponent(location)}&f_TPR=r86400&f_E=1,2&sortBy=DD`;

    console.log("🔎 Navigating to:", url);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("ul.jobs-search__results-list li, .base-card", { timeout: 30000 });

    console.log("✅ Page loaded, starting job collection...");
    let jobs = await scrollAndCollectAllJobs(page, 200);

    // Sort newest first
    jobs.sort((a, b) => parseLinkedInDate(b.dateTime) - parseLinkedInDate(a.dateTime));

    console.log(`✅ Total jobs collected and sorted: ${jobs.length}`);
    return jobs;
  } catch (err) {
    console.error("❌ Error fetching LinkedIn jobs:", err);
    return [];
  }
}
