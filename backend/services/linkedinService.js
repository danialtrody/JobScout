// fetchLinkedInJobs.js
import puppeteer from "puppeteer"; 
import puppeteerCore from "puppeteer-core"; 
import chromium from "@sparticuz/chromium";

let browser;
const isLocal = process.env.NODE_ENV !== "production"; 

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
    )}&location=${encodeURIComponent(location)}&f_TPR=r86400&f_E=2`;

    console.log("🔎 Fetching:", url);

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector(".base-card", { timeout: 10000 });

 
    const MAX_SCROLLS = 30;
    let scrolls = 0;
    let previousHeight;

    while (scrolls < MAX_SCROLLS) {
      previousHeight = await page.evaluate("document.body.scrollHeight");
      await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
      await new Promise(r => setTimeout(r, 2000)); 
      const newHeight = await page.evaluate("document.body.scrollHeight");
      if (newHeight === previousHeight) break; 
      scrolls++;
    }

    const jobs = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll(".base-card").forEach((card) => {
        const title = card.querySelector(".base-search-card__title")?.innerText.trim();
        const company = card.querySelector(".base-search-card__subtitle")?.innerText.trim();
        const location = card.querySelector(".job-search-card__location")?.innerText.trim();
        const link = card.querySelector("a")?.href;
        if (title && company && link) results.push({ title, company, location, link, source: "LinkedIn" });
      });
      return results;
    });

    await page.close();
    console.log(`✅ LinkedIn (24h) found: ${jobs.length} jobs`);
    return jobs;
  } catch (err) {
    console.error("❌ Error fetching LinkedIn jobs:", err);
    return [];
  }
}
