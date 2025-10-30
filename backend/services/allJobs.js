/**
 * fetchAllJobs.js
 *
 * Robust AllJobs scraper using puppeteer-real-browser + @sparticuz/chromium.
 * This version intentionally uses the library's built-in Turnstile handling
 * (turnstile: true) and adds retries, longer waits, and helpful logging.
 *
 * IMPORTANT:
 * - This does NOT attempt to break or circumvent security controls.
 * - It relies on puppeteer-real-browser's legitimate Turnstile support.
 * - Ensure you comply with AllJobs' robots.txt and terms of service before running.
 */

import { connect } from "puppeteer-real-browser";
import chromium from "@sparticuz/chromium";
import fs from "fs";
import path from "path";

/* ----------------------------- config ----------------------------- */
const isRender = process.env.RENDER === "true"; // set by hosting env
const MAX_PAGES = 10; // maximum pages to visit
const MAX_JOBS = 500; // total jobs limit
const NAV_TIMEOUT = 120000; // navigation timeout (ms)
const TURNSTILE_WAIT = 12000; // wait after navigation for Turnstile to resolve (ms)
const RETRY_NAVIGATIONS = 2; // number of times to retry loading a page if it fails
const WAIT_BETWEEN_PAGES = 3500; // ms
const SCREENSHOT_ON_ERROR = true; // saves /tmp/alljobs-error.png (or local) when error occurs

/* --------------------------- chrome path -------------------------- */
if (isRender) {
  process.env.CHROME_PATH = chromium.path;
} else if (!process.env.CHROME_PATH) {
  // adjust local path to your Chrome if necessary
  process.env.CHROME_PATH =
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
}

/* ---------------------------- utilities --------------------------- */
function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function saveScreenshot(page, filename = "alljobs-error.png") {
  try {
    const folder = process.env.TMPDIR || "/tmp";
    const full = path.join(folder, filename);
    await page.screenshot({ path: full, fullPage: true });
    console.log(`🖼️ Saved screenshot to ${full}`);
  } catch (e) {
    console.warn("⚠️ Could not save screenshot:", e?.message || e);
  }
}

