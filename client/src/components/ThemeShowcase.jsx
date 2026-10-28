import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Button from "./ui/Button";
import Input from "./ui/Input";
import Card from "./ui/Card";
import Badge from "./ui/Badge";
import TermBadge from "./ui/TermBadge";
import TermSelector from "./ui/TermSelector";
import Modal from "./ui/Modal";
import Select from "./ui/Select";
import { applyTheme, getThemePreference, getEffectiveTheme } from "../utils/theme";

export default function ThemeShowcase() {
  const [currentTheme, setCurrentTheme] = useState(() => getThemePreference());
  const [effectiveTheme, setEffectiveTheme] = useState(() => getEffectiveTheme());
  const [showModal, setShowModal] = useState(false);
  const [demoInput, setDemoInput] = useState("");
  const [demoPassword, setDemoPassword] = useState("secret123");
  const [demoTerm, setDemoTerm] = useState(1);
  const [demoSelect, setDemoSelect] = useState("Y1A");

  useEffect(() => {
    const handleThemeChange = (e) => {
      if (e.detail) {
        setCurrentTheme(e.detail.preference);
        setEffectiveTheme(e.detail.effective);
      }
    };
    window.addEventListener("rca-theme-change", handleThemeChange);
    return () => window.removeEventListener("rca-theme-change", handleThemeChange);
  }, []);

  const handleSetTheme = (theme) => {
    applyTheme(theme);
    setCurrentTheme(theme);
    setEffectiveTheme(getEffectiveTheme(theme));
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--color-bg)",
        color: "var(--color-ink)",
        padding: "40px 24px",
        fontFamily: "var(--font-family, 'Quicksand', sans-serif)",
        transition: "background-color 0.2s ease, color 0.2s ease",
      }}
    >
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "40px",
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "20px",
            borderBottom: "1px solid var(--color-border-med)",
            paddingBottom: "24px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
              <Link
                to="/home"
                style={{
                  color: "var(--color-indigo-500)",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Back to Home
              </Link>
              <span style={{ color: "var(--color-muted)" }}>/</span>
              <span style={{ color: "var(--color-muted)", fontSize: "0.875rem" }}>Developer Tools</span>
            </div>
            <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: 0, color: "var(--color-ink)" }}>
              Theme and Design System Showcase
            </h1>
            <p style={{ margin: "6px 0 0 0", color: "var(--color-muted)", fontSize: "0.95rem" }}>
              Live verification gallery for light and dark mode tokens, typography, and contrast compliance.
            </p>
          </div>

          {/* Theme Selector Controls */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "var(--color-surface)",
              padding: "6px",
              borderRadius: "12px",
              border: "1px solid var(--color-border-med)",
            }}
          >
            <button
              type="button"
              onClick={() => handleSetTheme("light")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.85rem",
                backgroundColor: currentTheme === "light" ? "var(--color-indigo-500)" : "transparent",
                color: currentTheme === "light" ? "#FFFFFF" : "var(--color-muted)",
                transition: "all 0.15s ease",
              }}
            >
              Light
            </button>
            <button
              type="button"
              onClick={() => handleSetTheme("dark")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.85rem",
                backgroundColor: currentTheme === "dark" ? "var(--color-indigo-500)" : "transparent",
                color: currentTheme === "dark" ? "#0F1424" : "var(--color-muted)",
                transition: "all 0.15s ease",
              }}
            >
              Dark
            </button>
            <button
              type="button"
              onClick={() => handleSetTheme("system")}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.85rem",
                backgroundColor: currentTheme === "system" ? "var(--color-indigo-500)" : "transparent",
                color: currentTheme === "system" ? (effectiveTheme === "dark" ? "#0F1424" : "#FFFFFF") : "var(--color-muted)",
                transition: "all 0.15s ease",
              }}
            >
              System ({effectiveTheme})
            </button>
          </div>
        </div>

        {/* Section: Elevation and Surfaces */}
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "16px", color: "var(--color-ink)" }}>
            Elevation and Surfaces
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "20px",
            }}
          >
            <div
              style={{
                backgroundColor: "var(--color-bg)",
                border: "1px solid var(--color-border-strong)",
                borderRadius: "16px",
                padding: "24px",
              }}
            >
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--color-muted)", marginBottom: "4px" }}>
                Level 0: Canvas
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--color-ink)" }}>
                var(--color-bg)
              </div>
              <p style={{ fontSize: "0.85rem", color: "var(--color-tertiary)", marginTop: "8px" }}>
                Base viewport canvas background for the application layout.
              </p>
            </div>

            <div
              style={{
                backgroundColor: "var(--color-bg-subtle)",
                border: "1px solid var(--color-border-med)",
                borderRadius: "16px",
                padding: "24px",
              }}
            >
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--color-muted)", marginBottom: "4px" }}>
                Level 1: Sub-canvas
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--color-ink)" }}>
                var(--color-bg-subtle)
              </div>
              <p style={{ fontSize: "0.85rem", color: "var(--color-tertiary)", marginTop: "8px" }}>
                Main inner workspace panels, subtle grouping areas, and side navigation.
              </p>
            </div>

            <div
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border-med)",
                borderRadius: "16px",
                padding: "24px",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--color-muted)", marginBottom: "4px" }}>
                Level 2: Surface Card
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--color-ink)" }}>
                var(--color-surface)
              </div>
              <p style={{ fontSize: "0.85rem", color: "var(--color-tertiary)", marginTop: "8px" }}>
                Cards, lists, table containers, and standard interactive panels.
              </p>
            </div>

            <div
              style={{
                backgroundColor: "var(--color-surface-raised, var(--color-surface))",
                border: "1px solid var(--color-border-strong)",
                borderRadius: "16px",
                padding: "24px",
                boxShadow: "var(--shadow-modal)",
              }}
            >
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--color-muted)", marginBottom: "4px" }}>
                Level 3: Raised Modal
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--color-ink)" }}>
                var(--color-surface-raised)
              </div>
              <p style={{ fontSize: "0.85rem", color: "var(--color-tertiary)", marginTop: "8px" }}>
                Floating dialogues, dropdown menus, flyout popovers, and alerts.
              </p>
            </div>
          </div>
        </div>

        {/* Section: Typography and Contrast */}
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "16px", color: "var(--color-ink)" }}>
            Typography Hierarchy and Contrast
          </h2>
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border-med)",
              borderRadius: "16px",
              padding: "28px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div>
              <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-muted)", fontWeight: 700 }}>
                Primary Text (var(--color-ink))
              </div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-ink)" }}>
                Rwanda Coding Academy Archive System
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-muted)", fontWeight: 700 }}>
                Secondary Muted (var(--color-muted))
              </div>
              <div style={{ fontSize: "1rem", color: "var(--color-muted)" }}>
                High contrast secondary body copy and field descriptions calibrated for WCAG compliance.
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-muted)", fontWeight: 700 }}>
                Tertiary Metadata (var(--color-tertiary))
              </div>
              <div style={{ fontSize: "0.875rem", color: "var(--color-tertiary)" }}>
                Timestamps, file size annotations, paper IDs, and helper hints.
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-muted)", fontWeight: 700 }}>
                Accent Link (var(--color-indigo-500))
              </div>
              <a
                href="#demo"
                onClick={(e) => e.preventDefault()}
                style={{ fontSize: "0.95rem", color: "var(--color-indigo-500)", fontWeight: 600, textDecoration: "underline" }}
              >
                https://archive.innov.rw/api/public/curriculum
              </a>
            </div>
          </div>
        </div>

        {/* Section: Term Badges and Unified Blue Accents */}
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "16px", color: "var(--color-ink)" }}>
            Academic Terms (Unified Blue Accents)
          </h2>
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border-med)",
              borderRadius: "16px",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            <p style={{ margin: 0, color: "var(--color-muted)", fontSize: "0.9rem" }}>
              All terms utilize calm, unified RCA blue accents without discordant green or orange colors.
            </p>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
              <TermBadge term={1} />
              <TermBadge term={2} />
              <TermBadge term={3} />
            </div>

            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--color-ink)", marginBottom: "8px" }}>
                Interactive Term Selector:
              </div>
              <TermSelector
                value={demoTerm}
                onChange={(t) => setDemoTerm(t)}
                id="showcase-term-selector"
              />
            </div>
          </div>
        </div>

        {/* Section: Buttons */}
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "16px", color: "var(--color-ink)" }}>
            Buttons
          </h2>
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border-med)",
              borderRadius: "16px",
              padding: "24px",
              display: "flex",
              gap: "16px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <Button variant="primary">Primary Button</Button>
            <Button variant="secondary">Secondary Button</Button>
            <Button variant="outline">Outline Button</Button>
            <Button variant="danger">Danger Button</Button>
            <Button variant="primary" disabled>Disabled Button</Button>
          </div>
        </div>

        {/* Section: Form Inputs and Show/Hide Password Eye Toggle */}
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "16px", color: "var(--color-ink)" }}>
            Form Inputs and Password Visibility Toggle
          </h2>
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border-med)",
              borderRadius: "16px",
              padding: "24px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "20px",
            }}
          >
            <Input
              label="Standard Text Input"
              placeholder="e.g. Data Structures"
              value={demoInput}
              onChange={(e) => setDemoInput(e.target.value)}
              helperText="Helper message underneath input."
            />

            <Input
              label="Password Input (Auto Eye Toggle)"
              type="password"
              placeholder="Enter secure password"
              value={demoPassword}
              onChange={(e) => setDemoPassword(e.target.value)}
              helperText="Click the eye icon to inspect or conceal."
            />

            <Input
              label="Input with Error State"
              value="Invalid format entered"
              error="Please enter a valid academic code."
              onChange={() => {}}
            />

            <Select
              label="Cohort Selector"
              value={demoSelect}
              onChange={(e) => setDemoSelect(e.target.value)}
              options={[
                { value: "Y1A", label: "Year 1 A" },
                { value: "Y1B", label: "Year 1 B" },
                { value: "Y1C", label: "Year 1 C" },
                { value: "Y1GenAI", label: "Year 1 GenAI" },
              ]}
            />
          </div>
        </div>

        {/* Section: Semantic Status Badges */}
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "16px", color: "var(--color-ink)" }}>
            Status Badges
          </h2>
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border-med)",
              borderRadius: "16px",
              padding: "24px",
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <Badge variant="success">Active Verified</Badge>
            <Badge variant="warning">Pending Review</Badge>
            <Badge variant="danger">Revoked Session</Badge>
            <Badge variant="info">Curriculum Y1</Badge>
            <Badge variant="neutral">Archived</Badge>
          </div>
        </div>

        {/* Section: Modal Dialogue Test */}
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "16px", color: "var(--color-ink)" }}>
            Modal Dialog Window
          </h2>
          <div
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border-med)",
              borderRadius: "16px",
              padding: "24px",
            }}
          >
            <Button variant="primary" onClick={() => setShowModal(true)}>
              Open Verification Modal
            </Button>

            <Modal
              isOpen={showModal}
              onClose={() => setShowModal(false)}
              title="Verification Modal Preview"
              description="Demonstrating modal surface elevation, high-contrast typography, and backdrop blur."
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <p style={{ margin: 0, color: "var(--color-muted)", fontSize: "0.925rem" }}>
                  This modal window renders using Level 3 surface tokens with full WCAG contrast standards.
                </p>
                <Input
                  label="Sample Confirmation Field"
                  placeholder="Type CONFIRM to proceed"
                  value=""
                  onChange={() => {}}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "8px" }}>
                  <Button variant="secondary" onClick={() => setShowModal(false)}>
                    Close
                  </Button>
                  <Button variant="primary" onClick={() => setShowModal(false)}>
                    Confirm
                  </Button>
                </div>
              </div>
            </Modal>
          </div>
        </div>
      </div>
    </div>
  );
}
