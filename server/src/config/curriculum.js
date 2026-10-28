/**
 * RCA Archive Curriculum Single Source of Truth
 *
 * Defines the academic promotions (Y1, Y1 GenAI, Y2, Y3), their associated cohort classes,
 * and the exact accredited syllabus subjects taught per promotion.
 */

const PROMOTIONS = [
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
      "Computer Basics",
      "Short Courses",
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

const PROMOTION_IDS = PROMOTIONS.map((p) => p.id);

function getPromotions() {
  return PROMOTIONS;
}

function getPromotionById(id) {
  if (!id) return null;
  const normalized = String(id).trim();
  return PROMOTIONS.find((p) => p.id.toLowerCase() === normalized.toLowerCase()) || null;
}

function getPromotionForClass(classId) {
  if (!classId) return null;
  const normalized = String(classId).trim().toUpperCase();
  return (
    PROMOTIONS.find((p) =>
      p.classes.some((c) => c.toUpperCase() === normalized)
    ) || null
  );
}

function getSubjectsForPromotion(promotionId) {
  const promo = getPromotionById(promotionId);
  return promo ? promo.subjects : [];
}

function getSubjectsForClass(classId) {
  const promo = getPromotionForClass(classId);
  return promo ? promo.subjects : [];
}

function getAllSubjects() {
  const set = new Set();
  for (const promo of PROMOTIONS) {
    for (const sub of promo.subjects) {
      set.add(sub);
    }
  }
  return Array.from(set);
}

function isValidSubject(identifier, subjectName) {
  if (!subjectName) return false;
  const promo = getPromotionById(identifier) || getPromotionForClass(identifier);
  if (!promo) return getAllSubjects().includes(subjectName);
  return promo.subjects.includes(subjectName);
}

module.exports = {
  PROMOTIONS,
  PROMOTION_IDS,
  getPromotions,
  getPromotionById,
  getPromotionForClass,
  getSubjectsForPromotion,
  getSubjectsForClass,
  getAllSubjects,
  isValidSubject,
};
