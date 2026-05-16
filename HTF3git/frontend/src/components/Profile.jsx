import { useState, useEffect, useRef } from "react";
import {
  X, User, Phone, Plus, Trash2, Save, CheckCircle,
  GraduationCap, BookOpen, Shield, ChevronRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const ROLE_META = {
  student:  { label: "Student",  icon: GraduationCap, color: "#6366f1" },
  faculty:  { label: "Faculty",  icon: BookOpen,       color: "#0ea5e9" },
  security: { label: "Security", icon: Shield,         color: "#ef4444" },
};

// ── Avatar initials helper ────────────────────────────────────────────────────
const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("") || "?";

// ─────────────────────────────────────────────────────────────────────────────
const Profile = ({ onClose }) => {
  const { user, updateProfile } = useAuth();
  const panelRef = useRef(null);

  // Local editable state
  const [contacts, setContacts] = useState(
    () => (user?.emergencyContacts || []).map((c, i) => ({ ...c, _id: i }))
  );
  const [newName,   setNewName]   = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [saved,     setSaved]     = useState(false);
  const nextId = useRef(contacts.length);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const addContact = () => {
    const trimName   = newName.trim();
    const trimNumber = newNumber.trim();
    if (!trimName || !trimNumber) return;
    setContacts(prev => [...prev, { _id: nextId.current++, name: trimName, number: trimNumber }]);
    setNewName("");
    setNewNumber("");
  };

  const removeContact = (id) => setContacts(prev => prev.filter(c => c._id !== id));

  const handleSave = () => {
    const clean = contacts.map(({ name, number }) => ({ name, number }));
    updateProfile({ emergencyContacts: clean });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const roleMeta = ROLE_META[user?.role] || ROLE_META.student;
  const RoleIcon = roleMeta.icon;

  return (
    <>
      {/* Backdrop */}
      <div className="profile-backdrop" aria-hidden="true" />

      {/* Slide-in panel */}
      <aside className="profile-panel" ref={panelRef} role="dialog" aria-label="Your Profile">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="profile-header">
          <div className="profile-avatar">
            {initials(user?.name)}
          </div>
          <div className="profile-identity">
            <h2 className="profile-name">{user?.name || "—"}</h2>
            <div className="profile-usn">{user?.usn || "—"}</div>
            <div className="profile-role-chip" style={{ background: `${roleMeta.color}18`, color: roleMeta.color }}>
              <RoleIcon size={12} />
              {roleMeta.label}
            </div>
          </div>
          <button className="profile-close-btn" onClick={onClose} aria-label="Close profile">
            <X size={18} />
          </button>
        </div>

        <div className="profile-divider" />

        {/* ── Campus info strip ───────────────────────────────────────────── */}
        <div className="profile-campus-strip">
          <span>KLS Gogte Institute of Technology</span>
          <ChevronRight size={13} />
          <span>Belagavi — 590008</span>
        </div>

        <div className="profile-divider" />

        {/* ── Emergency Contacts ──────────────────────────────────────────── */}
        <div className="profile-section">
          <div className="profile-section-header">
            <Phone size={15} />
            <h3>My Emergency Contacts</h3>
          </div>
          <p className="profile-section-desc">
            These contacts appear in your Dashboard and are alerted during an SOS.
          </p>

          {/* Existing contacts */}
          <div className="profile-contacts-list">
            {contacts.length === 0 && (
              <p className="profile-empty">No contacts added yet.</p>
            )}
            {contacts.map((c) => (
              <div key={c._id} className="profile-contact-row">
                <div className="profile-contact-avatar">
                  <User size={14} />
                </div>
                <div className="profile-contact-info">
                  <span className="profile-contact-name">{c.name}</span>
                  <span className="profile-contact-number">{c.number}</span>
                </div>
                <button
                  className="profile-remove-btn"
                  onClick={() => removeContact(c._id)}
                  aria-label={`Remove ${c.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Add new contact */}
          <div className="profile-add-row">
            <input
              type="text"
              className="profile-input"
              placeholder="Contact name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addContact()}
            />
            <input
              type="tel"
              className="profile-input"
              placeholder="+91 XXXXX XXXXX"
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addContact()}
            />
            <button
              className="profile-add-btn"
              onClick={addContact}
              aria-label="Add contact"
              disabled={!newName.trim() || !newNumber.trim()}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* ── Save button ─────────────────────────────────────────────────── */}
        <div className="profile-footer">
          <button className={`profile-save-btn ${saved ? "saved" : ""}`} onClick={handleSave}>
            {saved
              ? <><CheckCircle size={16} /> Saved!</>
              : <><Save size={16} /> Save Changes</>
            }
          </button>
        </div>

      </aside>
    </>
  );
};

export default Profile;
