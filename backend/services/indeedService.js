import puppeteer from "puppeteer";

export async function fetchIndeedJobs(keyword, location) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"]
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1200, height: 800 });

    const base = "https://il.indeed.com";
    let allJobs = [];
    let start = 0;
    const MAX_PAGES = 3; 
    let currentPage = 0;

    while (currentPage < MAX_PAGES) {
      const url = `${base}/jobs?q=${encodeURIComponent(keyword)}&l=${encodeURIComponent(location)}&fromage=1&sort=date&start=${start}`;
      console.log("🔎 Fetching Indeed:", url);

      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForSelector("body", { timeout: 10000 });
      await new Promise(r => setTimeout(r, 2000)); // המתנה לטעינה

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
            return { title: title.trim(), company: company.trim() || "Company not listed", location: loc.trim(), link, source: "Indeed" };
          })
          .filter(Boolean);
      }, base, location);

      if (jobs.length === 0) break; 
      allJobs.push(...jobs);
      start += jobs.length; 
      currentPage++;
    }

    await browser.close();
    console.log(`✅ Indeed (24h) found: ${allJobs.length} jobs`);
    return allJobs;
  } catch (err) {
    console.error("❌ Error fetching Indeed jobs:", err?.message || err);
    if (browser) try { await browser.close(); } catch {}
    return [];
  }
}
