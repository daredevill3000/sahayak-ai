import { useState, useEffect, useRef, useCallback } from "react";
import {
  MapContainer, TileLayer, Circle, Marker, Popup,
  useMap, useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  X, Flame, Zap, FlaskConical, AlertTriangle,
  ShieldCheck, Navigation, RefreshCw, Info,
  LocateFixed, WifiOff, Siren,
} from "lucide-react";

// ── Fix leaflet's broken default icon paths in Vite ──────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ── KLS GIT campus centre (Udyambag, Belagavi) ───────────────────────────────
const CAMPUS = [15.815383, 74.487724];

// ── Hazard zones — real lat/lng on campus ────────────────────────────────────
const HAZARD_ZONES = [
  {
    id: 1, label: "Chemistry Lab Fire", type: "fire", level: "critical",
    icon: Flame, color: "#ef4444", fillColor: "#ef4444",
    lat: 15.8158, lng: 74.4882,
    radiusM: 60,
    detail: "Active fire in Main Building B-Block Chemistry Lab. Evacuate immediately.",
  },
  {
    id: 2, label: "Electrical Fault", type: "electrical", level: "high",
    icon: Zap, color: "#f59e0b", fillColor: "#f59e0b",
    lat: 15.8150, lng: 74.4884,
    radiusM: 40,
    detail: "High-voltage fault near EEE Dept transformer yard. Keep 50 m distance.",
  },
  {
    id: 3, label: "Chemical Spill", type: "chemical", level: "moderate",
    icon: FlaskConical, color: "#8b5cf6", fillColor: "#8b5cf6",
    lat: 15.8160, lng: 74.4870,
    radiusM: 35,
    detail: "Minor solvent spill in Pharmacy Lab. Avoid Block D corridor.",
  },
  {
    id: 4, label: "Crowd Surge", type: "crowd", level: "low",
    icon: AlertTriangle, color: "#22c55e", fillColor: "#22c55e",
    lat: 15.8148, lng: 74.4873,
    radiusM: 30,
    detail: "Dense crowd near Main Gate. Use alternate exit via Sports Ground.",
  },
];

const SAFE_ZONES = [
  { id: "s1", label: "Assembly Point A", lat: 15.8163, lng: 74.4886 },
  { id: "s2", label: "Assembly Point B", lat: 15.8145, lng: 74.4880 },
];

const DANGER_META = {
  critical: { label: "CRITICAL DANGER", color: "#ef4444", bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.3)",  pulse: true  },
  high:     { label: "HIGH DANGER",     color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)", pulse: true  },
  moderate: { label: "MODERATE RISK",   color: "#8b5cf6", bg: "rgba(139,92,246,0.1)", border: "rgba(139,92,246,0.3)", pulse: false },
  low:      { label: "LOW RISK",        color: "#22c55e", bg: "rgba(34,197,94,0.1)",  border: "rgba(34,197,94,0.3)",  pulse: false },
  safe:     { label: "ALL CLEAR",       color: "#16a34a", bg: "rgba(22,163,74,0.08)", border: "rgba(22,163,74,0.25)", pulse: false },
};

const LEVEL_ORDER = ["critical", "high", "moderate", "low", "safe"];
const worstLevel  = (zones) => LEVEL_ORDER.find(l => zones.some(z => z.level === l)) || "safe";

