import puppeteer from "puppeteer";
import puppeteerCore from "puppeteer-core";
import chromium from "@sparticuz/chromium";

let browser;
const isLocal = process.env.NODE_ENV !== "production";


// Small delay helper
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    "apprentice"      
  ];
let currentPage = 0;
  const maxPages = 10;

  while (currentPage < maxPages && allJobs.size < maxJobs) {
    // Collect jobs from current page
    const currentJobs = await page.evaluate((experienceKeywords) => {
      const results = [];
      const cards = document.querySelectorAll(
        ".job_seen_beacon, .cardOutline, div[data-jk], .jobsearch-ResultsList > li"
      );

      cards.forEach((card) => {
        const titleEl = card.querySelector(
          "h2.jobTitle a, h2.jobTitle span[title], .jobTitle a"
        );
        const title = titleEl?.innerText?.trim() || titleEl?.getAttribute("title")?.trim();
        
        const company = card.querySelector(
          "[data-testid='company-name'], .companyName"
        )?.innerText.trim();
        
        const location = card.querySelector(
          "[data-testid='text-location'], .companyLocation"
        )?.innerText.trim();
        
        const linkEl = card.querySelector("h2.jobTitle a, .jcs-JobTitle");
        const jobId = card.getAttribute("data-jk") || linkEl?.getAttribute("data-jk");
        const link = jobId 
          ? `https://www.indeed.com/viewjob?jk=${jobId}`
          : linkEl?.href;
        
        if (title && company && link) {
          const lowerTitle = title.toLowerCase();
          const isRelevant = experienceKeywords.some(word => lowerTitle.includes(word));
          if (!isRelevant) return; // skip non-junior jobs

          results.push({
            title,
            company,
            location: location || "N/A",
            link,
            source: "Indeed",
          });
        }
      });

      return results;
    }, experienceKeywords);

    const jobsBeforeAdd = allJobs.size;
    currentJobs.forEach((job) => {
      if (!allJobs.has(job.link) && allJobs.size < maxJobs) {
        allJobs.set(job.link, job);
      }
    });

    const jobsAdded = allJobs.size - jobsBeforeAdd;
    console.log(`✨ Jobs added: ${jobsAdded}, Total unique jobs: ${allJobs.size}`);

    if (allJobs.size >= maxJobs) break;

    currentPage++;
    const nextButton = await page.$(
      'a[data-testid="pagination-page-next"], a[aria-label="Next Page"]'
    );

    if (!nextButton) {
      console.log("📄 No more pages available");
      break;
    }

    try {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }),
        nextButton.click(),
      ]);
      console.log(`📄 Navigated to page ${currentPage + 1}`);
      await wait(2000);
    } catch (err) {
      console.log("❌ Could not navigate to next page:", err.message);
      break;
    }
  }

  console.log("🎉 Finished collecting jobs!");
  return Array.from(allJobs.values());
}

// Main function to fetch Indeed jobs
export async function fetchIndeedJobs(keyword, location) {
  try {
    const puppeteerToUse = isLocal ? puppeteer : puppeteerCore;

    if (!browser || !browser.isConnected()) {
      browser = await puppeteerToUse.launch(
        isLocal
          ? {
              headless: fa,
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

    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const blocked = ["image", "font", "media"];
      if (blocked.includes(req.resourceType())) req.abort();
      else req.continue();
    });

    // Indeed URL with entry-level filter, last 24h
    const base = "https://il.indeed.com";
    const url = `${base}/q-${encodeURIComponent(keyword)}-jobs.html?from=relatedQueries&saIdx=3&rqf=1&parentQnorm=software+engineer`;
        console.log("🔎 Navigating to:", url);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    
    await page.waitForSelector(
      ".job_seen_beacon, .cardOutline, div[data-jk], .jobsearch-ResultsList",
      { timeout: 30000 }
    );

    console.log("✅ Page loaded, starting job collection...");

    let jobs = await scrollAndCollectAllJobs(page, 200);


    console.log(`✅ Total jobs collected and sorted: ${jobs.length}`);
    return jobs;
  } catch (err) {
    console.error("❌ Error fetching Indeed jobs:", err);
    return [];
  }
}
