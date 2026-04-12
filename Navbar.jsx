import { Link } from "react-router-dom";
import "./Navbar.css";

function Navbar() {
  return (
    <div className="nav">
    <nav className="navbar">
      <h1>RCA Past Papers & Notes</h1>
      <Link to="/login" className="login-btn">Admin Login</Link>
    </nav>
    </div>
  );
}

export default Navbar;
