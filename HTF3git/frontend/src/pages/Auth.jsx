import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, GraduationCap, BookOpen } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const ROLES = [
  { id: "student",  label: "Student",  icon: GraduationCap },
  { id: "faculty",  label: "Faculty",  icon: BookOpen       },
  { id: "security", label: "Security", icon: Shield         },
];

const USN_PLACEHOLDERS = {
  student:  "USN — e.g. 2KG22CS001",
  faculty:  "Employee ID — e.g. GIT-FAC-042",
  security: "Badge ID — e.g. SEC-007",
};

const USN_LABELS = {
  student:  "University Seat Number (USN)",
  faculty:  "Employee ID",
  security: "Security Badge ID",
};

const Auth = () => {
  const [role,         setRole]         = useState("student");
  const [name,         setName]         = useState("");
  const [usn,          setUsn]          = useState("");
  const [password,     setPassword]     = useState("");
  const [stayLoggedIn, setStayLoggedIn] = useState(false);

  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) navigate("/dashboard", { replace: true });
  }, [isAuthenticated, navigate]);

  const handleLogin = (e) => {
    e.preventDefault();
    login({ name: name.trim(), usn: usn.trim(), role }, stayLoggedIn);
    navigate("/dashboard");
  };

  return (
    <div className="auth-container">
      <div className="auth-background">
        <div className="auth-gradient-1" />
        <div className="auth-gradient-2" />
      </div>

      <div className="auth-glass-card">
        {/* Header */}
        <div className="auth-header">
          <Shield size={40} className="auth-icon" />
          <h2>KLS GIT Portal</h2>
          <p>Sahayaka Emergency Response System</p>
        </div>

        {/* Role tabs */}
        <div className="auth-role-tabs">
          {ROLES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`auth-role-tab ${role === id ? "active" : ""}`}
              onClick={() => { setRole(id); setUsn(""); }}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="auth-form">
          {/* Full name */}
          <div className="input-group">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              placeholder="e.g. Arjun Patil"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>

          {/* USN / Employee ID / Badge ID */}
          <div className="input-group">
            <label htmlFor="usn">{USN_LABELS[role]}</label>
            <input
              id="usn"
              type="text"
              placeholder={USN_PLACEHOLDERS[role]}
              value={usn}
              onChange={(e) => setUsn(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          {/* Password */}
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {/* Stay logged in */}
          <div className="checkbox-group">
            <input
              id="stay-logged-in"
              type="checkbox"
              checked={stayLoggedIn}
              onChange={(e) => setStayLoggedIn(e.target.checked)}
            />
            <label htmlFor="stay-logged-in" style={{ color: "var(--accents-3)" }}>
              Stay logged in for 30 days
            </label>
          </div>

          <button type="submit" className="login-btn">
            Access Emergency Dashboard
          </button>
        </form>

        <p style={{
          marginTop: "1.25rem", textAlign: "center",
          fontSize: "0.78rem", color: "var(--accents-3)", lineHeight: "1.5"
        }}>
          KLS Gogte Institute of Technology · Belagavi — 590008<br />
          For account issues contact{" "}
          <span style={{ color: "var(--primary)", fontWeight: 600 }}>
            security@klsgit.ac.in
          </span>
        </p>
      </div>
    </div>
  );
};

export default Auth;
