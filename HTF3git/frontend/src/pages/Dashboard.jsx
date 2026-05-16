import { useState } from "react";
import {
  AlertTriangle, MapPin, Clock, Shield, Ambulance,
  Users, Phone, Copy, Check, Flame, Building2,
  GraduationCap, Siren, User, Map,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import SafetyMap from "../components/SafetyMap";

// ── Campus services (KLS GIT, Belagavi) ──────────────────────────────────────
const nearbyServices = [
  {
    id: 1, type: "Security",
    name: "Campus Security Control Room",
    distance: "On campus", eta: "2 min", status: "Active 24/7",
    icon: Shield, color: "#3b82f6",
    phone: "0831-2405000",
  },
  {
    id: 2, type: "Medical",
    name: "KLS GIT Medical Centre",
    distance: "Block D", eta: "3 min", status: "Available",
    icon: Ambulance, color: "#ef4444",
    phone: "108",
  },
  {
    id: 3, type: "Police",
    name: "Udyambag Police Station",
    distance: "1.2 km", eta: "5 min", status: "Available",
    icon: Siren, color: "#6366f1",
    phone: "100",
  },
  {
    id: 4, type: "Fire",
    name: "Belagavi Fire Station",
    distance: "3.8 km", eta: "10 min", status: "Standby",
    icon: Flame, color: "#f97316",
    phone: "101",
  },
];

// ── Quick-dial contacts ───────────────────────────────────────────────────────
const emergencyContacts = [
  { name: "Campus Security",   number: "0831-2405000", icon: Shield,       color: "#3b82f6" },
  { name: "Ambulance (108)",   number: "108",          icon: Ambulance,    color: "#ef4444" },
  { name: "Police (100)",      number: "100",          icon: Siren,        color: "#6366f1" },
  { name: "Fire Brigade",      number: "101",          icon: Flame,        color: "#f97316" },
  { name: "Women's Helpline",  number: "1091",         icon: Users,        color: "#8b5cf6" },
  { name: "Principal's Office",number: "0831-2405001", icon: Building2,    color: "#0ea5e9" },
];

// ── Quick actions ─────────────────────────────────────────────────────────────
const quickActions = [
  { id: 1, label: "Share Location",    icon: MapPin,        desc: "Broadcast live GPS to security" },
  { id: 2, label: "Call 112",          icon: Phone,         desc: "National emergency helpline"    },
  { id: 3, label: "Alert Warden",      icon: GraduationCap, desc: "Notify hostel / block warden"   },
];
// ── Simulated campus alert feed ───────────────────────────────────────────────
const ACTIVE_ALERTS = [
  { id: 1, status: "Critical", location: "Main Buildiing Chemistry Lab — B204",       time: "2 mins ago",  type: "Chemical Spill"  },
  { id: 2, status: "Urgent",   location: "Hostel Block C — Roof",  time: "8 mins ago",  type: "Medical"         },
  { id: 3, status: "Moderate", location: "Main Gate Parking",      time: "21 mins ago", type: "Accident"        },
];

// ─────────────────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const [copiedId,    setCopiedId]    = useState(null);
  const [mapOpen,     setMapOpen]     = useState(false);
  const { user } = useAuth();

  // Merge campus defaults with the student's personal contacts
  const personalContacts = (user?.emergencyContacts || []).map((c) => ({
    name:  c.name,
    number: c.number,
    icon:  User,
    color: "#10b981",
    personal: true,
  }));

  const allContacts = [...emergencyContacts, ...personalContacts];

  const handleCopy = (number, name) => {
    navigator.clipboard.writeText(number);
    setCopiedId(name);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const triggerSOS = () => {
    window.dispatchEvent(new CustomEvent("trigger-sos"));
  };

  return (
    <div className="dashboard-container">

      {/* ── SOS Hero ──────────────────────────────────────────────────────── */}
      <div className="sos-section">
        <button className="sos-button" onClick={triggerSOS} aria-label="Trigger SOS">
          <AlertTriangle size={44} />
          <span>SOS</span>
        </button>
        <div className="sos-info">
          <h1>Campus Emergency Response</h1>
          <p>
            Press SOS to instantly alert KLS GIT Security, the Medical Centre,
            and administration. Your GPS location is shared automatically.
          </p>
          <p style={{ fontSize: "0.8rem", marginTop: "8px", color: "var(--primary)", fontWeight: 600 }}>
            KLS Gogte Institute of Technology · Belagavi — 590008
          </p>
        </div>
      </div>

      {/* ── Quick Actions ─────────────────────────────────────────────────── */}
      <div className="quick-actions-grid quick-actions-grid-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <div key={action.id} className="action-card card">
              <div className="action-icon">
                <Icon size={24} />
              </div>
              <div className="action-content">
                <h3>{action.label}</h3>
                <p>{action.desc}</p>
              </div>
            </div>
          );
        })}

        {/* Safety Map card — highlighted */}
        <div
          className="action-card card safety-map-card"
          onClick={() => setMapOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && setMapOpen(true)}
          aria-label="Open campus safety map"
        >
          <div className="action-icon safety-map-icon">
            <Map size={24} />
          </div>
          <div className="action-content">
            <h3>Safety Map</h3>
            <p>Live hazard zones &amp; safe paths</p>
          </div>
          <span className="safety-map-badge">⚠ 1 Critical</span>
        </div>
      </div>

      {/* Safety Map modal */}
      {mapOpen && <SafetyMap onClose={() => setMapOpen(false)} />}

      {/* ── Main Grid ─────────────────────────────────────────────────────── */}
      <div className="dashboard-grid">

        {/* Live Campus Alert Feed */}
        <div className="dashboard-panel">
          <h2>
            <span className="live-dot" aria-hidden="true" />
            Campus Alerts
          </h2>
          <div className="alert-list">
            {ACTIVE_ALERTS.map((alert) => (
              <div key={alert.id} className={`alert-item ${alert.status.toLowerCase()}`}>
                <div className="alert-info">
                  <p className="alert-location">
                    <MapPin size={14} /> {alert.location}
                  </p>
                  <small>
                    <Clock size={11} /> {alert.time} &nbsp;·&nbsp; {alert.type}
                  </small>
                </div>
                <span className="alert-badge">{alert.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick-Dial Contacts */}
        <div className="dashboard-panel">
          <h2>Emergency Contacts</h2>
          <div className="contacts-list">
            {allContacts.map((contact) => {
              const Icon = contact.icon;
              return (
                <div key={contact.name} className="contact-item">
                  <div
                    className="contact-icon-wrapper"
                    style={{ background: `${contact.color}15`, color: contact.color }}
                  >
                    <Icon size={17} />
                  </div>
                  <div className="contact-details">
                    <span className="contact-name">
                      {contact.name}
                      {contact.personal && (
                        <span className="contact-personal-badge">My Contact</span>
                      )}
                    </span>
                    <span className="contact-number">{contact.number}</span>
                  </div>
                  <button
                    className={`copy-btn ${copiedId === contact.name ? "copied" : ""}`}
                    onClick={() => handleCopy(contact.number, contact.name)}
                    aria-label={`Copy ${contact.name} number`}
                  >
                    {copiedId === contact.name ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Nearby Campus Services */}
        <div className="dashboard-panel" style={{ gridColumn: "span 2" }}>
          <h2>Nearby Help on Campus</h2>
          <div className="services-list grid-cols-2">
            {nearbyServices.map((service) => {
              const Icon = service.icon;
              return (
                <div key={service.id} className="service-item">
                  <div
                    className="service-icon"
                    style={{ background: `${service.color}15`, color: service.color }}
                  >
                    <Icon size={20} />
                  </div>
                  <div className="service-info">
                    <span className="service-name">{service.name}</span>
                    <span className="service-meta">
                      {service.distance} · ETA {service.eta}
                    </span>
                  </div>
                  <button
                    className="service-call-btn"
                    onClick={() => { window.location.href = `tel:${service.phone}`; }}
                    aria-label={`Call ${service.name}`}
                  >
                    <Phone size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
