import React, { useState, useEffect ,useRef } from "react";
import Card from "../components/Card";
import Keyword from "../components/KeyWords";


function HomePage() {
  // const BASE_URL = "http://localhost:3000/api/jobs";
  const BASE_URL = "/api/jobs";


  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState("software engineer");
  const [location, setLocation] = useState("Israel");

  const fetchRef = useRef(false);

  useEffect(() => {
    if (fetchRef.current) return;
    fetchRef.current = true;
  
    const getJobs = async () => {
      setLoading(true)
      const data = await fetch(`${BASE_URL}?keyword=${position}&location=${location}`)
        .then(res => res.json())
        .catch(() => []);
      setJobs(data);
      fetchRef.current = false;
      setLoading(false)
    };
  
    getJobs();
  }, [position, location]);
  

  if (loading)
    return (
      <div className="loading-container">
        <p className="loading-title">
          🔍 Searching for the latest job positions posted in the last 24 hours...
        </p>
        <p className="loading-title">
          👩‍💻 <strong>Junior</strong>, 🎓 <strong>Entry Level</strong>, and 🏢 <strong>Internship</strong> positions are included.
        </p>
        <p className="loading-title">
          ☕ Grab a coffee, stretch while we fetch the newest roles just for you!
        </p>
        <p className="loading-title">
          Please be patient, it may take a few seconds to gather the most relevant opportunities.
        </p>
        <div className="spinner"></div>
      </div>
    );
  return (
    <div className="container mt-5">
      <h1 className="title">Job List ({jobs.length})</h1>
      <Keyword position={position} setPosition={setPosition} location={location} setLocation={setLocation} />
      <div className="jobCard d-flex flex-wrap gap-3">
        {jobs.map(job => (
          <Card key={job.link} {...job} />
        ))}
      </div>
    </div>
  );
}

export default HomePage;
