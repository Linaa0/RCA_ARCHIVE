import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import rcaLogo from "../rca.png";

function Landing() {
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    document.body.classList.toggle("light-mode", !isDarkMode);
    localStorage.setItem("darkMode", JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode((d) => !d);

  const features = [
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      ),
      title: "Easy Access",
      description: "Find past papers quickly with intuitive search and filters by year and subject"
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6" />
          <polyline points="3.9 15 8 19 12.1 15" />
        </svg>
      ),
      title: "Download & View",
      description: "View papers directly in your browser or download them for offline study"
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
      title: "Secure & Reliable",
      description: "Your account is protected with email verification and strong security measures"
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        </svg>
      ),
      title: "Organized by Year",
      description: "Browse through Year 1, Year 2, and Year 3 materials with ease"
    }
  ];

  const steps = [
    {
      number: "01",
      title: "Create Your Account",
      description: "Sign up with your email and verify it to get full access"
    },
    {
      number: "02",
      title: "Explore Subjects",
      description: "Browse through the organized list of subjects for your year"
    },
    {
      number: "03",
      title: "Find & Download",
      description: "Search or filter to find exactly what you need, then view or download"
    }
  ];

  return (
    <div className="landing-page" style={{ minHeight: "100vh" }}>
      {/* Header */}
      <header style={{
        padding: "16px 32px",
        borderBottom: "1px solid var(--border-color)",
        backgroundColor: "var(--bg-secondary)",
        position: "sticky",
        top: 0,
        zIndex: 1000
      }}>
        <div style={{
          maxWidth: "1200px",
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <img src={rcaLogo} alt="RCA" style={{
            width: "40px",
            height: "40px",
            objectFit: "contain",
            filter: isDarkMode ? "none" : "drop-shadow(0px 2px 8px rgba(0,0,0,0.25)) brightness(0.95)"
          }} />
          <div>
              <h1 style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                margin: 0,
                color: "var(--text-primary)"
              }}>RCA Archive+</h1>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={toggleDarkMode}
              style={{
                background: "var(--bg-tertiary)",
                border: "1px solid var(--border-color)",
                borderRadius: "10px",
                padding: "8px 14px",
                cursor: "pointer",
                color: "var(--text-primary)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.875rem",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--accent-primary)";
                e.currentTarget.style.boxShadow = "var(--shadow-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-color)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {isDarkMode ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
              {isDarkMode ? "Light" : "Dark"}
            </button>

            <button
              onClick={() => navigate("/login")}
              style={{
                background: "transparent",
                border: "2px solid var(--accent-primary)",
                color: "var(--accent-primary)",
                borderRadius: "10px",
                padding: "10px 20px",
                fontSize: "0.9375rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--accent-primary)";
                e.currentTarget.style.color = "white";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--accent-primary)";
              }}
            >
              Log In
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "56px 32px",
        textAlign: "center"
      }}>
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
          maxWidth: "750px",
          margin: "0 auto"
        }}>
          <img src={rcaLogo} alt="RCA" style={{
            width: "96px",
            height: "96px",
            objectFit: "contain",
            marginBottom: "4px",
            filter: isDarkMode ? "none" : "drop-shadow(0px 4px 8px rgba(0,0,0,0.15))"
          }} />

          <h1 style={{
            fontSize: "2.5rem",
            fontWeight: 700,
            lineHeight: "1.2",
            margin: 0,
            background: "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-light) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text"
          }}>
            Your Study Hub Awaits
          </h1>

          <p style={{
            fontSize: "1.0625rem",
            color: "var(--text-secondary)",
            margin: "4px 0 24px",
            lineHeight: "1.6",
            maxWidth: "650px"
          }}>
            Access a comprehensive archive of RCA past papers and study materials, organized and ready for your success
          </p>

          <div style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            justifyContent: "center"
          }}>
            <button
              onClick={() => navigate("/signup")}
              style={{
                background: "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)",
                border: "none",
                color: "white",
                borderRadius: "12px",
                padding: "12px 32px",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.35)",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(37, 99, 235, 0.45)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(37, 99, 235, 0.35)";
              }}
            >
              Get Started
            </button>

            <button
              onClick={() => navigate("/login")}
              style={{
                background: "var(--bg-secondary)",
                border: "2px solid var(--border-color)",
                color: "var(--text-primary)",
                borderRadius: "12px",
                padding: "12px 32px",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--accent-primary)";
                e.currentTarget.style.boxShadow = "var(--shadow-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-color)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              Log In
            </button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "48px 32px",
        backgroundColor: "var(--bg-secondary)",
        borderRadius: "28px 28px 0 0"
      }}>
        <div style={{
          textAlign: "center",
          marginBottom: "40px"
        }}>
          <h2 style={{
            fontSize: "1.875rem",
            fontWeight: 700,
            margin: "0 0 8px",
            color: "var(--text-primary)"
          }}>
            Why Choose RCA Archive?
          </h2>
          <p style={{
            fontSize: "1rem",
            color: "var(--text-muted)",
            margin: 0
          }}>
            Everything you need for a seamless study experience
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "20px"
        }}>
          {features.map((feature, index) => (
            <div
              key={index}
              style={{
                background: "var(--bg-primary)",
                border: "1px solid var(--border-color)",
                borderRadius: "16px",
                padding: "24px",
                transition: "all 0.3s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "var(--shadow-hover)";
                e.currentTarget.style.borderColor = "var(--accent-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.borderColor = "var(--border-color)";
              }}
            >
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-light) 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                marginBottom: "16px"
              }}>
                {feature.icon}
              </div>
              <h3 style={{
                fontSize: "1.125rem",
                fontWeight: 600,
                margin: "0 0 8px",
                color: "var(--text-primary)"
              }}>
                {feature.title}
              </h3>
              <p style={{
                margin: 0,
                color: "var(--text-muted)",
                lineHeight: "1.6",
                fontSize: "0.9375rem"
              }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "48px 32px"
      }}>
        <div style={{
          textAlign: "center",
          marginBottom: "40px"
        }}>
          <h2 style={{
            fontSize: "1.875rem",
            fontWeight: 700,
            margin: "0 0 8px",
            color: "var(--text-primary)"
          }}>
            How to Get Started
          </h2>
          <p style={{
            fontSize: "1rem",
            color: "var(--text-muted)",
            margin: 0
          }}>
            Three simple steps to access all materials
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "24px"
        }}>
          {steps.map((step, index) => (
            <div key={index} style={{
              textAlign: "center",
              padding: "28px 20px",
              background: "var(--card-bg)",
              borderRadius: "20px",
              border: "1px solid var(--border-color)"
            }}>
              <div style={{
                fontSize: "3rem",
                fontWeight: 700,
                color: "var(--accent-primary)",
                lineHeight: "1",
                marginBottom: "12px"
              }}>
                {step.number}
              </div>
              <h3 style={{
                fontSize: "1.125rem",
                fontWeight: 600,
                margin: "0 0 8px",
                color: "var(--text-primary)"
              }}>
                {step.title}
              </h3>
              <p style={{
                margin: 0,
                color: "var(--text-muted)",
                lineHeight: "1.6",
                fontSize: "0.9375rem"
              }}>
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* About Section */}
      <section id="about" style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "48px 32px",
        backgroundColor: "var(--bg-secondary)"
      }}>
        <div style={{
          maxWidth: "900px",
          margin: "0 auto"
        }}>
          <h2 style={{
            fontSize: "1.875rem",
            fontWeight: 700,
            margin: "0 0 24px",
            color: "var(--text-primary)",
            textAlign: "center"
          }}>
            About the RCA Past Papers Archive
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
            gap: "32px"
          }}>
            <div>
              <h3 style={{
                fontSize: "1.25rem",
                fontWeight: 600,
                margin: "0 0 12px",
                color: "var(--text-primary)"
              }}>
                Why It Exists
              </h3>
              <p style={{
                color: "var(--text-secondary)",
                lineHeight: "1.7",
                margin: 0,
                fontSize: "0.9375rem"
              }}>
                The RCA Past Papers Archive was created to give every student easy access to previous exam papers and study materials. 
                By organizing materials by year and subject, we make studying efficient and stress-free, helping you prepare better for your exams.
              </p>
            </div>
            <div>
              <h3 style={{
                fontSize: "1.25rem",
                fontWeight: 600,
                margin: "0 0 12px",
                color: "var(--text-primary)"
              }}>
                Our Purpose
              </h3>
              <p style={{
                color: "var(--text-secondary)",
                lineHeight: "1.7",
                margin: 0,
                fontSize: "0.9375rem"
              }}>
                We believe in accessible education. This platform ensures that all RCA students have equal opportunity to use past papers 
                as a learning resource, helping them understand exam patterns and prepare effectively.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{
        background: "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)",
        padding: "48px 32px",
        textAlign: "center"
      }}>
        <div style={{ maxWidth: "700px", margin: "0 auto" }}>
          <h2 style={{
            fontSize: "1.875rem",
            fontWeight: 700,
            margin: "0 0 12px",
            color: "white"
          }}>
            Ready to Excel?
          </h2>
          <p style={{
            fontSize: "1rem",
            margin: "0 0 24px",
            color: "rgba(255, 255, 255, 0.9)"
          }}>
            Join thousands of RCA students using this archive for their studies
          </p>
          <div style={{
            display: "flex",
            gap: "12px",
            justifyContent: "center",
            flexWrap: "wrap"
          }}>
            <button
              onClick={() => navigate("/signup")}
              style={{
                background: "white",
                border: "none",
                color: "var(--accent-primary)",
                borderRadius: "12px",
                padding: "12px 32px",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.2)";
              }}
            >
              Create Your Account
            </button>
            <button
              onClick={() => navigate("/login")}
              style={{
                background: "transparent",
                border: "2px solid white",
                color: "white",
                borderRadius: "12px",
                padding: "12px 32px",
                fontSize: "1rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "white";
                e.currentTarget.style.color = "var(--accent-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "white";
              }}
            >
              Log In
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: "32px",
        textAlign: "center",
        color: "var(--text-muted)",
        borderTop: "1px solid var(--border-color)",
        fontSize: "0.875rem"
      }}>
        <p style={{ margin: 0 }}>
          © {new Date().getFullYear()} RCA Past Papers Archive. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

export default Landing;