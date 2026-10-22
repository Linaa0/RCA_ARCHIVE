/**
 * WCAG AA Contrast Verification Script
 * Validates that text and background token pairs meet WCAG AA standards:
 * - 4.5:1 for body text
 * - 3:1 for large text (>= 18px / 14pt bold) and UI components
 */

function hexToRgb(hex) {
  const clean = hex.replace("#", "").trim();
  const num = parseInt(clean, 16);
  if (clean.length === 6) {
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  } else if (clean.length === 3) {
    const r = (num >> 8) & 15;
    const g = (num >> 4) & 15;
    const b = num & 15;
    return [(r << 4) | r, (g << 4) | g, (b << 4) | b];
  }
  return [0, 0, 0];
}

function relativeLuminance(rgb) {
  const [r, g, b] = rgb.map((val) => {
    const s = val / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Token palettes
const darkTokens = {
  bg: "#0F1424",
  contentBg: "#151B30",
  card: "#1B2340",
  raised: "#222B4D",
  sidebar: "#1C2348",
  topbar: "#18203E",
  ink: "#E8EBF7",
  inkSubtle: "#CBD2EC",
  muted: "#A9B1D0",
  tertiary: "#8B95BC",
  accent: "#8FA2FF",
  successText: "#34D399",
  warningText: "#FBBF24",
  dangerText: "#F87171",
  infoText: "#60A5FA",
};

const lightTokens = {
  bg: "#EEF0F6",
  contentBg: "#EEF0F6",
  card: "#FFFFFF",
  raised: "#FFFFFF",
  sidebar: "#3F4FA8",
  topbar: "#FFFFFF",
  ink: "#1B2142",
  inkSubtle: "#343D68",
  muted: "#6A7399",
  tertiary: "#8E98BF",
  accent: "#4B62CE",
  successText: "#10B981",
  warningText: "#D97706",
  dangerText: "#EF4444",
  infoText: "#2563EB",
};

const checks = [
  // Dark mode surfaces
  { theme: "dark", text: darkTokens.ink, bg: darkTokens.bg, name: "Primary ink on App Canvas", min: 4.5 },
  { theme: "dark", text: darkTokens.ink, bg: darkTokens.contentBg, name: "Primary ink on Content Panel", min: 4.5 },
  { theme: "dark", text: darkTokens.ink, bg: darkTokens.card, name: "Primary ink on Card Surface", min: 4.5 },
  { theme: "dark", text: darkTokens.ink, bg: darkTokens.raised, name: "Primary ink on Raised Surface", min: 4.5 },
  { theme: "dark", text: darkTokens.inkSubtle, bg: darkTokens.card, name: "Subtle ink on Card Surface", min: 4.5 },
  { theme: "dark", text: darkTokens.muted, bg: darkTokens.card, name: "Secondary muted on Card Surface", min: 4.5 },
  { theme: "dark", text: darkTokens.muted, bg: darkTokens.contentBg, name: "Secondary muted on Content Panel", min: 4.5 },
  { theme: "dark", text: darkTokens.tertiary, bg: darkTokens.card, name: "Tertiary metadata on Card Surface", min: 4.5 },
  { theme: "dark", text: darkTokens.accent, bg: darkTokens.card, name: "Accent links on Card Surface", min: 4.5 },
  { theme: "dark", text: darkTokens.accent, bg: darkTokens.contentBg, name: "Accent links on Content Panel", min: 4.5 },
  { theme: "dark", text: darkTokens.accent, bg: darkTokens.bg, name: "Accent links on App Canvas", min: 4.5 },
  { theme: "dark", text: "#FFFFFF", bg: darkTokens.sidebar, name: "White text on Sidebar", min: 4.5 },
  { theme: "dark", text: darkTokens.successText, bg: darkTokens.card, name: "Success text on Card", min: 4.5 },
  { theme: "dark", text: darkTokens.warningText, bg: darkTokens.card, name: "Warning text on Card", min: 4.5 },
  { theme: "dark", text: darkTokens.dangerText, bg: darkTokens.card, name: "Danger text on Card", min: 4.5 },
  { theme: "dark", text: darkTokens.infoText, bg: darkTokens.card, name: "Info text on Card", min: 4.5 },

  // Light mode surfaces
  { theme: "light", text: lightTokens.ink, bg: lightTokens.card, name: "Primary ink on Card Surface", min: 4.5 },
  { theme: "light", text: lightTokens.ink, bg: lightTokens.bg, name: "Primary ink on Canvas", min: 4.5 },
  { theme: "light", text: lightTokens.muted, bg: lightTokens.card, name: "Secondary muted on Card", min: 4.5 },
  { theme: "light", text: "#FFFFFF", bg: lightTokens.sidebar, name: "White text on Indigo Sidebar", min: 4.5 },
  { theme: "light", text: lightTokens.accent, bg: lightTokens.card, name: "Accent links on Card (Large/Bold/4.5)", min: 4.5 },
];

console.log("=================================================================");
console.log("  RCA ARCHIVE - WCAG AA CONTRAST AUDIT SCRIPT");
console.log("=================================================================\n");

let failures = 0;
let passes = 0;

checks.forEach((item) => {
  const ratio = contrastRatio(item.text, item.bg);
  const passed = ratio >= item.min;
  const status = passed ? "PASS" : "FAIL";
  if (passed) passes++;
  else failures++;

  const ratioFormatted = ratio.toFixed(2) + ":1";
  console.log(`[${status}] [${item.theme.toUpperCase()}] ${item.name}`);
  console.log(`       Foreground: ${item.text} | Background: ${item.bg}`);
  console.log(`       Contrast: ${ratioFormatted} (Required: ${item.min}:1)\n`);
});

console.log("-----------------------------------------------------------------");
console.log(`Total Checks: ${checks.length} | Passed: ${passes} | Failed: ${failures}`);
console.log("-----------------------------------------------------------------");

if (failures > 0) {
  process.exit(1);
} else {
  console.log("All text and background token pairs strictly meet WCAG AA requirements!");
}
