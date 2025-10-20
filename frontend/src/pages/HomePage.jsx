import React, { useState, useEffect } from "react";
import Card from "../components/Card";
import Keyword from "../components/KeyWords";

function HomePage() {

  const BASE_URL = "http://localhost:3000/api/jobs";
  // const BASE_URL = "/api/jobs";
  

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState("computer science");
  const [location, setLocation] = useState("Israel");


  const fetchJobs = async () => {
    try {
      const response = await fetch(`${BASE_URL}?keyword=${position}&location=${location}`);
      if (!response.ok) throw new Error("Failed to fetch jobs");
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(error);
      return [];
    }
  };

  useEffect(() => {
    const getJobs = async () => {
      setLoading(true);
      const data = await fetchJobs();
      setJobs(data);
      setLoading(false);
    };
    getJobs();
  }, [position,location]);

  if (loading)
    return (
      <div className="loading-container">
        <p className="loading-title">
          🔍 Searching for the latest job positions posted in the last 24 hours...
        </p>
        <p className="loading-title">
        👩‍💻 <strong>Junior</strong>, 🎓 <strong>Entry Level</strong>, and 🏢 <strong>Internship</strong> positions are included.
        </p >
        <p className="loading-title">
          Please be patient, it may take a few seconds to gather the most relevant opportunities.
        </p>
        <p className="loading-title">
          ☕ Grab a coffee, stretch, or do a quick dance while we fetch the newest roles just for you!
        </p>
  
        {/* Spinner */}
        <div className="spinner"></div>
      </div>
    );
  

  return (
    <div className="container mt-5">
      <h1 className="title">Job List</h1>
      <Keyword
        position={position}
        setPosition={setPosition}
        location={location}
        setLocation={setLocation}
      />
      <div className="jobCard d-flex flex-wrap gap-3">
        {jobs.map((job, index) => (
          <Card
            key={index}
            title={job.title}
            link={job.link}
            company={job.company}
            location={job.location}
          />
        ))}
      </div>
    </div>
  );
}

export default HomePage;
