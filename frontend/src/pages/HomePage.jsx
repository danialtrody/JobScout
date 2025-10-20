import React, { useState, useEffect } from "react";
import Card from "../components/Card";
import Keyword from "../components/KeyWords";

function HomePage() {

  const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:3000/api/jobs";
  

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
      <div className="text-center mt-10">
        <p className="text-lg font-semibold mb-2">
          🔍 We are searching for the latest job positions posted in the last 24 hours...
        </p>
        <p className="text-gray-600 mb-4">
          Please be patient, it may take a few seconds to gather the most relevant opportunities.
        </p>
        <p className="text-gray-500">
          ☕ Grab a coffee or stretch while we fetch the newest roles just for you!
        </p>
        <div className="mt-6 flex justify-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div>
        </div>
      </div>
    );
  

  return (
    <div className="container mt-5">
      <h1 className="mb-4">Job List</h1>
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
