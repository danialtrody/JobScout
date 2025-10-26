import { fetchLinkedInJobs } from "../services/linkedinService.js";
// import { fetchIndeedJobs } from "../services/indeedService.js";


export const getJobs = async (req, res) => {
  const keyword = req.query.keyword || "developer";
  const location = req.query.location || "Israel";

  try {
    // const indeedJobs = await fetchIndeedJobs(keyword, location);
    const linkeInJobs = await fetchLinkedInJobs(keyword, location);
    // const result = [...linkeInJobs , ...indeedJobs]
    const result = [...linkeInJobs ]

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching jobs" });
  }
};
