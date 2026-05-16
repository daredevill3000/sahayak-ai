import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

// ── localStorage helpers ──────────────────────────────────────────────────────
const LS = {
  get: (key, fallback = null) => {
    try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set: (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ } },
  remove: (...keys) => keys.forEach(k => localStorage.removeItem(k)),
};

const SESSION_KEYS = ["sahayaka_user", "stayLoggedIn", "loginExpiry"];

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user,            setUser]            = useState(null);
  const [loading,         setLoading]         = useState(true);

  // ── Rehydrate session on mount ──────────────────────────────────────────────
  useEffect(() => {
    const stayLoggedIn = LS.get("stayLoggedIn", false);
    const loginExpiry  = LS.get("loginExpiry",  0);
    const savedUser    = LS.get("sahayaka_user", null);

    if (stayLoggedIn && loginExpiry && savedUser) {
      if (Date.now() < loginExpiry) {
        setIsAuthenticated(true);
        setUser(savedUser);
      } else {
        _clearSession();
      }
    }
    setLoading(false);
  }, []);

  const _clearSession = () => {
    setIsAuthenticated(false);
    setUser(null);
    LS.remove(...SESSION_KEYS);
  };

  // ── login(userData, stayLoggedIn) ───────────────────────────────────────────
  // userData: { name, usn, role }
  const login = (userData, stayLoggedIn = false) => {
    const fullUser = {
      name:              userData.name  || "",
      usn:               userData.usn   || "",
      role:              userData.role  || "student",
      emergencyContacts: [],            // populated later via updateProfile
    };
    setIsAuthenticated(true);
    setUser(fullUser);
    LS.set("sahayaka_user", fullUser);

    if (stayLoggedIn) {
      LS.set("stayLoggedIn", true);
      LS.set("loginExpiry",  Date.now() + 30 * 24 * 60 * 60 * 1000);
    } else {
      LS.remove("stayLoggedIn", "loginExpiry");
    }
  };

  // ── updateProfile — merge partial updates into user ─────────────────────────
  const updateProfile = (patch) => {
    setUser(prev => {
      const updated = { ...prev, ...patch };
      LS.set("sahayaka_user", updated);
      return updated;
    });
  };

  const logout = () => _clearSession();

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, updateProfile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
