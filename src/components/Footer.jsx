import React from "react";
import { Link } from "react-router-dom";
import "./Footer.css";

function Footer() {
  return (
    <footer className="site-footer" id="about">
      <div className="footer-inner">
        {/* Brand */}
        <div className="footer-brand">
          <div className="footer-logo-row">
            <img src="/rwandacoding.png" alt="RCA Logo" className="footer-logo" />
            <span className="footer-brand-name">RCA ARCHIVE+</span>
          </div>
          <p className="footer-brand-desc">
            Your one-stop platform for Rwanda Coding Academy past papers, notes, and study resources.
          </p>
          <div className="footer-socials">
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
            <a href="#" className="footer-social" aria-label="Facebook">f</a>
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
            <a href="#" className="footer-social" aria-label="Twitter">𝕏</a>
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
            <a href="#" className="footer-social" aria-label="Instagram">📷</a>
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
            <a href="#" className="footer-social" aria-label="GitHub">⌥</a>
          </div>
        </div>

        {/* Quick Links */}
        <div className="footer-col">
          <h4 className="footer-col-title">Quick Links</h4>
          <ul className="footer-links">
            <li><Link to="/">› Home</Link></li>
            <li><Link to="/#subjects">› Subjects</Link></li>
            <li><Link to="/#years">› Years</Link></li>
            <li><Link to="/#about">› About Us</Link></li>
            <li><Link to="/login">› Upload Material</Link></li>
          </ul>
        </div>

        {/* Resources */}
        <div className="footer-col">
          <h4 className="footer-col-title">Resources</h4>
          <ul className="footer-links">
            <li><Link to="/#subjects">› Past Papers</Link></li>
            <li><Link to="/#subjects">› Notes</Link></li>
            <li><Link to="/?year=1#years">› Year 1 Materials</Link></li>
            <li><Link to="/?year=2#years">› Year 2 Materials</Link></li>
            <li><Link to="/?year=3#years">› Year 3 Materials</Link></li>
          </ul>
        </div>

        {/* Contact */}
        <div className="footer-col">
          <h4 className="footer-col-title">Get In Touch</h4>
          <ul className="footer-links footer-contact">
            <li><a href="mailto:archive@rca.ac.rw">archive@rca.ac.rw</a></li>
            <li>Kigali, Rwanda</li>
            <li>+250 78 123 4567</li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© 2026 Rwanda Coding Academy. All rights reserved.</span>
        <span>Built for RCA students</span>
      </div>
    </footer>
  );
}

export default Footer;