/* -------------------------- main function ------------------------- */
export async function fetchAllJobs(keyword = "software engineer", location = "Israel") {
  let browser;
  try {
    console.log("🚀 Starting fetchAllJobs");

    // Connect to a real browser (puppeteer-real-browser) which supports Turnstile
    const connectOpts = {
      headless: isRender, // use headless on render, visible locally
      args: isRender
        ? [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-features=IsolateOrigins",
            "--disable-site-isolation-trials",
          ]
        : ["--start-maximized"],
      turnstile: true, // <-- use the library's Turnstile handling
    };

    const connected = await connect(connectOpts);
    // puppeteer-real-browser returns an object often containing browser and page
    // destructure carefully
    browser = connected.browser || connected;
    const page = connected.page || (await browser.newPage());

    // Use a realistic user-agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
    );

    // Block heavy/unnecessary resources
    try {
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        const blocked = ["image", "font", "media", "stylesheet"];
        if (blocked.includes(req.resourceType())) req.abort();
        else req.continue();
      });
    } catch (e) {
      // some real-browser wrappers may disallow re-setting interception, ignore if fails
      console.warn("⚠️ Request interception not available:", e?.message || e);
    }

    const allJobs = new Map();
    let currentPage = 1;

    console.log(`🔍 Scraping AllJobs for "${keyword}" in "${location}"`);

    while (currentPage <= MAX_PAGES && allJobs.size < MAX_JOBS) {
      const url = `https://www.alljobs.co.il/SearchResultsGuest.aspx?keywords=${encodeURIComponent(
        keyword
      )}&location=${encodeURIComponent(location)}&duration=0&fdate=1&page=${currentPage}&position=&type=&region=`;

      console.log(`➡️ Page ${currentPage}: ${url}`);

      // Retry loop for navigation (helps if transient Cloudflare delays happen)
      let navSuccess = false;
      let lastNavError = null;
      for (let attempt = 1; attempt <= RETRY_NAVIGATIONS && !navSuccess; attempt++) {
        try {
          await page.goto(url, { waitUntil: "networkidle2", timeout: NAV_TIMEOUT });
          // allow Turnstile to resolve and dynamic JS to run
          await wait(TURNSTILE_WAIT);
          navSuccess = true;
        } catch (navErr) {
          lastNavError = navErr;
          console.warn(
            `⚠️ Navigation attempt ${attempt} failed for page ${currentPage}:`,
            navErr?.message || navErr
          );
          // small backoff
          await wait(3000 * attempt);
        }
      }

      if (!navSuccess) {
        console.error("❌ All navigation attempts failed for page", currentPage, lastNavError);
        if (SCREENSHOT_ON_ERROR) await saveScreenshot(page, `alljobs-page-${currentPage}-error.png`);
        break;
      }

      // Wait for selectors that indicate job cards are present
      // Using the selector that appears in guest pages: .open-board-item
      try {
        await page.waitForSelector(".open-board-item", { timeout: 20000 });
      } catch {
        // sometimes structure differs — try a few fallback selectors before giving up
        const fallbackSelectors = [".job-item", ".result", ".searchResultItem", ".job-card"];
        let found = false;
        for (const sel of fallbackSelectors) {
          try {
            await page.waitForSelector(sel, { timeout: 7000 });
            console.log(`ℹ️ Fallback selector matched: ${sel}`);
            found = true;
            break;
          } catch {
            // try next
          }
        }
        if (!found) {
          console.log("⚠️ No job elements found on this page. Possibly last page or blocked.");
          // save screenshot to help debugging
          if (SCREENSHOT_ON_ERROR) await saveScreenshot(page, `alljobs-no-jobs-page-${currentPage}.png`);
          break;
        }
      }

      // Extract jobs from the DOM
      const jobsOnPage = await page.evaluate(() => {
        const results = [];
        // primary selector observed on AllJobs guest pages
        const nodes = document.querySelectorAll(".open-board-item");
        // fallback: if none found, try more generic selectors
        const fallback = !nodes || nodes.length === 0 ? document.querySelectorAll(".job-item, .job-card, .result, .searchResultItem") : nodes;

        Array.from(fallback).forEach((el) => {
          try {
            const titleEl = el.querySelector(".job-content-top-title a, a.job-title, .job-title a");
            const title = titleEl?.innerText?.trim() || null;
            const link = titleEl?.href || null;
            const company = el.querySelector(".job-company-name, .company, .employer")?.innerText?.trim() || "N/A";
            const loc = el.querySelector(".job-content-top-location, .job-location, .location")?.innerText?.trim() || "N/A";
            // optional: try to capture short description or date if present
            const date =
              el.querySelector(".job-date, .date, .posted-date")?.innerText?.trim() || null;
            const description =
              el.querySelector(".job-content-description, .short-description, .desc")?.innerText?.trim() || null;

            if (title && link) {
              results.push({
                title,
                company,
                location: loc,
                date,
                description,
                link,
                source: "AllJobs",
              });
            }
          } catch (e) {
            // ignore element-level parsing errors
          }
        });

        return results;
      });

      console.log(`📄 Page ${currentPage}: scraped ${jobsOnPage.length} items`);

      // add unique jobs by link
      const before = allJobs.size;
      for (const j of jobsOnPage) {
        if (j.link && !allJobs.has(j.link) && allJobs.size < MAX_JOBS) {
          allJobs.set(j.link, j);
        }
      }
      const added = allJobs.size - before;
      console.log(`➕ Added ${added} unique jobs (total ${allJobs.size})`);

      // if nothing new was added this page, likely no more results
      if (added === 0) {
        console.log("ℹ️ No new jobs added from this page — stopping pagination.");
        break;
      }

      // small polite wait before next page
      currentPage++;
      await wait(WAIT_BETWEEN_PAGES);
    } // end pages loop

    console.log(`🎉 Done scraping. Collected ${allJobs.size} unique jobs.`);

    // close browser if we created it
    try {
      if (isRender && browser?.close) await browser.close();
    } catch (e) {
      console.warn("⚠️ Error closing browser:", e?.message || e);
    }

    return Array.from(allJobs.values());
  } catch (err) {
    console.error("❌ fetchAllJobs error:", err?.message || err);
    // attempt to save screenshot if available
    try {
      if (err?.page && SCREENSHOT_ON_ERROR) await saveScreenshot(err.page, "alljobs-exception.png");
    } catch {}
    // ensure browser closed
    try {
      if (browser && browser.close) await browser.close();
    } catch {}
    return [];
  }
}

/* --------------------------- quick test --------------------------- */
/* Uncomment to test locally (do NOT enable in production automatically)
if (require.main === module) {
  (async () => {
    const jobs = await fetchAllJobs("software engineer", "Israel");
    console.log("SAMPLE OUTPUT:", jobs.slice(0, 5));
    process.exit(0);
  })();
}
*/

