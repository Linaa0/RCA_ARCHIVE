import React from "react";
import { Link } from "react-router-dom";
import "./Login.css";

function Login() {
  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Rwanda Coding Academy</h2>
        <p className="subtitle">Past Papers & Notes System — Admin Login</p>
        
        <form>
          <label>Username</label>
          <input type="text" placeholder="Enter username" />
          
          <label>Password</label>
          <input type="password" placeholder="Enter password" />
          
          <button type="submit" className="login-btn">Login</button>
        </form>

        {/* Back to Home link */}
        <Link to="/" className="back-link">← Back to Home</Link>
      </div>
    </div>
  );
}

export default Login;
