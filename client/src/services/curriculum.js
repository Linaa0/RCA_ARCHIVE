/**
 * Client Curriculum Service
 *
 * Reads promotions and accredited subjects from /api/curriculum with offline/cached fallback.
 * Single source of truth across all views, forms, filters, and subject pages.
 */

export const FALLBACK_PROMOTIONS = [
  {
    id: "Y1",
    label: "Year 1",
    academicYear: 1,
    classes: ["Y1A", "Y1B", "Y1C"],
    subjects: [
      "Mathematics",
      "Physics",
      "Fundamentals of Programming",
      "Database",
      "English",
      "Networking",
      "PHP",
      "JavaScript",
      "Embedded Systems",
      "Web User Interface",
      "Graphical User Interface",
    ],
  },
  {
    id: "Y1GenAI",
    label: "Year 1 GenAI",
    academicYear: 1,
    classes: ["Y1GenAI"],
    subjects: [
      "Backend",
      "FOP",
      "Mathematics",
      "AI Model Quality Assurance Operations",
      "English",
      "Physics",
      "System Networking",
      "AI-Assisted Software",
      "AI Prompt Engineering Solutions",
      "Frontend",
      "Database",
      "Computer Basics",
      "Short Courses",
    ],
  },
  {
    id: "Y2",
    label: "Year 2",
    academicYear: 2,
    classes: ["Y2A", "Y2B", "Y2C"],
    subjects: [
      "Mathematics",
      "Physics",
      "Data Structures with C++",
      "Advanced Networking",
      "OOP and Web Development with Java",
      "Software Engineering",
      "Advanced Database",
      "English",
      "Embedded Systems (Integrate Hardware with Software)",
      "Web 3 with Solidity",
      "3D Modelling with Blender",
      "Short Courses",
    ],
  },
  {
    id: "Y3",
    label: "Year 3",
    academicYear: 3,
    classes: ["Y3A", "Y3B", "Y3C"],
    subjects: [
      "Mathematics",
      "Physics",
      "Machine Learning with Python",
      "Cybersecurity",
      "DevOps",
      "English",
      "Intelligent Robotics and Some Embedded Systems",
      "Mobile Apps Development with React Native",
      "Information Technology with Project Management",
      "Short Courses",
    ],
  },
];

const STORAGE_KEY = "rca_curriculum_cache";

function getCachedCurriculum() {
  if (typeof window === "undefined") return FALLBACK_PROMOTIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    // Ignore parse error
  }
  return FALLBACK_PROMOTIONS;
}

let activePromotions = getCachedCurriculum();

import api from "./api";

export async function fetchCurriculum() {
  try {
    const { data } = await api.get("/curriculum");
    if (Array.isArray(data?.promotions) && data.promotions.length > 0) {
      activePromotions = data.promotions;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.promotions));
      } catch (e) {
        // Ignore storage errors
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("curriculum-updated", { detail: activePromotions }));
      }
      return activePromotions;
    }
  } catch (err) {
    // Fall back to cached or default
  }
  return activePromotions;
}

// Initial async fetch on load
if (typeof window !== "undefined") {
  fetchCurriculum();
}

export function getPromotions() {
  return activePromotions;
}

export function getPromotion(id) {
  if (!id) return null;
  const normalized = String(id).trim().toLowerCase();
  return activePromotions.find((p) => p.id.toLowerCase() === normalized) || null;
}

export function getPromotionForClass(classId) {
  if (!classId) return null;
  const normalized = String(classId).trim().toUpperCase();
  return (
    activePromotions.find((p) =>
      p.classes.some((c) => c.toUpperCase() === normalized)
    ) || null
  );
}

export function getSubjectsForPromotion(promotionId) {
  const promo = getPromotion(promotionId);
  return promo ? promo.subjects : [];
}

export function getSubjectsForClass(classId) {
  const promo = getPromotionForClass(classId);
  return promo ? promo.subjects : [];
}

export function getAllSubjects() {
  const set = new Set();
  for (const promo of activePromotions) {
    for (const sub of promo.subjects) {
      set.add(sub);
    }
  }
  return Array.from(set);
}

export default {
  getPromotions,
  getPromotion,
  getPromotionForClass,
  getSubjectsForPromotion,
  getSubjectsForClass,
  getAllSubjects,
  fetchCurriculum,
  FALLBACK_PROMOTIONS,
};
