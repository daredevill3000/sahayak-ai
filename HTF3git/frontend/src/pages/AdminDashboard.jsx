import { useMemo, useState, useEffect, useRef } from "react";
import { Shield, LogOut, AlertTriangle, MapPin, Phone, Users, Clock, ChevronRight, Activity, Bell, Flame, Zap, FlaskConical, Navigation, LocateFixed } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getMqttClient, SOS_TOPIC } from "../utils/mqttClient";
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon paths in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// KLS GIT campus centre
const CAMPUS = [15.815383, 74.487724];

const ADMIN_HAZARDS = [
  { id: 1, label: "Chemistry Lab Fire",  level: "critical", color: "#ef4444", lat: 15.8158, lng: 74.4882, r: 60,  detail: "Active fire — Main Building B-Block Chemistry Lab." },
  { id: 2, label: "Electrical Fault",    level: "high",     color: "#f59e0b", lat: 15.8150, lng: 74.4884, r: 40,  detail: "High-voltage fault near EEE Dept transformer yard." },
  { id: 3, label: "Chemical Spill",      level: "moderate", color: "#8b5cf6", lat: 15.8160, lng: 74.4870, r: 35,  detail: "Solvent spill in Pharmacy Lab — Block D corridor." },
  { id: 4, label: "Crowd Surge",         level: "low",      color: "#22c55e", lat: 15.8148, lng: 74.4873, r: 30,  detail: "Dense crowd near Main Gate." },
];

const ADMIN_SAFE_ZONES = [
  { id: "s1", label: "Assembly Point A", lat: 15.8163, lng: 74.4886 },
  { id: "s2", label: "Assembly Point B", lat: 15.8145, lng: 74.4880 },
];

const safeIcon = L.divIcon({
  className: "",
  html: `<div style="font-size:20px;line-height:1;filter:drop-shadow(0 1px 3px rgba(0,0,0,.3))">🛡</div>`,
  iconSize: [24, 24], iconAnchor: [12, 12],
});

// Haversine
const haversine = (lat1,lng1,lat2,lng2) => {
  const R=6371000, φ1=lat1*Math.PI/180, φ2=lat2*Math.PI/180;
  const Δφ=(lat2-lat1)*Math.PI/180, Δλ=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(Δφ/2)**2+Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
};

// User dot icon
const userDotIcon = L.divIcon({
  className: "",
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 2px 8px rgba(59,130,246,.5)"></div>`,
  iconSize: [16,16], iconAnchor: [8,8],
});

// Sub-component: pans to user when follow is on
const FollowController = ({ pos, follow }) => {
  const map = useMap();
  useEffect(() => { if (pos && follow) map.setView([pos.lat, pos.lng], map.getZoom(), { animate: true }); }, [pos, follow, map]);
  return null;
};

