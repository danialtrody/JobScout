import React, { useState } from "react";

function Keyword(props) {
  const [tempPosition, setTempPosition] = useState(props.position);
  const [tempLocation, setTempLocation] = useState(props.location);

  return (
    <div className="input-group mb-4">
      <span className="input-group-text">Job search</span>
      <input
        type="text"
        name="title"
        className="form-control"
        placeholder="Job title"
        value={tempPosition}
        onChange={(e) => setTempPosition(e.target.value)} 
      />
      <input
        type="text"
        className="form-control"
        placeholder="Location"
        value={tempLocation}
        onChange={(e) => setTempLocation(e.target.value)}
      />
      <button
        className="btn btn-primary"
        type="button"
        onClick={(e) => {
          e.preventDefault();
          props.setPosition(tempPosition);
          props.setLocation(tempLocation); 
        }}
      >
        Search
      </button>
    </div>
  );
}

export default Keyword;
