import React, { useEffect, useState } from "react";
import "./SearchBar.css";
import rcaLogo from "../rca.png";

function SearchBar({ search, setSearch, onSearch }) {
  const titleText = "Find Your Past Papers & Notes";
  const [typedTitle, setTypedTitle] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const delay = isDeleting ? 45 : 80;
    const pauseDelay = typedTitle === titleText && !isDeleting ? 1600 : delay;
    const restartDelay = typedTitle === "" && isDeleting ? 550 : pauseDelay;

    const timeout = setTimeout(() => {
      if (!isDeleting && typedTitle === titleText) {
        setIsDeleting(true);
        return;
      }

      if (isDeleting && typedTitle === "") {
        setIsDeleting(false);
        return;
      }

      setTypedTitle((value) =>
        isDeleting
          ? titleText.slice(0, Math.max(value.length - 1, 0))
          : titleText.slice(0, value.length + 1)
      );
    }, restartDelay);

    return () => clearTimeout(timeout);
  }, [isDeleting, typedTitle, titleText]);

  return (
    <div className="search-banner">
      <div className="banner-inner">
        <div className="banner-text">
          <h1 className="banner-title" aria-label={titleText}>
            <span className="banner-title-reserve" aria-hidden="true">{titleText}</span>
            <span className="banner-title-typed" aria-hidden="true">
              {typedTitle || "\u00a0"}
              <span className="typing-cursor" aria-hidden="true" />
            </span>
          </h1>
          <p className="banner-subtitle">
            Access all Rwanda Coding Academy study materials<br />
            for Years 1, 2, and 3 in one place.
          </p>

          <div className="banner-search">
            <span className="banner-search-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search by title, subject, or keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
            />
            <button className="search-btn" onClick={onSearch}>
              Search →
            </button>
          </div>

          <div className="banner-filters">
            <div className="filter-group">
              <span className="filter-label">Year:</span>
              <select className="filter-select">
                <option>All Years</option>
                <option>Year 1</option>
                <option>Year 2</option>
                <option>Year 3</option>
              </select>
            </div>
            <div className="filter-group">
              <span className="filter-label">Subject:</span>
              <select className="filter-select">
                <option>All Subjects</option>
                <option>Mathematics</option>
                <option>Physics</option>
                <option>English</option>
              </select>
            </div>
            <div className="filter-group">
              <span className="filter-label">Type:</span>
              <select className="filter-select">
                <option>All Types</option>
                <option>Past Papers</option>
                <option>Notes</option>
              </select>
            </div>
          </div>
        </div>

        {/* Hero image illustration */}
        <div className="banner-hero-img">
          <img src={rcaLogo} className="hero-img-element" alt="RCA illustration" />
        </div>
      </div>
    </div>
  );
}

export default SearchBar;
