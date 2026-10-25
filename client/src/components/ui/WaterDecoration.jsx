import React from "react";
import "./WaterDecoration.css";

export default function WaterDecoration({ variant = "subtle", className = "" }) {
  return (
    <div className={`water-decoration-container water-${variant} ${className}`} aria-hidden="true">
      <svg
        className="water-decoration-svg"
        viewBox="0 0 400 200"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="waterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#174F83" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#0B2D52" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#123D6A" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#174F83" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#2C6798" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#123D6A" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Rain streaks */}
        <g className="water-streaks" stroke="url(#waterGrad)" strokeWidth="1" strokeLinecap="round">
          <line x1="45" y1="10" x2="35" y2="45" />
          <line x1="120" y1="20" x2="110" y2="60" />
          <line x1="280" y1="15" x2="270" y2="50" />
          <line x1="340" y1="30" x2="330" y2="70" />
        </g>

        {/* Faint raindrop ripples (concentric circles) */}
        <g className="water-ripples" fill="none" stroke="url(#waterGrad)">
          <circle cx="85" cy="115" r="16" strokeWidth="1" className="ripple-c1" />
          <circle cx="85" cy="115" r="32" strokeWidth="0.8" className="ripple-c2" />
          <circle cx="85" cy="115" r="48" strokeWidth="0.5" className="ripple-c3" />

          <circle cx="310" cy="90" r="14" strokeWidth="1" className="ripple-c1" />
          <circle cx="310" cy="90" r="28" strokeWidth="0.8" className="ripple-c2" />
          <circle cx="310" cy="90" r="42" strokeWidth="0.5" className="ripple-c3" />
        </g>

        {/* Soft calm wave line near bottom edge */}
        <path
          className="water-wave-path"
          d="M0,175 C80,165 140,188 220,178 C300,168 350,182 400,174 L400,200 L0,200 Z"
          fill="url(#waveGrad)"
        />
      </svg>
    </div>
  );
}
