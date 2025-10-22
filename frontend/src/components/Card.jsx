import React from "react";

function Card({ title, company, location, link, source }) {
  return (
    <div className="card" style={{ width: "18rem", marginBottom: "1rem" }}>
      <div className="card-body">
        <h5 className="card-title">{title}</h5>
        <h6 className="card-subtitle mb-2 text-body-secondary">{company}</h6>
        <p className="card-text">{location}</p>
        <p className="card-text">
          <strong>{source}</strong>
        </p>
        <a href={link} className="card-link" target="_blank" rel="noopener noreferrer">
          View Job
        </a>
      </div>
    </div>
  );
}

export default Card;
