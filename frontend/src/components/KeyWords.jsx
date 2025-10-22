import React, { useState } from "react";

function Keyword(props) {
  const [tempPosition, setTempPosition] = useState(props.position);
  const [tempLocation, setTempLocation] = useState(props.location);

  const handleSearch = () => {
    props.setPosition(tempPosition);
    props.setLocation(tempLocation);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

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
        onKeyDown={handleKeyDown}
      />
      <input
        type="text"
        className="form-control"
        placeholder="Location"
        value={tempLocation}
        onChange={(e) => setTempLocation(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        className="btn btn-primary"
        type="button"
        onClick={handleSearch}
      >
        Search
      </button>
    </div>
  );
}

export default Keyword;