// Haversine distance in metres
const haversine = (lat1, lng1, lat2, lng2) => {
  const R  = 6371000;
  const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a  = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

// ── Custom DivIcon for user dot ───────────────────────────────────────────────
const makeUserIcon = () => L.divIcon({
  className: "",
  html: `<div class="lmap-user-dot"><div class="lmap-user-ring"></div></div>`,
  iconSize:   [24, 24],
  iconAnchor: [12, 12],
});

// ── Custom DivIcon for assembly points ───────────────────────────────────────
const makeSafeIcon = () => L.divIcon({
  className: "",
  html: `<div class="lmap-safe-icon">🛡</div>`,
  iconSize:   [28, 28],
  iconAnchor: [14, 14],
});

// ── Inner component: pans map to user position ────────────────────────────────
const MapController = ({ userPos, shouldFollow, selected }) => {
  const map = useMap();

  // Fly to selected hazard zone when sidebar item is clicked
  useEffect(() => {
    if (selected) {
      map.flyTo([selected.lat, selected.lng], 18, { animate: true, duration: 1.2 });
    }
  }, [selected, map]);

  // Follow user position when follow mode is on
  useEffect(() => {
    if (userPos && shouldFollow) {
      map.setView([userPos.lat, userPos.lng], map.getZoom(), { animate: true });
    }
  }, [userPos, shouldFollow, map]);

  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
const SafetyMap = ({ onClose }) => {
  const backdropRef  = useRef(null);
  const watchRef     = useRef(null);

  const [userPos,    setUserPos]    = useState(null);
  const [gpsStatus,  setGpsStatus]  = useState("acquiring");
  const [selected,   setSelected]   = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [follow,     setFollow]     = useState(true); // auto-pan to user

  // Which hazard zones is the user currently inside?
  const dangerZones = userPos
    ? HAZARD_ZONES.filter(z => haversine(userPos.lat, userPos.lng, z.lat, z.lng) <= z.radiusM)
    : [];

  const overallDanger = dangerZones.length > 0
    ? worstLevel(dangerZones)
    : worstLevel(HAZARD_ZONES);

  const meta = DANGER_META[overallDanger];

  // ── GPS watch ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) { setGpsStatus("unavailable"); return; }

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        setUserPos({ lat, lng, accuracy });
        setGpsStatus("live");
        setLastUpdate(new Date());
      },
      (err) => {
        setGpsStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );

    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  // ── Keyboard close ──────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const handleBackdrop = (e) => { if (e.target === backdropRef.current) onClose(); };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => { setLastUpdate(new Date()); setRefreshing(false); }, 800);
  };

  const userIcon = useRef(makeUserIcon());
  const safeIcon = useRef(makeSafeIcon());

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
              <span className={`smap-gps-pill smap-gps-${gpsStatus}`}>
                {gpsStatus === "live"        && <><LocateFixed size={11} /> GPS Live</>}
                {gpsStatus === "acquiring"   && <><RefreshCw  size={11} className="smap-spin" /> Acquiring…</>}
                {gpsStatus === "denied"      && <><WifiOff    size={11} /> GPS Denied</>}
                {gpsStatus === "unavailable" && <><WifiOff    size={11} /> No GPS</>}
              </span>
            </div>
            <button className="smap-close" onClick={onClose} aria-label="Close map">
              <X size={18} />
            </button>
          </div>

          {/* Danger banner */}
          <div
            className={`smap-danger-banner ${meta.pulse ? "smap-pulse" : ""}`}
            style={{ background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color }}
          >
            {dangerZones.length > 0 ? <Siren size={15} /> : <AlertTriangle size={15} />}
            <strong>
              {dangerZones.length > 0 ? "⚠ YOU ARE INSIDE A HAZARD ZONE" : meta.label}
            </strong>
            {dangerZones.length > 0
              ? <span className="smap-danger-sub">{dangerZones.map(z => z.label).join(" · ")}</span>
              : <span className="smap-danger-sub">{HAZARD_ZONES.filter(z => z.level === overallDanger).length} active zone(s) on campus</span>
            }
            <span className="smap-last-update">
              {lastUpdate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
            <button className="smap-refresh-btn" onClick={handleRefresh} aria-label="Refresh">
              <RefreshCw size={13} className={refreshing ? "smap-spin" : ""} />
            </button>
          </div>
        </div>

        {/* ── Map + sidebar ────────────────────────────────────────────────── */}
        <div className="smap-body">

          {/* Leaflet map */}
          <div className="smap-canvas-wrap" style={{ position: "relative" }}>
            <MapContainer
              center={CAMPUS}
              zoom={18}
              style={{ width: "100%", height: "100%", minHeight: 320 }}
              zoomControl={true}
              attributionControl={true}
            >
              {/* OpenStreetMap tiles */}
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                maxZoom={19}
              />

              {/* Auto-pan + fly-to controller */}
              <MapController userPos={userPos} shouldFollow={follow} selected={selected} />

              {/* Hazard zone circles */}
              {HAZARD_ZONES.map(z => {
                const inside = userPos
                  ? haversine(userPos.lat, userPos.lng, z.lat, z.lng) <= z.radiusM
                  : false;
                return (
                  <Circle
                    key={z.id}
                    center={[z.lat, z.lng]}
                    radius={z.radiusM}
                    pathOptions={{
                      color:       z.color,
                      fillColor:   z.fillColor,
                      fillOpacity: inside ? 0.35 : 0.2,
                      weight:      inside ? 3 : 2,
                      dashArray:   inside ? null : "6 4",
                    }}
                    eventHandlers={{ click: () => setSelected(z) }}
                  >
                    <Popup>
                      <div style={{ minWidth: 180 }}>
                        <strong style={{ color: z.color, fontSize: "0.9rem" }}>{z.label}</strong>
                        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: z.color, marginBottom: 4 }}>
                          {z.level.toUpperCase()}
                        </div>
                        <p style={{ fontSize: "0.78rem", color: "#444", margin: 0, lineHeight: 1.4 }}>
                          {z.detail}
                        </p>
                      </div>
                    </Popup>
                  </Circle>
                );
              })}

              {/* Assembly point markers */}
              {SAFE_ZONES.map(s => (
                <Marker key={s.id} position={[s.lat, s.lng]} icon={safeIcon.current}>
                  <Popup>
                    <strong style={{ color: "#16a34a" }}>{s.label}</strong>
                    <p style={{ fontSize: "0.78rem", margin: "4px 0 0", color: "#444" }}>
                      Designated safe assembly point
                    </p>
                  </Popup>
                </Marker>
              ))}

              {/* Live user marker */}
              {userPos && (
                <>
                  <Marker
                    position={[userPos.lat, userPos.lng]}
                    icon={userIcon.current}
                    zIndexOffset={1000}
                  >
                    <Popup>
                      <strong style={{ color: "#3b82f6" }}>📍 Your Location</strong>
                      <p style={{ fontSize: "0.75rem", margin: "4px 0 0", color: "#555" }}>
                        {userPos.lat.toFixed(6)}°N, {userPos.lng.toFixed(6)}°E
                      </p>
                    </Popup>
                  </Marker>
                  {/* GPS accuracy circle */}
                  <Circle
                    center={[userPos.lat, userPos.lng]}
                    radius={userPos.accuracy || 10}
                    pathOptions={{
                      color: "#3b82f6", fillColor: "#3b82f6",
                      fillOpacity: 0.08, weight: 1, dashArray: "3 3",
                    }}
                  />
                </>
              )}
            </MapContainer>

            {/* Follow-me toggle */}
            <button
              className={`smap-recentre-btn ${follow ? "smap-follow-active" : ""}`}
              onClick={() => setFollow(f => !f)}
              title={follow ? "Following your location (click to stop)" : "Click to follow your location"}
            >
              <LocateFixed size={16} />
            </button>

            <div className="smap-attribution" style={{ zIndex: 1000 }}>
              Live GPS · KLS GIT, Belagavi
            </div>
          </div>

          {/* ── Sidebar ─────────────────────────────────────────────────── */}
          <div className="smap-sidebar">

            {/* Live coords */}
            {userPos && (
              <div className="smap-coords-card">
                <div className="smap-coords-label"><LocateFixed size={11} /> Your Location</div>
                <div className="smap-coords-val">{userPos.lat.toFixed(6)}°N</div>
                <div className="smap-coords-val">{userPos.lng.toFixed(6)}°E</div>
              </div>
            )}

            {/* In-danger alert */}
            {dangerZones.length > 0 && (
              <div className="smap-in-danger-alert">
                <Siren size={14} />
                <div>
                  <strong>You are in a hazard zone!</strong>
                  <p>{dangerZones[0].detail}</p>
                </div>
              </div>
            )}

            <div className="smap-legend-title">
              <Info size={13} /> Active Hazards
            </div>

            <div className="smap-hazard-list">
              {HAZARD_ZONES.map(z => {
                const Icon     = z.icon;
                const isActive = selected?.id === z.id;
                const distM    = userPos
                  ? Math.round(haversine(userPos.lat, userPos.lng, z.lat, z.lng))
                  : null;
                const inside   = distM !== null && distM <= z.radiusM;

                return (
                  <button
                    key={z.id}
                    className={`smap-hazard-item ${isActive ? "smap-hazard-active" : ""} ${inside ? "smap-hazard-inside" : ""}`}
                    style={{ "--hz-color": z.color }}
                    onClick={() => {
                      const next = isActive ? null : z;
                      setSelected(next);
                      // Pause follow-mode so the fly animation isn't overridden by GPS updates
                      if (next) setFollow(false);
                    }}
                  >
                    <div className="smap-hz-icon" style={{ background: `${z.color}18`, color: z.color }}>
                      <Icon size={14} />
                    </div>
                    <div className="smap-hz-info">
                      <span className="smap-hz-label">{z.label}</span>
                      <span className="smap-hz-level" style={{ color: z.color }}>
                        {z.level.toUpperCase()}
                        {distM !== null && (
                          <span style={{ color: inside ? "#ef4444" : "var(--accents-3)", fontWeight: 600, marginLeft: 4 }}>
                            · {inside ? "INSIDE" : distM > 999 ? `${(distM/1000).toFixed(1)} km` : `${distM} m`}
                          </span>
                        )}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {selected && (
              <div className="smap-detail-card"
                style={{ borderColor: selected.color, background: `${selected.color}08` }}>
                <div className="smap-detail-header" style={{ color: selected.color }}>
                  <selected.icon size={14} />
                  <strong>{selected.label}</strong>
                </div>
                <p className="smap-detail-text">{selected.detail}</p>
              </div>
            )}

            <div className="smap-safe-legend">
              <div className="smap-safe-dot" />
              <span>Assembly Points</span>
            </div>
            <div className="smap-safe-legend">
              <div className="smap-you-dot" />
              <span>Your live location</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SafetyMap;
