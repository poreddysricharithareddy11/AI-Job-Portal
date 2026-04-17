import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogOut, User, Briefcase, PlusCircle, LayoutDashboard, History } from "lucide-react";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <nav className="navbar-standard">
      {/* LEFT: Branding */}
      <div className="nav-section nav-left">
        <Link to="/" className="brand-logo">AI SmartPortal</Link>
      </div>

      {/* CENTER: Role-Based Navigation */}
      <div className="nav-section nav-center">
        {user.role === "jobseeker" ? (
          <>
            <Link to="/jobseeker/jobs" className="nav-link">
              <Briefcase size={18} /> <span>Browse Jobs</span>
            </Link>
            <Link to="/jobseeker/applied" className="nav-link">
              <History size={18} /> <span>My Applications</span>
            </Link>
          </>
        ) : (
          <>
            <Link to="/recruiter/jobs" className="nav-link">
              <LayoutDashboard size={18} /> <span>Manage Postings</span>
            </Link>
            <Link to="/recruiter/post" className="nav-link">
              <PlusCircle size={18} /> <span>Post a Job</span>
            </Link>
          </>
        )}
      </div>

      {/* RIGHT: User Profile & Logout */}
      <div className="nav-section nav-right">
        <div className="user-profile-trigger" onClick={() => navigate(`/${user.role}/profile`)}>
          <User size={18} />
          <span className="user-name-text">{user.name}</span>
        </div>
        <button className="icon-btn-logout" onClick={logout} title="Logout Session">
          <LogOut size={18} />
        </button>
      </div>
    </nav>
  );
}