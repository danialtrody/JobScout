import React from "react";

function Card({ title, company, location, link, source, dateTime }) {
  return (
    <div className="card" style={{ width: "18rem", marginBottom: "1rem" }}>
      <div className="card-body">
        <h5 className="card-title">{title}</h5>
        <h6 className="card-subtitle mb-2 text-body-secondary">{company}</h6>
        <p className="card-text">{location}</p>
        <p className="card-text">
          <strong>{source}</strong>
        </p>

        <div className="link-time-container" >
          <a href={link} className="card-link" target="_blank" rel="noopener noreferrer">
            View Job
          </a>
          <p className="card-text" style={{color:"rgb(1, 117, 79)", fontSize:"12px" , fontWeight:"600" , marginTop:"5px"}}>
            {dateTime}
          </p>   
        </div>

      </div>
    </div>
  );
}

export default Card;
