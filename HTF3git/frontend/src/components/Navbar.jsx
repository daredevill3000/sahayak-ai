import { useState } from "react";
import { Shield, Activity, LayoutDashboard, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Profile from "./Profile";

// First character of name only
const firstChar = (name = "") =>
  name.trim()[0]?.toUpperCase() || "?";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  return (
    <>
      <nav className="main-navbar">
        {/* Logo */}
        <Link to="/" className="nav-logo">
          <Shield size={28} color="var(--primary)" fill="var(--primary)" fillOpacity={0.1} />
          <span className="logo-text">Sahayaka</span>
        </Link>

        <div className="nav-links">
          <Link to="/dashboard" className="nav-link">
            <LayoutDashboard className="mobile-icon" size={20} />
            <span>Dashboard</span>
          </Link>

          <Link to="/triage" className="nav-link triage-link">
            <Activity className="mobile-icon" size={20} />
            <span className="mobile-label">AI</span>
            <button className="triage-btn">Sahayaka AI</button>
          </Link>

          {/* Avatar chip — opens Profile panel */}
          {user && (
            <button
              className="nav-avatar-btn"
              onClick={() => setProfileOpen(true)}
              aria-label="Open profile"
              title={user.name || user.usn}
            >
              <span className="nav-avatar-initials">{firstChar(user.name)}</span>
            </button>
          )}

          {user && (
            <button onClick={handleLogout} className="logout-btn">
              <LogOut className="mobile-icon" size={20} />
              <span>Logout</span>
            </button>
          )}
        </div>
      </nav>

      {/* Profile slide-in panel */}
      {profileOpen && <Profile onClose={() => setProfileOpen(false)} />}
    </>
  );
};

export default Navbar;
