import puppeteer from 'puppeteer';

export async function fetchLinkedInJobs(keyword, location) {
  // TEMPORARY MOCK DATA FOR TESTING
  console.log('🧪 Using mock data for testing');
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
    },
    {
      title: "Full Stack Developer",
      company: "Startup Inc",
      location: "Tel Aviv",
      link: "https://linkedin.com"
    }
  ];

  /* COMMENT THIS OUT FOR NOW - WILL FIX PUPPETEER LATER
  let browser;
  try {
    console.log('🚀 Starting browser...');
    
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium'
    });

    console.log('✅ Browser launched');
    const page = await browser.newPage();

    const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
      keyword
    )}&location=${encodeURIComponent(location)}&f_TPR=r86400`;

    console.log('🔗 Navigating to:', url);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    console.log('⏳ Waiting for jobs...');
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
      return results;
    });

    console.log(`✅ Found ${jobs.length} jobs`);
    return jobs;

  } catch (error) {
    console.error('❌ Error in fetchLinkedInJobs:', error.message);
    return [];
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }
  */
}