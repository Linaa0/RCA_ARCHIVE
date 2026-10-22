// Same class list as client/src/components/ui/ClassChips.jsx (RCA_CLASSES)
const CLASSES = [
  { id: "Y1A", label: "Year 1A", year: 1 },
  { id: "Y1B", label: "Year 1B", year: 1 },
  { id: "Y1C", label: "Year 1C", year: 1 },
  { id: "Y1GenAI", label: "Year 1 Gen AI", year: 1 },
  { id: "Y2A", label: "Year 2A", year: 2 },
  { id: "Y2B", label: "Year 2B", year: 2 },
  { id: "Y2C", label: "Year 2C", year: 2 },
  { id: "Y3A", label: "Year 3A", year: 3 },
  { id: "Y3B", label: "Year 3B", year: 3 },
  { id: "Y3C", label: "Year 3C", year: 3 },
];

const CLASS_IDS = CLASSES.map((c) => c.id);

function normalizeClass(value) {
  const v = String(value || "").trim();
  return CLASS_IDS.includes(v) ? v : "";
}

function classLabel(id) {
  return CLASSES.find((c) => c.id === id)?.label || (id ? id : "No class");
}

module.exports = { CLASSES, CLASS_IDS, normalizeClass, classLabel };
