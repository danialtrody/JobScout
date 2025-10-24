import React, { useState, useEffect } from "react";
import Card from "../components/Card";
import Keyword from "../components/KeyWords";

function HomePage() {
  const BASE_URL = "http://localhost:3000/api/jobs";

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState("software engineer");
  const [location, setLocation] = useState("Israel");

  useEffect(() => {
    const getJobs = async () => {
      setLoading(true);
      const data = await fetch(`${BASE_URL}?keyword=${position}&location=${location}`)
        .then(res => res.json())
        .catch(err => {
          console.error(err);
          return [];
        });
      setJobs(data);
      setLoading(false);
    };
    getJobs();
  }, [position, location]);

  if (loading)
    return (
      <div className="loading-container">
        <p className="loading-title">🔍 Searching for jobs...</p>
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
