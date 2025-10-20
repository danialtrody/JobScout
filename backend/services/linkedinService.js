import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

let browser; // global browser instance

export async function fetchLinkedInJobs(keyword, location) {
  try {
    if (!browser) {
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    }

    const page = await browser.newPage();
    const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
      keyword
    )}&location=${encodeURIComponent(location)}&f_TPR=r86400`;

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }); // faster
    await page.waitForSelector(".base-card", { timeout: 20000 });

    const jobs = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll(".base-card").forEach((card) => {
        const title = card.querySelector(".base-search-card__title")?.innerText.trim();
        const company = card.querySelector(".base-search-card__subtitle")?.innerText.trim();
        const location = card.querySelector(".job-search-card__location")?.innerText.trim();
        const link = card.querySelector("a")?.href;
        if (title && company && link) results.push({ title, company, location, link });
      });
      return results;
    });

    await page.close(); // just close the tab, not browser
    return jobs;
  } catch (err) {
    console.error("Error fetching jobs:", err);
    return [];
  }
}
