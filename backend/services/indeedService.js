import { connect } from "puppeteer-real-browser";
import chromium from "@sparticuz/chromium";

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const isRender = process.env.RENDER === "true";

if (isRender) {
  process.env.CHROME_PATH = chromium.path;
} else if (!process.env.CHROME_PATH) {
  process.env.CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
}

// Detect login page
async function isLoginPage(page) {
  const url = page.url();
  return url.includes("/auth") || url.includes("/signin");
}

// Wait for job cards
async function waitForJobCards(page, retries = 5, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    const cards = await page.$$(".job_seen_beacon, .cardOutline, div[data-jk], .jobsearch-ResultsList > li");
    if (cards.length > 0) return true;
    console.log(`⏳ Waiting for job cards... attempt ${i + 1}/${retries}`);
    await wait(delay);
  }
  return false;
}

// ✅ Collect only JUNIOR / ENTRY LEVEL jobs (English + Hebrew)
async function collectJobs(page) {
  return page.$$eval(
    ".job_seen_beacon, .cardOutline, div[data-jk], .jobsearch-ResultsList > li",
    cards => {
      const juniorKeywords = [
        // --- English keywords ---
        "junior",
        "intern",
        "internship",
        "no experience",
        "entry level",
        "entry-level",
        "graduate",
        "trainee",
        "associate",
        "new grad",
        "apprentice",
        "beginner",
        "student",
        "fresh graduate",
        "starter",
        "first job",
        "without experience",
        "zero experience",
        "undergraduate",
        "early career",

        // --- Hebrew keywords ---
        "ג'וניור",
        "גוניור",
        "ללא ניסיון",
        "ללא נסיון",
        "בלי ניסיון",
        "בלי נסיון",
        "מתחיל",
        "תפקיד התחלתי",
        "דרוש ניסיון",
        "משרת סטודנט",
        "סטודנט",
        "משרת התחלה",
        "משרת התחלתית",
        "משרת התמחות",
        "התמחות",
        "אקדמאי צעיר",
        "משרה למתחילים",
        "משרה ללא ניסיון",
        "משרת ג'וניור",
        "משרת גוניור",
      ];

      const results = [];

      cards.forEach(card => {
        const titleEl = card.querySelector("h2.jobTitle a, h2.jobTitle span[title], .jobTitle a");
        const title = titleEl?.innerText?.trim() || titleEl?.getAttribute("title")?.trim();
        if (!title) return;

        const lowerTitle = title.toLowerCase();
        const isJunior = juniorKeywords.some(word => lowerTitle.includes(word));
        if (!isJunior) return; // ❌ Skip non-junior jobs

        const company =
          card.querySelector("[data-testid='company-name'], .companyName")?.innerText?.trim() || "N/A";
        const location =
          card.querySelector("[data-testid='text-location'], .companyLocation")?.innerText?.trim() || "N/A";

        const linkEl = card.querySelector("h2.jobTitle a, .jcs-JobTitle");
        const jobId = card.getAttribute("data-jk") || linkEl?.getAttribute("data-jk");
        const link = jobId ? `https://www.indeed.com/viewjob?jk=${jobId}` : linkEl?.href;

        if (title && company && link) {
          results.push({ title, company, location, link, source: "Indeed" });
        }
      });

      return results;
    }
  );
}

// Scroll and collect jobs (pagination)
async function scrollAndCollectAllJobs(page, maxPages = 5, maxJobs = 200) {
  const allJobs = new Map();
  let currentPage = 0;

  while (currentPage < maxPages && allJobs.size < maxJobs) {
    const cardsExist = await waitForJobCards(page);
    if (!cardsExist) break;

    const jobs = await collectJobs(page);
    const beforeAdd = allJobs.size;
    jobs.forEach(job => {
      if (!allJobs.has(job.link) && allJobs.size < maxJobs) allJobs.set(job.link, job);
    });
    console.log(`✨ Jobs added: ${allJobs.size - beforeAdd}, Total: ${allJobs.size}`);

    const nextButton = await page.$('a[data-testid="pagination-page-next"], a[aria-label="Next Page"]');
    if (!nextButton) break;

    try {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }),
        nextButton.click(),
      ]);
      currentPage++;
      await wait(2000);
    } catch {
      break;
    }
  }

  return Array.from(allJobs.values());
}

// Main scraper function
export async function fetchIndeedJobs(keyword) {
  try {
    const { browser, page } = await connect({
      headless: isRender,
      args: isRender
        ? ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
        : ["--start-maximized"],
      turnstile: true,
    });

    if (!isRender) {
      const dimensions = await page.evaluate(() => ({
        width: window.screen.availWidth,
        height: window.screen.availHeight,
      }));
      await page.setViewport(dimensions);
    }

    const url = `https://il.indeed.com/q-${encodeURIComponent(keyword)}-jobs.html?sort=date&fromage=3`;
    console.log("🔎 Navigating to:", url);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await wait(8000);

    // Check login redirect
    if (await isLoginPage(page)) {
      console.log("⚠️ Redirected to login page. Please log in manually in this browser or pass cookies.");
      await browser.close();
      return [];
    }

    const jobs = await scrollAndCollectAllJobs(page, 5, 200);

    if (isRender) await browser.close();
    console.log(`✅ Total jobs collected: ${jobs.length}`);
    return jobs;
  } catch (err) {
    console.error("❌ Error fetching Indeed jobs:", err);
    return [];
  }
}
