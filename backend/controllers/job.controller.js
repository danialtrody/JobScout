import {fetchLinkedInJobs} from "../services/linkedinService.js";

export const getJobs = async (req, res) => {
  const keyword = req.query.keyword || "developer";
  const location = req.query.location || "Israel";

  try {
    const jobs = await fetchLinkedInJobs(keyword, location);
    console.log(jobs); 
    res.json(jobs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching jobs" });
  }
}


