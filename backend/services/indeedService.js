import puppeteer from "puppeteer"; 
import puppeteerCore from "puppeteer-core"; 
import chromium from "@sparticuz/chromium";

let browser;
const isLocal = process.env.NODE_ENV !== "production"; 

export async function fetchIndeedJobs(keyword, location) {
  let page;
  try {
    const puppeteerToUse = isLocal ? puppeteer : puppeteerCore;

    if (!browser || !browser.isConnected()) {
      browser = await puppeteerToUse.launch(
        isLocal
          ? { headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] }
          : {
              args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
              defaultViewport: chromium.defaultViewport,
              executablePath: await chromium.executablePath(),
              headless: chromium.headless,
            }
      );
    }

    page = await browser.newPage();
    
    // נקה cookies לפני כל חיפוש
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    await client.send('Network.clearBrowserCache');
    
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const blocked = ["image", "stylesheet", "font", "media"];
      if (blocked.includes(req.resourceType())) req.abort();
      else req.continue();
    });

    const base = "https://il.indeed.com";
    let allJobs = [];
    const MAX_PAGES = 3;

    for (let i = 0; i < MAX_PAGES; i++) {
      const url = `${base}/jobs?q=${encodeURIComponent(keyword)}&l=${encodeURIComponent(location)}&fromage=1&sort=date&start=${i * 15}`;
      console.log("🔎 Fetching Indeed:", url);

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForSelector("body", { timeout: 10000 });
      await new Promise(r => setTimeout(r, 2000));

      const jobs = await page.evaluate((baseUrl, searchLocation) => {
        const seen = new Set();
        const rows = document.querySelectorAll("td.resultContent, div.job_seen_beacon, a.jcs-JobTitle");
        return Array.from(rows)
          .map(row => {
            const root = row.closest("a") || row;
            const title =
              root.querySelector("h2 span[title], h2 span, .jobTitle, a.jcs-JobTitle")?.getAttribute("title") ||
              root.querySelector("h2 span, .jobTitle, a.jcs-JobTitle")?.innerText || "";
            const company = root.querySelector(".companyName, .company")?.innerText || "";
            const loc = root.querySelector(".companyLocation, .location")?.innerText || searchLocation || "";
            const href = root.href || root.getAttribute("href") || "";
            const link = href.startsWith("http") ? href : `${baseUrl}${href}`;

            if (!title || !link || seen.has(title)) return null;
            seen.add(title);
            return { 
              title: title.trim(), 
              company: company.trim() || "Company not listed", 
              location: loc.trim(), 
              link, 
              source: "Indeed" 
            };
          })
          .filter(Boolean);
      }, base, location);

      console.log(`📄 Page ${i + 1}: Found ${jobs.length} jobs`);
      
      if (jobs.length === 0) break;
      allJobs.push(...jobs);
    }

    console.log(`✅ Indeed (24h) found: ${allJobs.length} jobs`);
    return allJobs;
  } catch (err) {
    console.error("❌ Error fetching Indeed jobs:", err?.message || err);
    return [];
  } finally {
    if (page) {
      try { 
        await page.close(); 
      } catch (e) {
        console.error("Error closing page:", e.message);
      }
    }
  }
}