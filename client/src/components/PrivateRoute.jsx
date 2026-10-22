import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { clearAuthStorage, isAuthenticated, getStoredRole, getHomePathForRole } from "../utils/auth";

// requiredRole can be a single role ("admin") or a list (["student", "admin"])
const PrivateRoute = ({ children, requiredRole }) => {
  const location = useLocation();

  const authenticated = isAuthenticated();
  const role = getStoredRole();

  if (!authenticated) {
    clearAuthStorage();
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requiredRole) {
    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!allowed.includes(role)) {
      // Wrong role -> send the user to their own dashboard
      return <Navigate to={getHomePathForRole(role)} replace />;
    }
  }

  return children;
};

export default PrivateRoute;
