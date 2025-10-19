import puppeteer from 'puppeteer';

export async function fetchLinkedInJobs(keyword, location) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'], // קריטי ל-Render
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',


    });

    const page = await browser.newPage();

    const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
      keyword
    )}&location=${encodeURIComponent(location)}&f_TPR=r86400`; // last 24h

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // לחכות שלפחות קארד אחד נטען
    await page.waitForSelector('.base-card', { timeout: 15000 });

    const jobs = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('.base-card').forEach((card) => {
        const title = card.querySelector('.base-search-card__title')?.innerText.trim();
        const company = card.querySelector('.base-search-card__subtitle')?.innerText.trim();
        const location = card.querySelector('.job-search-card__location')?.innerText.trim();
        const link = card.querySelector('a')?.href;

        if (title && company && link) {
          results.push({ title, company, location, link });
        }
      });
      // return results;
      return [
        {
          title: "Senior Developer",
          company: "Test Company",
          location: "Israel",
          link: "https://linkedin.com"
        },
        {
          title: "Junior Developer",
          company: "Another Company",
          location: "Tel Aviv",
          link: "https://linkedin.com"
        }
      ];
    });

    return jobs;
  } catch (error) {
    console.error('Error in fetchLinkedInJobs:', error);
    return []; // מחזיר מערך ריק במקום לזרוק 500
  } finally {
    if (browser) await browser.close();
  }
}
