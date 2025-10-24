import puppeteer from "puppeteer";
import puppeteerCore from "puppeteer-core";
import chromium from "@sparticuz/chromium";

let browser;
const isLocal = process.env.NODE_ENV !== "production";

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

export async function fetchLinkedInJobs(keyword, location) {
  try {
    const puppeteerToUse = isLocal ? puppeteer : puppeteerCore;

    if (!browser || !browser.isConnected()) {
      browser = await puppeteerToUse.launch(
        isLocal
          ? { headless: true }
          : {
              args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
              defaultViewport: chromium.defaultViewport,
              executablePath: await chromium.executablePath(),
              headless: chromium.headless,
            }
      );
    }

    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const blocked = ["image", "stylesheet", "font", "media"];
      if (blocked.includes(req.resourceType())) req.abort();
      else req.continue();
    });

    const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
      keyword
    )}&location=${encodeURIComponent(location)}&f_E=1%2C2&f_TPR=r86400&sortBy=DD&refresh=true`;

    console.log(`🔎 Fetching jobs:`, url);

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForSelector(".base-card", { timeout: 15000 });

    const jobs = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll(".base-card").forEach((card) => {
        const title = card.querySelector(".base-search-card__title")?.innerText.trim();
        const company = card.querySelector(".base-search-card__subtitle")?.innerText.trim();
        const location = card.querySelector(".job-search-card__location")?.innerText.trim();
        const link = card.querySelector("a")?.href;
        const date = card.querySelector(".job-search-card__listdate, .job-search-card__listdate--new")?.innerText.trim();

        if (title && company && link) {
          results.push({ title, company, location, link, dateTime: date || "N/A", source: "LinkedIn" });
        }
      });
      return results;
    });

    await page.close();


    jobs.sort((a, b) => parseLinkedInDate(b.dateTime) - parseLinkedInDate(a.dateTime));

    console.log(`✅ Total jobs found: ${jobs.length}`);
    return jobs;

  } catch (err) {
    console.error("❌ Error fetching LinkedIn jobs:", err);
    return [];
  }
}
