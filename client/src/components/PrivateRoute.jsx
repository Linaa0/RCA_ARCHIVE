import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { clearAuthStorage, isAuthenticated, getStoredRole } from "../utils/auth";

const PrivateRoute = ({ children, requiredRole }) => {
  const location = useLocation();

  const authenticated = isAuthenticated();
  const role = getStoredRole();

  if (!authenticated) {
    clearAuthStorage();
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Role-based guard: redirect to home if user doesn't have the required role
  if (requiredRole && role !== requiredRole) {
    // Non-admin trying to hit /admin → go to home
    return <Navigate to="/home" replace />;
  }

  return children;
};

export default PrivateRoute;
