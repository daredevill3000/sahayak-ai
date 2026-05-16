import { useState, useEffect, useRef } from "react";
import {
  X, Flame, Zap, FlaskConical, AlertTriangle,
  ShieldCheck, Navigation, RefreshCw, Info,
} from "lucide-react";

// ── KLS GIT campus centre (Belagavi) ─────────────────────────────────────────
const CAMPUS = { lat: 15.8494, lng: 74.4956 };

// ── Simulated hazard zones on campus ─────────────────────────────────────────
// Each zone has a level: "critical" | "high" | "moderate" | "low"
const HAZARD_ZONES = [
  {
    id: 1,
    label: "Chemistry Lab Fire",
    type: "fire",
    level: "critical",
    icon: Flame,
    color: "#ef4444",
    // Offset from campus centre in degrees (tiny — campus scale)
    dLat:  0.0012, dLng:  0.0008,
    radius: 60,   // metres (visual only)
    detail: "Active fire reported in Main Building B-Block Chemistry Lab. Evacuate immediately.",
  },
  {
    id: 2,
    label: "Electrical Fault",
    type: "electrical",
    level: "high",
    icon: Zap,
    color: "#f59e0b",
    dLat: -0.0005, dLng:  0.0015,
    radius: 40,
    detail: "High-voltage fault near EEE Department transformer yard. Keep 50 m distance.",
  },
  {
    id: 3,
    label: "Chemical Spill",
    type: "chemical",
    level: "moderate",
    icon: FlaskConical,
    color: "#8b5cf6",
    dLat:  0.0018, dLng: -0.0010,
    radius: 35,
    detail: "Minor solvent spill in Pharmacy Lab. Area cordoned — avoid Block D corridor.",
  },
  {
    id: 4,
    label: "Crowd Surge",
    type: "crowd",
    level: "low",
    icon: AlertTriangle,
    color: "#22c55e",
    dLat: -0.0014, dLng: -0.0006,
    radius: 30,
    detail: "Dense crowd near Main Gate after event. Use alternate exit via Sports Ground.",
  },
];

// ── Safe assembly points ──────────────────────────────────────────────────────
const SAFE_ZONES = [
  { id: "s1", label: "Assembly Point A", dLat:  0.0022, dLng:  0.0020 },
  { id: "s2", label: "Assembly Point B", dLat: -0.0020, dLng:  0.0018 },
];

// ── Overall danger level derived from worst active hazard ────────────────────
const DANGER_META = {
  critical: { label: "CRITICAL DANGER",  color: "#ef4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.3)",   pulse: true  },
  high:     { label: "HIGH DANGER",      color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.3)",  pulse: true  },
  moderate: { label: "MODERATE RISK",    color: "#8b5cf6", bg: "rgba(139,92,246,0.1)",  border: "rgba(139,92,246,0.3)",  pulse: false },
  low:      { label: "LOW RISK",         color: "#22c55e", bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.3)",   pulse: false },
  safe:     { label: "ALL CLEAR",        color: "#16a34a", bg: "rgba(22,163,74,0.08)",  border: "rgba(22,163,74,0.25)",  pulse: false },
};

const LEVEL_ORDER = ["critical", "high", "moderate", "low", "safe"];
const worstLevel  = (zones) =>
  LEVEL_ORDER.find(l => zones.some(z => z.level === l)) || "safe";

// ── Degree → pixel helpers (equirectangular, good enough at campus scale) ─────
// We render a 600×400 virtual canvas; campus centre maps to (300, 200).
const W = 600, H = 400;
const SCALE = 80000; // pixels per degree at this zoom

const toXY = (dLat, dLng) => ({
  x: W / 2 + dLng * SCALE,
  y: H / 2 - dLat * SCALE,
});

// Metres → pixels (1° lat ≈ 111 000 m)
const mToPx = (m) => (m / 111000) * SCALE;

