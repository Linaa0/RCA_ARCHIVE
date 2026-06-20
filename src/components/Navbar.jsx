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
    localStorage.removeItem("email");
    localStorage.removeItem("role");
    navigate("/login");
    window.location.reload();
  };

  const initial = username ? username.charAt(0).toUpperCase() : "U";

  return (
    <div className="nav">
      <nav className="navbar">
        <div className="nav-left">
          <img src="/rwandacoding.png" alt="Rwanda Coding Logo" className="navbar-logo" />
          <span className="nav-brand">RCA ARCHIVE+</span>
        </div>



        <div className="nav-right">
          {token ? (
            <>
              <span className="welcome-text">{username}</span>
              <div className="user-avatar">{initial}</div>
              <button onClick={handleLogout} className="logout-btn">Logout</button>
            </>
          ) : (
            <Link to="/login" className="login-btn">Login / Sign Up</Link>
          )}
        </div>
      </nav>
    </div>
  );
}

export default Navbar;