// The actual Leaflet map panel
const AdminLiveMap = () => {
  const [userPos,  setUserPos]  = useState(null);
  const [gpsOk,    setGpsOk]    = useState(false);
  const [follow,   setFollow]   = useState(true);
  const watchRef = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => { setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }); setGpsOk(true); },
      () => setGpsOk(false),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
    return () => { if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current); };
  }, []);

  const dangerZones = userPos
    ? ADMIN_HAZARDS.filter(z => haversine(userPos.lat, userPos.lng, z.lat, z.lng) <= z.r)
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", flex: 1 }}>
      {/* Status bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "3px 10px", borderRadius: 20, fontSize: "0.72rem", fontWeight: 700,
          background: gpsOk ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.1)",
          color: gpsOk ? "#16a34a" : "#dc2626",
          border: `1px solid ${gpsOk ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.2)"}`,
        }}>
          <LocateFixed size={11} /> {gpsOk ? "GPS Live" : "GPS Acquiring…"}
        </span>
        {userPos && (
          <span style={{ fontSize: "0.72rem", color: "var(--accents-3)", fontFamily: "monospace", fontWeight: 600 }}>
            {userPos.lat.toFixed(5)}°N · {userPos.lng.toFixed(5)}°E
          </span>
        )}
        {dangerZones.length > 0 && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 10px", borderRadius: 20, fontSize: "0.72rem", fontWeight: 800,
            background: "rgba(239,68,68,0.1)", color: "#dc2626",
            border: "1px solid rgba(239,68,68,0.3)", animation: "bannerPulse 1.5s ease-in-out infinite",
          }}>
            ⚠ INSIDE HAZARD: {dangerZones.map(z => z.label).join(", ")}
          </span>
        )}
        <button
          onClick={() => setFollow(f => !f)}
          style={{
            marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5,
            padding: "4px 12px", borderRadius: 20, fontSize: "0.72rem", fontWeight: 700,
            background: follow ? "rgba(59,130,246,0.12)" : "rgba(0,0,0,0.05)",
            color: follow ? "#2563eb" : "var(--accents-3)",
            border: `1px solid ${follow ? "rgba(59,130,246,0.3)" : "rgba(0,0,0,0.1)"}`,
            cursor: "pointer", boxShadow: "none",
          }}
        >
          <Navigation size={11} /> {follow ? "Following" : "Follow Me"}
        </button>
      </div>

      {/* Leaflet map */}
      <div style={{ flex: 1, minHeight: 420, borderRadius: 16, overflow: "hidden", border: "1px solid var(--accents-2)" }}>
        <MapContainer
          center={userPos ? [userPos.lat, userPos.lng] : CAMPUS}
          zoom={17}
          style={{ width: "100%", height: "100%" }}
          zoomControl
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            maxZoom={19}
          />
          <FollowController pos={userPos} follow={follow} />

          {/* Hazard circles */}
          {ADMIN_HAZARDS.map(z => (
            <Circle key={z.id} center={[z.lat, z.lng]} radius={z.r}
              pathOptions={{ color: z.color, fillColor: z.color, fillOpacity: 0.2, weight: 2, dashArray: "6 4" }}>
              <Popup>
                <strong style={{ color: z.color }}>{z.label}</strong>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: z.color, marginBottom: 4 }}>{z.level.toUpperCase()}</div>
                <p style={{ fontSize: "0.78rem", margin: 0, color: "#444" }}>{z.detail}</p>
              </Popup>
            </Circle>
          ))}

          {/* Assembly points */}
          {ADMIN_SAFE_ZONES.map(s => (
            <Marker key={s.id} position={[s.lat, s.lng]} icon={safeIcon}>
              <Popup><strong style={{ color: "#16a34a" }}>{s.label}</strong></Popup>
            </Marker>
          ))}

          {/* Live user dot */}
          {userPos && (
            <>
              <Marker position={[userPos.lat, userPos.lng]} icon={userDotIcon} zIndexOffset={1000}>
                <Popup>
                  <strong style={{ color: "#3b82f6" }}>📍 Your Location</strong>
                  <p style={{ fontSize: "0.75rem", margin: "4px 0 0", color: "#555" }}>
                    {userPos.lat.toFixed(6)}°N, {userPos.lng.toFixed(6)}°E
                  </p>
                </Popup>
              </Marker>
              <Circle center={[userPos.lat, userPos.lng]} radius={userPos.acc || 10}
                pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.07, weight: 1, dashArray: "3 3" }} />
            </>
          )}
        </MapContainer>
      </div>

      {/* Hazard legend */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {ADMIN_HAZARDS.map(z => (
          <span key={z.id} style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 10px", borderRadius: 20, fontSize: "0.7rem", fontWeight: 700,
            background: `${z.color}12`, color: z.color, border: `1px solid ${z.color}30`,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: z.color, display: "inline-block" }} />
            {z.label}
          </span>
        ))}
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "3px 10px", borderRadius: 20, fontSize: "0.7rem", fontWeight: 700,
          background: "rgba(34,197,94,0.1)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.25)",
        }}>🛡 Assembly Points</span>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState("alerts");
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const initialAlerts = useMemo(
    () => [
      { id: 101, status: "Critical", type: "Security Breach", location: "Main Gate — Gate A", time: "Just now" },
      { id: 102, status: "Urgent", type: "Medical Emergency", location: "Hostel Block C — Roof", time: "8 mins ago" },
      { id: 103, status: "Moderate", type: "Suspicious Activity", location: "Chemistry Lab B204", time: "21 mins ago" },
    ],
    []
  );
  
  const [alerts, setAlerts] = useState(initialAlerts);
  const [mqttConnected, setMqttConnected] = useState(false);

  useEffect(() => {
    const client = getMqttClient();
    if (client.connected) {
      setMqttConnected(true);
    }
    
    client.on("connect", () => {
      setMqttConnected(true);
      client.subscribe(SOS_TOPIC, (err) => {
        if (!err) console.log("[AdminDashboard] Subscribed to", SOS_TOPIC);
      });
    });

    client.on("message", (topic, message) => {
      if (topic === SOS_TOPIC) {
        try {
          const payload = JSON.parse(message.toString());
          setAlerts((prev) => {
            const existingIndex = prev.findIndex(a => a.id === payload.id);
            if (existingIndex !== -1) {
              const updated = [...prev];
              updated[existingIndex] = {
                ...updated[existingIndex],
                type: payload.type,
                status: payload.status,
                location: payload.location,
              };
              return updated;
            }
            return [
              {
                id: payload.id,
                status: payload.status,
                type: payload.type,
                location: payload.location,
                time: "Just now",
              },
              ...prev,
            ];
          });
        } catch (e) {
          console.error("Failed to parse MQTT message", e);
        }
      }
    });

    // We also need to subscribe immediately in case it was already connected
    if (client.connected) {
      client.subscribe(SOS_TOPIC);
    }

    // Cleanup isn't strictly necessary since mqtt client is a singleton, 
    // but we could unsubscribe if we wanted. For a prototype, leaving it attached is fine.
  }, []);

  const statusConfig = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "critical") return { color: "var(--primary)", bg: "rgba(230, 57, 70, 0.1)", border: "rgba(230, 57, 70, 0.2)" };
    if (s === "urgent") return { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)", border: "rgba(245, 158, 11, 0.2)" };
    return { color: "#3b82f6", bg: "rgba(59, 130, 246, 0.1)", border: "rgba(59, 130, 246, 0.2)" };
  };

  const TabButton = ({ id, label, icon: Icon }) => (
    <button
      type="button"
      className={`admin-tab ${tab === id ? "active" : ""}`}
      onClick={() => setTab(id)}
    >
      <Icon size={18} className="tab-icon" />
      <span>{label}</span>
      {tab === id && <div className="tab-indicator" />}
    </button>
  );

  return (
    <div className="admin-layout">
      {/* Dynamic Background matching light theme */}
      <div className="admin-bg-elements">
        <div className="glow-orb orb-1"></div>
        <div className="glow-orb orb-2"></div>
        <div className="grid-overlay"></div>
      </div>

      <div className="admin-dashboard-container">
        {/* Top Navigation Bar */}
        <header className="admin-header-glass">
          <div className="header-left">
            <div className="brand-logo">
              <div className="shield-icon">
                <Shield size={24} />
              </div>
              <div className="brand-text">
                <h1>Command Center</h1>
                <span>Secure Operations</span>
              </div>
            </div>
          </div>
          
          <div className="header-right">
            <div className={`status-badge ${mqttConnected ? "" : "offline"}`} style={!mqttConnected ? { backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' } : {}}>
              <div className={`status-dot ${mqttConnected ? "pulsing" : ""}`} style={!mqttConnected ? { backgroundColor: '#ef4444', animation: 'none', boxShadow: 'none' } : {}}></div>
              {mqttConnected ? "System Online" : "System Offline"}
            </div>
            <div className="time-display">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="user-profile">
              <div className="avatar">
                {user?.name ? user.name.charAt(0) : "S"}
              </div>
              <div className="user-info">
                <span className="user-name">{user?.name || "Security Admin"}</span>
                <span className="user-role">{user?.usn || "ID: SEC-001"}</span>
              </div>
            </div>
            <button type="button" className="btn-logout" onClick={logout} title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        {/* Main Content Grid */}
        <div className="admin-content-grid">
          {/* Sidebar Tabs */}
          <aside className="admin-sidebar">
            <nav className="admin-tabs-vertical">
              <TabButton id="alerts" label="Live Incident Feed" icon={Activity} />
              <TabButton id="contacts" label="Emergency Contacts" icon={Phone} />
              <TabButton id="map" label="Live Safety Map" icon={MapPin} />
              <TabButton id="roster" label="Warden Roster" icon={Users} />
            </nav>
            
            <div className="sidebar-stats">
              <div className="stat-card">
                <span className="stat-label">Active Alerts</span>
                <span className="stat-value critical-text">03</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">On-Duty Staff</span>
                <span className="stat-value">12</span>
              </div>
            </div>
          </aside>

          {/* Main Panel Content */}
          <main className="admin-main-panel">
            {tab === "alerts" && (
              <div className="panel-glass slide-in">
                <div className="panel-header">
                  <div>
                    <h2>Live Incident Feed</h2>
                    <p className="panel-subtitle">Real-time alerts and security breaches</p>
                  </div>
                  <div className="pulse-indicator">
                    <Bell size={16} /> Live Feed
                  </div>
                </div>
                <div className="alert-feed">
                  {alerts.map((a, index) => {
                    const config = statusConfig(a.status);
                    return (
                      <div 
                        key={a.id} 
                        className="alert-card fade-in"
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <div className="alert-severity" style={{ background: config.bg, borderColor: config.border, color: config.color }}>
                          <AlertTriangle size={16} />
                          {a.status}
                        </div>
                        <div className="alert-content">
                          <h3 className="alert-type">{a.type}</h3>
                          <p className="alert-location">
                            <MapPin size={14} /> {a.location}
                          </p>
                        </div>
                        <div className="alert-meta">
                          <div className="alert-time">
                            <Clock size={14} /> {a.time}
                          </div>
                          <button className="btn-action">
                            Review <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tab === "contacts" && (
              <div className="panel-glass slide-in">
                <div className="panel-header">
                  <div>
                    <h2>Emergency Routing</h2>
                    <p className="panel-subtitle">Quick dispatch numbers</p>
                  </div>
                </div>
                <div className="contacts-grid">
                  {[
                    { name: "Control Room", num: "0831-2405000", desc: "Main Campus Security" }, 
                    { name: "Medical Centre", num: "108", desc: "Ambulance & EMT" }, 
                    { name: "Women's Helpline", num: "1091", desc: "Rapid Response Unit" }
                  ].map((c, i) => (
                    <div key={c.num} className="contact-card fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
                      <div className="contact-icon">
                        <Phone size={24} />
                      </div>
                      <div className="contact-info">
                        <h3>{c.name}</h3>
                        <p>{c.desc}</p>
                        <div className="contact-number">{c.num}</div>
                      </div>
                      <button className="btn-call" onClick={() => (window.location.href = `tel:${c.num}`)}>
                        Dispatch Call
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "map" && (
              <div className="panel-glass slide-in map-panel">
                <div className="panel-header">
                  <div>
                    <h2>Live Safety Map</h2>
                    <p className="panel-subtitle">Geospatial overview of campus · KLS GIT, Belagavi</p>
                  </div>
                </div>
                <AdminLiveMap />
              </div>
            )}

            {tab === "roster" && (
              <div className="panel-glass slide-in">
                <div className="panel-header">
                  <div>
                    <h2>Warden Roster</h2>
                    <p className="panel-subtitle">Active shift personnel</p>
                  </div>
                </div>
                <div className="roster-list">
                  {[
                    { name: "Capt. Rajesh Kumar", role: "Chief Warden", shift: "08:00 — 16:00", status: "Active" },
                    { name: "Desk Alpha", role: "Hostel Security", shift: "16:00 — 00:00", status: "Upcoming" },
                    { name: "Supervisor Unit 3", role: "Campus Patrol", shift: "00:00 — 08:00", status: "Rest" },
                  ].map((r, i) => (
                    <div key={r.name} className="roster-item fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
                      <div className="roster-avatar">
                        <Users size={20} />
                      </div>
                      <div className="roster-details">
                        <h3>{r.name}</h3>
                        <p>{r.role}</p>
                      </div>
                      <div className="roster-shift">
                        <Clock size={14} /> {r.shift}
                      </div>
                      <div className="roster-actions">
                        <span className={`status-badge ${r.status.toLowerCase()}`}>{r.status}</span>
                        <button className="btn-dispatch" onClick={() => alert(`Dispatching: ${r.name}`)}>
                          Assign Task
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      <style>{`
        /* Root Reset & Theme for Admin Dashboard (Light Theme) */
        .admin-layout {
          min-height: 100vh;
          background-color: var(--background);
          color: var(--foreground);
          font-family: var(--font-sans);
          position: relative;
          overflow: hidden;
          padding: 1.5rem;
          display: flex;
          justify-content: center;
        }

        /* Dynamic Background */
        .admin-bg-elements {
          position: absolute;
          inset: 0;
          z-index: 0;
          overflow: hidden;
          pointer-events: none;
        }
        
        .grid-overlay {
          position: absolute;
          inset: 0;
          background-image: linear-gradient(rgba(0, 0, 0, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 0, 0, 0.03) 1px, transparent 1px);
          background-size: 30px 30px;
          opacity: 0.5;
        }

        .glow-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.15;
          animation: float 20s infinite alternate;
        }
        
        .orb-1 {
          background: rgba(230, 57, 70, 0.4); /* var(--primary) tint */
          width: 600px;
          height: 600px;
          top: -200px;
          left: -100px;
        }

        .orb-2 {
          background: rgba(59, 130, 246, 0.3);
          width: 500px;
          height: 500px;
          bottom: -150px;
          right: -100px;
          animation-delay: -5s;
        }

        @keyframes float {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(10%, 10%) scale(1.1); }
        }

        /* Layout Container */
        .admin-dashboard-container {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 1400px;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        /* Glassmorphism Header */
        .admin-header-glass {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(0, 0, 0, 0.05);
          border-radius: 20px;
          box-shadow: var(--shadow-sm);
        }

        .header-left .brand-logo {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .shield-icon {
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, var(--primary), var(--primary-hover));
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 0 4px 15px rgba(230, 57, 70, 0.3);
        }

        .brand-text h1 {
          font-family: 'Outfit', sans-serif;
          margin: 0;
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--foreground);
          letter-spacing: 0.5px;
        }

        .brand-text span {
          font-size: 0.8rem;
          color: var(--accents-3);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }

        .status-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.85rem;
          color: #10b981;
          background: rgba(16, 185, 129, 0.1);
          padding: 6px 12px;
          border-radius: 20px;
          border: 1px solid rgba(16, 185, 129, 0.2);
        }

        .status-dot {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
        }

        .status-dot.pulsing {
          box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
          animation: pulse-green 2s infinite;
        }

        @keyframes pulse-green {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }

        .time-display {
          font-family: 'Outfit', monospace;
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--foreground);
          padding: 0 1rem;
          border-left: 1px solid var(--accents-2);
          border-right: 1px solid var(--accents-2);
        }

        .user-profile {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .avatar {
          width: 40px;
          height: 40px;
          background: var(--accents-2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: var(--foreground);
          border: 2px solid white;
        }

        .user-info {
          display: flex;
          flex-direction: column;
        }

        .user-name {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--foreground);
        }

        .user-role {
          font-size: 0.75rem;
          color: var(--accents-3);
        }

        .btn-logout {
          background: white;
          border: 1px solid var(--accents-2);
          color: var(--accents-3);
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: none;
          padding: 0;
        }

        .btn-logout:hover {
          background: rgba(230, 57, 70, 0.05);
          color: var(--primary);
          border-color: rgba(230, 57, 70, 0.2);
          transform: translateY(-2px);
          box-shadow: var(--shadow-sm);
        }

        /* Content Grid */
        .admin-content-grid {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 1.5rem;
          flex: 1;
        }

        /* Sidebar */
        .admin-sidebar {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .admin-tabs-vertical {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(0, 0, 0, 0.05);
          border-radius: 20px;
          padding: 1rem;
          box-shadow: var(--shadow-sm);
        }

        .admin-tab {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: transparent;
          border: none;
          color: var(--accents-3);
          font-size: 0.95rem;
          font-weight: 600;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          text-align: left;
          box-shadow: none;
        }

        .admin-tab:hover {
          background: rgba(0, 0, 0, 0.02);
          color: var(--foreground);
        }

        .admin-tab.active {
          background: linear-gradient(90deg, rgba(230, 57, 70, 0.08), transparent);
          color: var(--primary);
        }

        .admin-tab .tab-icon {
          color: var(--accents-3);
          transition: color 0.3s;
        }

        .admin-tab.active .tab-icon {
          color: var(--primary);
        }

        .tab-indicator {
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          height: 60%;
          width: 3px;
          background: var(--primary);
          border-radius: 0 4px 4px 0;
        }

        .sidebar-stats {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .stat-card {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(0, 0, 0, 0.05);
          border-radius: 20px;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 8px;
          box-shadow: var(--shadow-sm);
        }

        .stat-label {
          font-size: 0.85rem;
          color: var(--accents-3);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-weight: 600;
        }

        .stat-value {
          font-family: 'Outfit', sans-serif;
          font-size: 2.5rem;
          font-weight: 700;
          color: var(--foreground);
          line-height: 1;
        }

        .stat-value.critical-text {
          color: var(--primary);
        }

        /* Main Panel Glass */
        .panel-glass {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(0, 0, 0, 0.05);
          border-radius: 24px;
          padding: 2rem;
          height: 100%;
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow-sm);
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
        }

        .panel-header h2 {
          font-family: 'Outfit', sans-serif;
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--foreground);
          margin: 0 0 6px 0;
        }

        .panel-subtitle {
          color: var(--accents-3);
          font-size: 0.95rem;
          margin: 0;
        }

        .pulse-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--primary);
          background: rgba(230, 57, 70, 0.1);
          padding: 6px 14px;
          border-radius: 20px;
          border: 1px solid rgba(230, 57, 70, 0.2);
        }

        /* Alerts Feed */
        .alert-feed {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .alert-card {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          background: #ffffff;
          border: 1px solid var(--accents-2);
          padding: 1.25rem;
          border-radius: 16px;
          transition: transform 0.3s ease, background 0.3s ease, box-shadow 0.3s ease;
        }

        .alert-card:hover {
          background: #fafafa;
          transform: translateY(-2px);
          border-color: var(--accents-3);
          box-shadow: var(--shadow-sm);
        }

        .alert-severity {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 80px;
          height: 80px;
          border-radius: 12px;
          border: 1px solid;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .alert-content {
          flex: 1;
        }

        .alert-type {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--foreground);
          margin: 0 0 8px 0;
        }

        .alert-location {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--accents-3);
          font-size: 0.9rem;
          margin: 0;
        }

        .alert-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 12px;
        }

        .alert-time {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.85rem;
          color: var(--accents-3);
          font-weight: 500;
        }

        .btn-action {
          display: flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          color: var(--primary);
          border: none;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          padding: 6px 12px;
          border-radius: 8px;
          transition: background 0.2s;
          box-shadow: none;
        }

        .btn-action:hover {
          background: rgba(230, 57, 70, 0.08);
          transform: none;
          box-shadow: none;
        }

        /* Contacts Grid */
        .contacts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
        }

        .contact-card {
          background: #ffffff;
          border: 1px solid var(--accents-2);
          border-radius: 20px;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 1rem;
          transition: all 0.3s;
        }

        .contact-card:hover {
          background: #fafafa;
          border-color: var(--accents-3);
          box-shadow: var(--shadow-sm);
          transform: translateY(-2px);
        }

        .contact-icon {
          width: 64px;
          height: 64px;
          background: rgba(230, 57, 70, 0.1);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary);
          margin-bottom: 0.5rem;
        }

        .contact-info h3 {
          margin: 0 0 4px 0;
          font-size: 1.1rem;
          color: var(--foreground);
          font-weight: 700;
        }

        .contact-info p {
          margin: 0 0 12px 0;
          font-size: 0.85rem;
          color: var(--accents-3);
        }

        .contact-number {
          font-family: 'Outfit', monospace;
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--foreground);
          background: var(--accents-2);
          padding: 8px 16px;
          border-radius: 12px;
          display: inline-block;
        }

        .btn-call {
          margin-top: auto;
          width: 100%;
          background: var(--primary);
          color: white;
          border: none;
          padding: 12px;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
          box-shadow: var(--shadow-sm);
        }

        .btn-call:hover {
          background: var(--primary-hover);
          transform: translateY(-2px);
        }

        /* Map Panel */
        .map-panel {
          display: flex;
          flex-direction: column;
        }

        .map-placeholder {
          flex: 1;
          background: #fafafa;
          border: 1px dashed var(--accents-3);
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          position: relative;
          overflow: hidden;
        }

        .radar {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          border: 1px solid rgba(230, 57, 70, 0.3);
          position: relative;
          margin-bottom: 20px;
        }

        .radar::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 1px solid rgba(230, 57, 70, 0.6);
          animation: ripple 2s infinite ease-out;
        }

        @keyframes ripple {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }

        /* Roster List */
        .roster-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .roster-item {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          background: #ffffff;
          border: 1px solid var(--accents-2);
          padding: 1rem 1.5rem;
          border-radius: 16px;
          transition: all 0.3s;
        }

        .roster-item:hover {
          background: #fafafa;
          border-color: var(--accents-3);
          box-shadow: var(--shadow-sm);
          transform: translateY(-2px);
        }

        .roster-avatar {
          width: 48px;
          height: 48px;
          background: var(--accents-2);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accents-3);
        }

        .roster-details {
          flex: 1;
        }

        .roster-details h3 {
          margin: 0 0 4px 0;
          font-size: 1.05rem;
          color: var(--foreground);
          font-weight: 700;
        }

        .roster-details p {
          margin: 0;
          font-size: 0.85rem;
          color: var(--accents-3);
        }

        .roster-shift {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--foreground);
          font-family: 'Outfit', monospace;
          font-weight: 500;
          background: var(--accents-2);
          padding: 8px 12px;
          border-radius: 8px;
        }

        .roster-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
          width: 200px;
          justify-content: flex-end;
        }
        
        .status-badge.active { color: #10b981; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16,185,129,0.2); }
        .status-badge.upcoming { color: #3b82f6; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59,130,246,0.2); }
        .status-badge.rest { color: var(--accents-3); background: var(--accents-2); border: 1px solid rgba(0,0,0,0.05); }

        .btn-dispatch {
          background: white;
          color: var(--foreground);
          border: 1px solid var(--accents-2);
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: none;
        }

        .btn-dispatch:hover {
          background: var(--accents-1);
          border-color: var(--accents-3);
          transform: none;
        }

        /* Animations */
        .fade-in {
          animation: fadeIn 0.5s ease forwards;
          opacity: 0;
        }
        
        .slide-in {
          animation: slideIn 0.4s ease-out forwards;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }

        /* Responsive Design */
        @media (max-width: 1024px) {
          .admin-content-grid {
            grid-template-columns: 1fr;
          }
          .admin-tabs-vertical {
            flex-direction: row;
            overflow-x: auto;
            padding: 0.5rem;
          }
          .admin-tab {
            white-space: nowrap;
          }
          .tab-indicator {
            left: 50%;
            top: auto;
            bottom: 0;
            transform: translateX(-50%);
            width: 60%;
            height: 3px;
            border-radius: 4px 4px 0 0;
          }
          .sidebar-stats {
            flex-direction: row;
          }
          .stat-card {
            flex: 1;
          }
        }

        @media (max-width: 768px) {
          .header-right {
            display: none;
          }
          .roster-item {
            flex-direction: column;
            align-items: flex-start;
          }
          .roster-actions {
            width: 100%;
            justify-content: space-between;
            margin-top: 1rem;
          }
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;
