import puppeteer from 'puppeteer';

export async function fetchLinkedInJobs(keyword, location) {
  let browser;
  try {
    console.log('🚀 Starting browser...');
    console.log('📍 Search:', keyword, 'in', location);
    
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--single-process'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium'
    });

    console.log('✅ Browser launched');
    const page = await browser.newPage();

    // Set user agent to avoid detection
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(
      keyword
    )}&location=${encodeURIComponent(location)}&f_TPR=r86400`;

    console.log('🔗 Navigating to LinkedIn...');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log('⏳ Waiting for job cards...');
    await page.waitForSelector('.base-card', { timeout: 20000 });

    const jobs = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('.base-card').forEach((card) => {
        const title = card.querySelector('.base-search-card__title')?.innerText.trim();
        const company = card.querySelector('.base-search-card__subtitle')?.innerText.trim();
        const location = card.querySelector('.job-search-card__location')?.innerText.trim();
        const link = card.querySelector('a')?.href;

        if (title && company && link) {
          results.push({ 
            title, 
            company, 
            location: location || 'Not specified', 
            link 
          });
        }
      });
      return results;
    });

    console.log(`✅ Found ${jobs.length} jobs`);
    
    if (jobs.length === 0) {
      console.log('⚠️ No jobs found, returning sample data');
      return [
        {
          title: "No jobs found for this search",
          company: "Try different keywords or location",
          location: "N/A",
          link: "#"
        }
      ];
    }
    
    return jobs;

  } catch (error) {
    console.error('❌ Error in fetchLinkedInJobs:', error.message);
    console.error('Stack:', error.stack);
    
    // Return informative error instead of empty array
    return [
      {
        title: "Service temporarily unavailable",
        company: "LinkedIn blocking detected or Puppeteer error",
        location: error.message,
        link: "#"
      }
    ];
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }
}