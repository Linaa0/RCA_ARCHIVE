import React from "react";
import "./SearchBar.css";

function SearchBar({ search, setSearch, onSearch }) {
  return (
    <div className="search-banner">
      <h1 className="banner-title">Find Your Past Papers & Notes</h1>
      <p className="banner-subtitle">
        Access all Rwanda Coding Academy Years 1, 2, and 3 study materials in one place
      </p>
      <div className="banner-search">
        <input
          type="text"
          placeholder="Search by title, subject..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
        />
        <button className="search-btn" onClick={onSearch}>Search</button>
      </div>
    </div>
  );
}

export default SearchBar;