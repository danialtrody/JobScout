import puppeteer from 'puppeteer';


export async function fetchLinkedInJobs(keyword, location) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
  
    const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
      keyword
    )}&location=${encodeURIComponent(location)}&f_TPR=r86400`; 
    // 604800 last week
    // 2592000 last month
    
  
    await page.goto(url, { waitUntil: "networkidle2" });
  
  
    await page.waitForSelector(".base-card");
  
    const jobs = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll(".base-card").forEach((card) => {
        const title = card.querySelector(".base-search-card__title")?.innerText.trim();
        const company = card.querySelector(".base-search-card__subtitle")?.innerText.trim();
        const location = card.querySelector(".job-search-card__location")?.innerText.trim();
        const link = card.querySelector("a")?.href;
  
        if (title && company && link) {
          results.push({ title, company, location, link });
        }
      });
      return results;
    });
  
    await browser.close();
    return jobs;
  }


