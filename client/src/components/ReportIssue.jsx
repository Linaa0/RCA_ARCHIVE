import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./ReportIssue.css";

function ReportIssue() {
  const username = localStorage.getItem("username") || "";
  const email = localStorage.getItem("email") || "";
  const [form, setForm] = useState({
    name: username,
    email,
    issueType: "Bug",
    title: "",
    details: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const subject = encodeURIComponent(`RCA Archive Issue: ${form.title || form.issueType}`);
    const body = encodeURIComponent(
      [
        `Issue type: ${form.issueType}`,
        `Name: ${form.name || "Not provided"}`,
        `Email: ${form.email || "Not provided"}`,
        "",
        "Issue:",
        form.title,
        "",
        "Details:",
        form.details,
      ].join("\n")
    );

    setSubmitted(true);

    const mailto = `mailto:chretiensano@gmail.com,isabelleutuje78@gmail.com,mucyoasifiwe80@gmail.com?subject=${subject}&body=${body}`;
    setTimeout(() => {
      window.location.href = mailto;
    }, 500);
  };

  if (submitted) {
    return (
      <main className="report-issue-page">
        <section className="report-issue-panel report-issue-submitted">
          <div className="report-issue-header">
            <span className="report-issue-kicker">Support</span>
            <h1>Thank you</h1>
            <p>Your issue report has been submitted. We appreciate your help fixing RCA Archive+.</p>
          </div>
          <div className="report-issue-summary">
            <p>Please check your email client to complete sending the report if it did not open automatically.</p>
            <Link to="/home" className="back-home-link">
              ← Back to home
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="report-issue-page">
      <section className="report-issue-panel">
        <div className="report-issue-header">
          <span className="report-issue-kicker">Support</span>
          <h1>Report an Issue</h1>
          <p>Tell us what went wrong in RCA Archive+ so it can be checked and fixed.</p>
          <Link to="/" className="back-home-link">
            ← Back to home
          </Link>
        </div>

        <form className="report-issue-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <label>
              Name
              <input
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                placeholder="Your name"
              />
            </label>
            <label>
              Email
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="your.email@example.com"
              />
            </label>
          </div>

          <label>
            Issue type
            <select name="issueType" value={form.issueType} onChange={handleChange}>
              <option>Bug</option>
              <option>Missing paper</option>
              <option>Wrong file</option>
              <option>Download problem</option>
              <option>Account problem</option>
              <option>Other</option>
            </select>
          </label>

          <label>
            Short title
            <input
              name="title"
              type="text"
              value={form.title}
              onChange={handleChange}
              placeholder="Example: Year 2 Physics paper does not download"
              required
            />
          </label>

          <label>
            Details
            <textarea
              name="details"
              value={form.details}
              onChange={handleChange}
              placeholder="Describe where you found the issue and what happened."
              rows="7"
              required
            />
          </label>

          <button className="report-submit-btn" type="submit">
            Send Report
          </button>
        </form>
      </section>
    </main>
  );
}

export default ReportIssue;
