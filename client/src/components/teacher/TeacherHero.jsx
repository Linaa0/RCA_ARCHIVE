import React from "react";
import { CalendarIcon } from "../ui/Icons";
import { getStoredUser } from "../../utils/auth";
import teacherFig from "../../assets/figures/teacher.png";

function greetingFor(date) {
  const h = date.getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Day";
  return "Good Evening";
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
        <div
          style={{
            width: "140px",
            height: "140px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.08) 100%)",
            border: "3px solid rgba(255, 255, 255, 0.4)",
            boxShadow: "0 10px 28px rgba(15, 20, 36, 0.25)",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={teacherFig}
            alt="Teacher Figure"
            loading="lazy"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center top",
              transform: "scale(1.15) translateY(4%)",
            }}
          />
        </div>
      </div>
    </section>
  );
}
