import { fetchLinkedInJobs } from "../services/linkedinService.js";

export const getJobs = async (req, res) => {
  const keyword = req.query.keyword || "developer";
  const location = req.query.location || "Israel";

  try {
        // const indeedJobs = await fetchIndeedJobs(keyword, location);
    const jobs = await fetchLinkedInJobs(keyword, location);
    res.json(jobs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching jobs" });
  }
};
