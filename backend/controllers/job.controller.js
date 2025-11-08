import { fetchLinkedInJobs } from "../services/linkedinService.js";
import { fetchIndeedJobs } from "../services/indeedService.js";
import { fetchAllJobs } from "../services/allJobs.js";



export const getJobs = async (req, res) => {
  const keyword = req.query.keyword || "developer";
  const location = req.query.location || "Israel";

  try {
    const linkeInJobs = await fetchLinkedInJobs(keyword, location);
    const indeedJobs = await fetchIndeedJobs(keyword, location);
    const AllJobs = await fetchAllJobs(keyword, location);

    const result = [...linkeInJobs , ...indeedJobs , ...AllJobs ]
    // const result = [...AllJobs ]
    // const result = [...linkeInJobs ]


    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching jobs" });
  }
};
