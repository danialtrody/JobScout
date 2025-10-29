import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import chromium from "@sparticuz/chromium";

puppeteer.use(StealthPlugin());

// Small delay helper
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const isRender = !!process.env.RENDER;

// ✅ Properly set CHROME_PATH for Render
async function ensureChromePath() {
  console.log("🔧 Ensuring Chrome path...");
  if (isRender) {
    process.env.CHROME_PATH = await chromium.executablePath();
    console.log("✅ Chrome path set for Render:", process.env.CHROME_PATH);
  } else if (!process.env.CHROME_PATH) {
    process.env.CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    console.log("✅ Chrome path set for local:", process.env.CHROME_PATH);
  }
}

// 🧠 Attach browser debug listeners
function attachDebugListeners(page) {
  page.on("console", (msg) => console.log("🧠 BROWSER LOG:", msg.text()));
  page.on("response", (res) => {
    if (res.url().includes("indeed.com")) {
      console.log(`📡 RESPONSE: ${res.status()} → ${res.url()}`);
    }
  });
  page.on("requestfailed", (req) => {
    console.log(`❌ REQUEST FAILED: ${req.url()} - ${req.failure()?.errorText || "unknown"}`);
  });
}

// Scroll and collect jobs (simplified for Render)
async function scrollAndCollectAllJobs(page, maxJobs = 100) {
  const allJobs = new Map();
  const experienceKeywords = ["junior","intern","internship","no experience","entry level","graduate","trainee","associate","new grad","apprentice"];
  let currentPage = 0;
  const maxPages = 10;

  while (currentPage < maxPages && allJobs.size < maxJobs) {
    const cardsExist = await page.$(".job_seen_beacon, .cardOutline, div[data-jk], .jobsearch-ResultsList > li");
    if (!cardsExist) break;

    const currentJobs = await page.$$eval(
      ".job_seen_beacon, .cardOutline, div[data-jk], .jobsearch-ResultsList > li",
      (cards, experienceKeywords) => {
        const results = [];
        cards.forEach((card) => {
          const titleEl = card.querySelector("h2.jobTitle a, h2.jobTitle span[title], .jobTitle a");
          const title = titleEl?.innerText?.trim() || titleEl?.getAttribute("title")?.trim();
          const company = card.querySelector("[data-testid='company-name'], .companyName")?.innerText.trim() || "N/A";
          const location = card.querySelector("[data-testid='text-location'], .companyLocation")?.innerText.trim() || "N/A";
          const linkEl = card.querySelector("h2.jobTitle a, .jcs-JobTitle");
          const jobId = card.getAttribute("data-jk") || linkEl?.getAttribute("data-jk");
          const link = jobId ? `https://www.indeed.com/viewjob?jk=${jobId}` : linkEl?.href;

          if (title && company && link) {
            const lowerTitle = title.toLowerCase();
            if (!experienceKeywords.some((word) => lowerTitle.includes(word))) return;
            results.push({ title, company, location, link, source: "Indeed" });
          }
        });
        return results;
      },
      experienceKeywords
    );

    currentJobs.forEach((job) => {
      if (!allJobs.has(job.link) && allJobs.size < maxJobs) allJobs.set(job.link, job);
    });

    const nextButton = await page.$('a[data-testid="pagination-page-next"], a[aria-label="Next Page"]');
    if (!nextButton) break;

    try {
      await Promise.all([page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }), nextButton.click()]);
      currentPage++;
      await wait(2000 + Math.random() * 2000);
    } catch {
      break;
    }
  }

  return Array.from(allJobs.values());
}

// 🧭 Main function
export async function fetchIndeedJobs(keyword) {
  try {
    await ensureChromePath();

    const browser = await puppeteer.launch({
      headless: isRender,
      executablePath: process.env.CHROME_PATH,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-features=IsolateOrigins,site-per-process",
        "--single-process",
        "--ignore-certificate-errors",
        "--window-size=1920,1080",
      ],
    });

    const page = await browser.newPage();
    attachDebugListeners(page);

    // Human-like behavior
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36");
    await page.setViewport({ width: 1920, height: 1080 });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, "languages", { get: () => ["en-US","en"] });
      Object.defineProperty(navigator, "plugins", { get: () => [1,2,3,4,5] });
    });

    const url = `https://il.indeed.com/q-${encodeURIComponent(keyword)}-jobs.html?from=relatedQueries&saIdx=3&rqf=1`;
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await wait(3000 + Math.random() * 3000);

    await page.mouse.move(100, 200);
    await page.mouse.wheel({ deltaY: 500 });
    await wait(2000 + Math.random() * 2000);

    const jobs = await scrollAndCollectAllJobs(page, 200);

    await browser.close();
    return jobs;
  } catch (err) {
    console.error("❌ Error fetching Indeed jobs:", err);
    return [];
  }
}
