import React from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Navbar.css";

function Navbar() {
  const navigate = useNavigate();
  const username = localStorage.getItem("username");
  const token = localStorage.getItem("token");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("role");
    navigate("/login");
    window.location.reload();
  };

  return (
    <div className="nav">
      <nav className="navbar">
        <div className="nav-left">
          <img src="/rwandacoding.png" alt="Rwanda Coding Logo" className="navbar-logo" />
          <h1>RCA ARCHIVE+</h1>
        </div>
        <div className="nav-right">
          {token ? (
            <>
              <span className="welcome-text">{username}</span>
              <button onClick={handleLogout} className="logout-btn">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="login-btn">Login / Sign Up</Link>
            </>
          )}
        </div>
      </nav>
    </div>
  );
}

export default Navbar;