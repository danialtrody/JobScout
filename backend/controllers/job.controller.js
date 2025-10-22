import { fetchLinkedInJobs } from "../services/linkedinService.js";
// import { fetchIndeedJobs } from "../services/indeedService.js";

export const getJobs = async (req, res) => {
  const keyword = req.query.keyword || "developer";
  const location = req.query.location || "Israel";

  try {
    const [linkedinJobs, indeedJobs] = await Promise.all([
      fetchLinkedInJobs(keyword, location),
      // fetchIndeedJobs(keyword, location),
    ]);


    // const jobs = [...linkedinJobs, ...indeedJobs];
    const jobs = [...linkedinJobs];


    console.log(`🔹 Total jobs found: ${jobs.length}`);
    res.json(jobs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching jobs" });
  }
};
