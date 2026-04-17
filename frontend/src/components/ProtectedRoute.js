import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Robust Protected Route Wrapper
 * Ensures users have the correct role before rendering the page content.
 */
export default function ProtectedRoute({ role }) {
  const { user, loading } = useAuth(); // Standardized hook access

  // 1. Prevent blank pages while the session is being verified
  if (loading) {
    return (
      <div className="loader-container">
        <p>Verifying AI SmartPortal Session...</p>
      </div>
    );
  }

  // 2. Redirect to Login if no user is found
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // 3. Prevent cross-role access (e.g., Job Seeker trying to access Recruiter pages)
  if (role && user.role !== role) {
    const fallbackPath = user.role === "recruiter" ? "/recruiter/jobs" : "/jobseeker/jobs";
    return <Navigate to={fallbackPath} replace />;
  }

  // 4. Render the nested route content (Profile, Jobs, Applicants, etc.)
  return <Outlet />;
}