// ─────────────────────────────────────────────────────────────────────────────
const SafetyMap = ({ onClose }) => {
  const backdropRef  = useRef(null);
  const [selected,   setSelected]   = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const danger = worstLevel(HAZARD_ZONES);
  const meta   = DANGER_META[danger];

  // Close on backdrop click
  const handleBackdrop = (e) => {
    if (e.target === backdropRef.current) onClose();
  };

  // Close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  // Simulate a data refresh
  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setLastUpdate(new Date());
      setRefreshing(false);
    }, 1200);
  };

  return (
    <div
      className="smap-backdrop"
      ref={backdropRef}
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Campus Safety Map"
    >
      <div className="smap-modal">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="smap-header">
          <div className="smap-title-row">
            <div className="smap-title">
              <Navigation size={18} />
              <span>Campus Safety Map</span>
              <span className="smap-campus-tag">KLS GIT · Live</span>
            </div>
            <button className="smap-close" onClick={onClose} aria-label="Close map">
              <X size={18} />
            </button>
          </div>

          {/* Danger level banner */}
          <div
            className={`smap-danger-banner ${meta.pulse ? "smap-pulse" : ""}`}
            style={{ background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color }}
          >
            <AlertTriangle size={15} />
            <strong>{meta.label}</strong>
            <span className="smap-danger-sub">
              {HAZARD_ZONES.filter(z => z.level === danger).length} active zone
              {HAZARD_ZONES.filter(z => z.level === danger).length !== 1 ? "s" : ""}
            </span>
            <span className="smap-last-update">
              Updated {lastUpdate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
            <button
              className="smap-refresh-btn"
              onClick={handleRefresh}
              aria-label="Refresh map data"
            >
              <RefreshCw size={13} className={refreshing ? "smap-spin" : ""} />
            </button>
          </div>
        </div>

        {/* ── Map canvas + legend row ──────────────────────────────────────── */}
        <div className="smap-body">

          {/* SVG map */}
          <div className="smap-canvas-wrap">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="smap-svg"
              aria-label="Campus hazard map"
            >
              {/* ── Background grid (campus feel) ── */}
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0,0,0,0.04)" strokeWidth="1" />
                </pattern>
                {/* Radial gradient for hazard circles */}
                {HAZARD_ZONES.map(z => (
                  <radialGradient key={`g${z.id}`} id={`grad${z.id}`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%"   stopColor={z.color} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={z.color} stopOpacity="0.05" />
                  </radialGradient>
                ))}
              </defs>

              <rect width={W} height={H} fill="#f0f4f8" />
              <rect width={W} height={H} fill="url(#grid)" />

              {/* ── Campus boundary outline ── */}
              <rect
                x={W / 2 - 220} y={H / 2 - 150}
                width={440} height={300}
                rx={16}
                fill="rgba(255,255,255,0.7)"
                stroke="rgba(0,0,0,0.1)"
                strokeWidth={2}
                strokeDasharray="8 4"
              />
              <text x={W / 2 - 210} y={H / 2 - 130} fontSize={11} fill="rgba(0,0,0,0.3)" fontWeight={600}>
                KLS GIT CAMPUS BOUNDARY
              </text>

              {/* ── Simulated building blocks ── */}
              {[
                { x: W/2 - 80, y: H/2 - 90, w: 100, h: 60,  label: "Main Block" },
                { x: W/2 + 60, y: H/2 - 80, w:  70, h: 50,  label: "EEE Dept"   },
                { x: W/2 - 160,y: H/2 + 10, w:  80, h: 55,  label: "Hostel C"   },
                { x: W/2 + 20, y: H/2 + 20, w:  90, h: 50,  label: "Block D"    },
                { x: W/2 - 60, y: H/2 + 80, w: 120, h: 40,  label: "Sports Gnd" },
              ].map(b => (
                <g key={b.label}>
                  <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={6}
                    fill="rgba(148,163,184,0.25)" stroke="rgba(100,116,139,0.3)" strokeWidth={1.5} />
                  <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 4}
                    textAnchor="middle" fontSize={9} fill="rgba(51,65,85,0.7)" fontWeight={600}>
                    {b.label}
                  </text>
                </g>
              ))}

              {/* ── Roads / paths ── */}
              <path d={`M ${W/2 - 220} ${H/2} L ${W/2 + 220} ${H/2}`}
                stroke="rgba(255,255,255,0.8)" strokeWidth={8} strokeLinecap="round" />
              <path d={`M ${W/2} ${H/2 - 150} L ${W/2} ${H/2 + 150}`}
                stroke="rgba(255,255,255,0.8)" strokeWidth={6} strokeLinecap="round" />

              {/* ── Safe assembly points ── */}
              {SAFE_ZONES.map(s => {
                const { x, y } = toXY(s.dLat, s.dLng);
                return (
                  <g key={s.id}>
                    <circle cx={x} cy={y} r={14} fill="rgba(34,197,94,0.15)" stroke="#22c55e" strokeWidth={2} />
                    <ShieldCheck size={12} x={x - 6} y={y - 6} color="#16a34a" />
                    <text x={x} y={y + 24} textAnchor="middle" fontSize={8.5}
                      fill="#16a34a" fontWeight={700}>{s.label}</text>
                  </g>
                );
              })}

              {/* ── Hazard zones ── */}
              {HAZARD_ZONES.map(z => {
                const { x, y } = toXY(z.dLat, z.dLng);
                const r        = mToPx(z.radius);
                const isActive = selected?.id === z.id;
                const Icon     = z.icon;
                return (
                  <g
                    key={z.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelected(isActive ? null : z)}
                    role="button"
                    aria-label={z.label}
                  >
                    {/* Outer glow ring */}
                    <circle cx={x} cy={y} r={r + 8}
                      fill="none" stroke={z.color} strokeWidth={1.5}
                      strokeDasharray="5 3" opacity={0.5} />
                    {/* Filled hazard radius */}
                    <circle cx={x} cy={y} r={r}
                      fill={`url(#grad${z.id})`}
                      stroke={z.color} strokeWidth={isActive ? 2.5 : 1.5}
                      opacity={isActive ? 1 : 0.85} />
                    {/* Icon placeholder (SVG foreignObject not reliable — use text emoji) */}
                    <circle cx={x} cy={y} r={13}
                      fill={z.color} opacity={0.9} />
                    <text x={x} y={y + 5} textAnchor="middle" fontSize={13}>
                      {z.type === "fire"       ? "🔥"
                       : z.type === "electrical" ? "⚡"
                       : z.type === "chemical"   ? "☣"
                       : "⚠"}
                    </text>
                    {/* Label */}
                    <text x={x} y={y + r + 18} textAnchor="middle"
                      fontSize={9.5} fill={z.color} fontWeight={700}>
                      {z.label}
                    </text>
                  </g>
                );
              })}

              {/* ── User location (campus centre) ── */}
              <circle cx={W / 2} cy={H / 2} r={18}
                fill="rgba(59,130,246,0.15)" stroke="#3b82f6" strokeWidth={2} />
              <circle cx={W / 2} cy={H / 2} r={6}
                fill="#3b82f6" />
              <text x={W / 2} y={H / 2 + 28} textAnchor="middle"
                fontSize={9} fill="#3b82f6" fontWeight={700}>You</text>
            </svg>

            {/* Map attribution */}
            <div className="smap-attribution">
              Simulated campus overlay · KLS GIT, Belagavi
            </div>
          </div>

          {/* ── Legend + hazard list ─────────────────────────────────────── */}
          <div className="smap-sidebar">
            <div className="smap-legend-title">
              <Info size={13} /> Active Hazards
            </div>

            <div className="smap-hazard-list">
              {HAZARD_ZONES.map(z => {
                const Icon    = z.icon;
                const isActive = selected?.id === z.id;
                return (
                  <button
                    key={z.id}
                    className={`smap-hazard-item ${isActive ? "smap-hazard-active" : ""}`}
                    style={{ "--hz-color": z.color }}
                    onClick={() => setSelected(isActive ? null : z)}
                  >
                    <div className="smap-hz-icon" style={{ background: `${z.color}18`, color: z.color }}>
                      <Icon size={14} />
                    </div>
                    <div className="smap-hz-info">
                      <span className="smap-hz-label">{z.label}</span>
                      <span className="smap-hz-level" style={{ color: z.color }}>
                        {z.level.toUpperCase()}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Detail card for selected hazard */}
            {selected && (
              <div
                className="smap-detail-card"
                style={{ borderColor: selected.color, background: `${selected.color}08` }}
              >
                <div className="smap-detail-header" style={{ color: selected.color }}>
                  <selected.icon size={14} />
                  <strong>{selected.label}</strong>
                </div>
                <p className="smap-detail-text">{selected.detail}</p>
              </div>
            )}

            {/* Safe zone legend */}
            <div className="smap-safe-legend">
              <div className="smap-safe-dot" />
              <span>Assembly Points (safe zones)</span>
            </div>
            <div className="smap-safe-legend">
              <div className="smap-you-dot" />
              <span>Your location</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SafetyMap;
