import { connect } from "puppeteer-real-browser";
import chromium from "@sparticuz/chromium";

// Small delay helper
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const isRender = process.env.RENDER === "true";

if (isRender) {
  process.env.CHROME_PATH = chromium.path;
} else if (!process.env.CHROME_PATH) {
  process.env.CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
}

// Close any popups
async function closePopups(page) {
  try {
    const aiPopup = await page.$("#aiPopupContainer");
    if (aiPopup) {
      const closeBtn = await page.$("#closeAiPopup");
      if (closeBtn) await closeBtn.click();
      await wait(1000);
    }
  } catch {}

  try {
    const loginPopup = await page.$(".auth_MainContainer__PRM_B.main-container.login");
    if (loginPopup) {
      const closeBtn = await page.$(".navbar_nav_buttons__m5yK7");
      if (closeBtn) await closeBtn.click();
      await wait(1000);
    }
  } catch {}
}

// Scroll page
async function scrollToLoadMore(page, times = 5) {
  console.log(`📜 Scrolling the page ${times} times to load jobs...`);
  for (let i = 0; i < times; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await wait(1500);
  }
}

// Wait for job cards
async function waitForJobCards(page, retries = 5, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    const cards = await page.$$(".job-content-top");
    if (cards.length > 0) return true;
    console.log(`⏳ Waiting for job cards... attempt ${i + 1}/${retries}`);
    await wait(delay);
  }
  return false;
}

// Collect jobs from current page
async function collectJobsFromPage(page) {
  const cardsExist = await waitForJobCards(page);
  if (!cardsExist) return [];

  const jobs = await page.evaluate(() => {
    const results = [];
    const cards = document.querySelectorAll(".job-content-top");

    const excludeKeywords = [
      "senior", "sr", "lead", "manager", "management", "director",
      "head", "chief", "principal", "architect", "ניהול", "בכיר",
      "ראש צוות", "מנהל", "מנהלת", "ראש", "סמנכ״ל", "סמנכ\"ל"
    ];

    const softwareKeywords = [
      "developer", "engineer", "software", "backend", "frontend", 
      "fullstack", "program", "dev", "web", "mobile", "java", 
      "python", "c#", "javascript", "react", "node"
    ];

    cards.forEach(card => {
      const titleEl = card.querySelector("h2");
      const title = titleEl?.innerText?.trim() || "";
      if (!title) return;

      // Exclude senior/management jobs
      const lowerTitle = title.toLowerCase();
      if (excludeKeywords.some(word => lowerTitle.includes(word.toLowerCase()))) return;

      const companyEl = card.querySelector(".T14 a");
      const company = companyEl?.innerText?.trim() || "";
      if (!company || company.toUpperCase() === "N/A") return;

      const locationEl = card.querySelector(".job-content-top-location");
      let location = locationEl?.innerText?.replace("מיקום המשרה:", "").trim() || "";
      if (location.includes("(זמן ממוצע")) location = location.split("(זמן ממוצע")[0].trim();

      const linkEl = card.querySelector(".job-content-top-title-ltr a, .job-content-top-title a, h2 a");
      const link = linkEl
        ? (linkEl.getAttribute("href").startsWith("http")
            ? linkEl.getAttribute("href")
            : `https://www.alljobs.co.il${linkEl.getAttribute("href")}`)
        : "";

      const dateEl = card.querySelector(".job-content-top-date");
      const dateTime = dateEl?.innerText?.trim() || "";

      const descEl = card.querySelector(".job-content-top-desc");
      const description = descEl?.innerText?.trim() || "";
      const lowerDesc = description.toLowerCase();

      // Filter 0-2 years experience
      const experienceMatch = lowerDesc.match(/(\d+)\s*(year|years|שנה|שנים)/);
      const experienceYears = experienceMatch ? parseInt(experienceMatch[1], 10) : 0;
      if (experienceYears > 2) return;

      // Keep only software related jobs
      const combinedText = lowerTitle + " " + lowerDesc;
      if (!softwareKeywords.some(word => combinedText.includes(word.toLowerCase()))) return;

      results.push({
        title,
        company,
        location,
        link,
        source: "AllJobs",
        dateTime
      });
    });

    return results;
  });

  console.log(`📊 Collected ${jobs.length} software jobs from current page`);
  return jobs;
}


// Scroll & collect all jobs with pagination
async function scrollAndCollectAllJobs(page, maxJobs = 200) {
  console.log("🖱️ Starting to scroll and collect jobs...");
  const allJobs = new Map();
  let currentPage = 0;
  const maxPages = 1;

  while (currentPage < maxPages && allJobs.size < maxJobs) {
    await scrollToLoadMore(page, 5);

    const jobs = await collectJobsFromPage(page);
    const jobsBefore = allJobs.size;
    jobs.forEach(job => {
      if (!allJobs.has(job.link) && allJobs.size < maxJobs) allJobs.set(job.link, job);
    });
    console.log(`✨ Jobs added this page: ${allJobs.size - jobsBefore}, Total unique jobs: ${allJobs.size}`);

    const nextButton = await page.$(".jobs-paging-next a");
    if (!nextButton) { console.log("❌ No next button found, stopping."); break; }

    try {
      console.log("🔄 Clicking next page button...");
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }),
        nextButton.click(),
      ]);
      currentPage++;
      console.log(`📄 Moved to page ${currentPage + 1}`);
      await wait(2000);
    } catch (err) {
      console.log("❌ Failed to navigate to next page:", err.message);
      break;
    }
  }

  console.log("🎉 Finished collecting jobs!");
  return Array.from(allJobs.values());
}

// Main function
export async function fetchAllJobs(keyword = "") {
  try {
    const { browser, page } = await connect({
      headless: isRender,
      args: isRender
        ? ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
        : ["--start-maximized", "--window-size=1920,1080"],
      turnstile: true,
    });

    const url = `https://www.alljobs.co.il/SearchResultsGuest.aspx?page=1&position=&type=&freetxt=${encodeURIComponent(keyword)}&city=&region=`;

    console.log("🔎 Navigating to:", url);
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    console.log("⏳ Waiting for the page to fully load...");
    await wait(2000);

    await closePopups(page);

    try {
      const newestButton = await page.$("#sort_1");
      if (newestButton) { await newestButton.click(); console.log("✅ Clicked 'Newest' filter"); await wait(3000); }
    } catch (err) { console.log("⚠️ Could not click newest filter:", err.message); }

    const jobs = await scrollAndCollectAllJobs(page, 200);

    if (isRender) await browser.close();

    console.log(`✅ Total jobs collected: ${jobs.length}`);
    return jobs;
  } catch (err) {
    console.error("❌ Error fetching AllJobs jobs:", err);
    return [];
  }
}
