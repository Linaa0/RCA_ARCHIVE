import React from "react";
import { CalendarIcon } from "../ui/Icons";
import { getStoredUser } from "../../utils/auth";

function greetingFor(date) {
  const h = date.getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Day";
  return "Good Evening";
}

// Illustration (inline SVG, no image files needed)
function TeacherIllustration() {
  return (
    <svg viewBox="0 0 360 190" role="img" aria-label="Teacher illustration">
      {/* floating objects */}
      <g opacity=".95">
        <rect x="40" y="26" width="30" height="22" rx="4" fill="#fff" transform="rotate(-12 55 37)" />
        <rect x="46" y="31" width="18" height="3" rx="1.5" fill="#C7D2FE" transform="rotate(-12 55 37)" />
        <rect x="46" y="37" width="14" height="3" rx="1.5" fill="#C7D2FE" transform="rotate(-12 55 37)" />
        <circle cx="120" cy="34" r="6" fill="#8FA2F0" />
        <path d="M300 30l8 4-8 4-8-4z" fill="#fff" />
        <path d="M296 37v7c0 3 8 3 8 0v-7" fill="none" stroke="#fff" strokeWidth="2" />
        <circle cx="336" cy="70" r="7" fill="#6EE7B7" />
        <path d="M336 66v8M332 70h8" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
        <rect x="66" y="96" width="9" height="36" rx="4.5" fill="#FBBF77" transform="rotate(30 70 114)" />
        <path d="M60 134l-3 9 9-3z" fill="#FDE68A" transform="rotate(30 70 114)" />
        <path d="M262 112l4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1z" fill="#FCD34D" transform="scale(.8) translate(66 20)" />
        <path d="M290 122h34v26a10 10 0 0 1-10 10h-14a10 10 0 0 1-10-10z" fill="#fff" />
        <path d="M324 128h6a6 6 0 0 1 0 14h-6" fill="none" stroke="#fff" strokeWidth="4" />
        <circle cx="96" cy="150" r="4" fill="#fff" opacity=".6" />
      </g>

      {/* body */}
      <path d="M118 190v-26c0-22 18-38 62-38s62 16 62 38v26z" fill="#fff" />
      <path d="M164 128l16 26 16-26z" fill="#E4E8FA" />
      <path d="M176 130h8l4 30-8 6-8-6z" fill="#10B981" />
      {/* lanyard + badge */}
      <path d="M154 126c4 18 8 34 14 40M206 126c-4 18-8 34-14 40" stroke="#5B73E0" strokeWidth="3" fill="none" />
      <rect x="170" y="160" width="20" height="26" rx="4" fill="#E4E8FA" stroke="#5B73E0" strokeWidth="2" />
      {/* arms crossed */}
      <path d="M126 176c10-18 32-24 54-18" stroke="#E4E8FA" strokeWidth="18" strokeLinecap="round" fill="none" />
      <path d="M234 176c-10-18-32-24-54-18" stroke="#fff" strokeWidth="18" strokeLinecap="round" fill="none" />
      <circle cx="132" cy="170" r="8" fill="#F6C9A6" />
      <circle cx="228" cy="170" r="8" fill="#F6C9A6" />
      {/* neck + head */}
      <rect x="170" y="106" width="20" height="24" rx="8" fill="#F6C9A6" />
      <ellipse cx="180" cy="86" rx="30" ry="34" fill="#F6C9A6" />
      <ellipse cx="150" cy="90" rx="5" ry="8" fill="#F6C9A6" />
      <ellipse cx="210" cy="90" rx="5" ry="8" fill="#F6C9A6" />
      {/* hair */}
      <path d="M148 80c-4-30 18-44 38-40 22 4 32 20 26 42-4-14-12-22-26-24-14 4-26 8-38 22z" fill="#2B2A4C" />
      {/* face */}
      <circle cx="168" cy="88" r="3" fill="#2B2A4C" />
      <circle cx="194" cy="88" r="3" fill="#2B2A4C" />
      <path d="M168 102c6 8 20 8 26 0" stroke="#B45309" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="160" cy="98" r="5" fill="#F9A8A8" opacity=".55" />
      <circle cx="202" cy="98" r="5" fill="#F9A8A8" opacity=".55" />
      {/* glasses */}
      <circle cx="168" cy="88" r="9" fill="none" stroke="#2B2A4C" strokeWidth="2" />
      <circle cx="194" cy="88" r="9" fill="none" stroke="#2B2A4C" strokeWidth="2" />
      <path d="M177 88h8" stroke="#2B2A4C" strokeWidth="2" />
    </svg>
  );
}

export default function TeacherHero() {
  const user = getStoredUser();
  const now = new Date();
  const dateText = now.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const weekday = now.toLocaleDateString(undefined, { weekday: "long" });

  return (
    <section className="th-hero">
      <div className="th-hero-text">
        <div className="th-date-chip">
          <CalendarIcon size={14} />
          <span>{dateText}</span>
        </div>
        <h1>
          {greetingFor(now)}, {user.username || "Teacher"}!
        </h1>
        <p>Have a Nice {weekday}!</p>
      </div>
      <div className="th-hero-art">
        <TeacherIllustration />
      </div>
    </section>
  );
}
