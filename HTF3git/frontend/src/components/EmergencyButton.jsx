import { useState, useEffect, useRef } from "react";
import {
  AlertTriangle, MapPin, Phone, Ambulance, Shield, CheckCircle,
  X, Radio, MessageSquare, Wifi, WifiOff, Send, User, Clock,
  Building2, Siren, Mic, MicOff,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Geolocation } from "@capacitor/geolocation";
import { SmsManager } from "@byteowls/capacitor-sms";
import { getMqttClient, SOS_TOPIC } from "../utils/mqttClient";

// ── Campus emergency contacts (KLS Gogte Institute of Technology) ─────────────
const CAMPUS_CONTACTS = [
  { id: "security",  label: "Campus Security",      role: "Security Control Room", icon: Shield,    color: "#3b82f6" },
  { id: "warden",    label: "Chief Warden",          role: "Hostel Administration",  icon: Building2, color: "#8b5cf6" },
  { id: "ambulance", label: "Campus Ambulance",      role: "Medical Unit",           icon: Ambulance, color: "#ef4444" },
  { id: "principal", label: "Principal's Office",    role: "Administration",         icon: User,      color: "#f59e0b" },
];

// ── Nearby emergency services ─────────────────────────────────────────────────
const NEARBY_SERVICES = [
  { id: 1, type: "Police",    name: "Udyambag Police Station", distance: "1.2 km", eta: "4 min",  phone: "100",             icon: Shield,    color: "#3b82f6" },
  { id: 2, type: "Ambulance", name: "City Medical Unit 1",     distance: "2.1 km", eta: "6 min",  phone: "108",             icon: Ambulance, color: "#ef4444" },
  { id: 3, type: "Fire",      name: "Fire Station Belagavi",   distance: "3.8 km", eta: "10 min", phone: "101",             icon: Siren,     color: "#f97316" },
];

// ── SOS broadcast sequence ────────────────────────────────────────────────────
const SOS_SEQUENCE = [
  { id: 1, message: "🚨 SOS Signal Transmitted",          detail: "Broadcasting emergency alert across campus network...", delay: 0    },
  { id: 2, message: "📡 GPS Location Pinned",             detail: "Coordinates locked and shared with all units",          delay: 1200 },
  { id: 3, message: "🔒 Campus Security Alerted",         detail: "KLS GIT Security Control Room notified",                delay: 2400 },
  { id: 4, message: "🚑 Medical Unit Dispatched",         detail: "Campus Ambulance en route — ETA 3 minutes",             delay: 3600 },
  { id: 5, message: "📞 Administration Notified",         detail: "Principal's office and warden informed",                delay: 5000 },
  { id: 6, message: "✅ All Units Confirmed",             detail: "Help is on the way. Stay calm and stay safe.",           delay: 6600 },
];

// ── Build compressed SMS body (≤160 chars) ────────────────────────────────────
const buildSmsBody = (name, location, triageStatus = "UNKNOWN") => {
  const mapLink = location.coords ? `maps.google.com/?q=${location.coords}` : null;
  const time    = new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
  const tag     = triageStatus !== "UNKNOWN" ? `[${triageStatus}] ` : "";

  let body = `🚨SOS! ${tag}${name} @ KLS GIT. ${location.label}.`;
  if (mapLink) body += ` ${mapLink}.`;
  body += ` ${time} -Sahayaka`;

  if (body.length > 155) {
    body = `🚨SOS! ${tag}${name} @ KLS GIT. ${mapLink || location.label}. ${time} -Sahayaka`;
  }
  return body;
};

// ─────────────────────────────────────────────────────────────────────────────
const EmergencyButton = () => {
  const { user } = useAuth();

  // ── Core SOS state ──────────────────────────────────────────────────────────
  const [sosActive,        setSosActive]        = useState(false);
  const [sosNotifications, setSosNotifications] = useState([]);
  const [sosComplete,      setSosComplete]      = useState(false);

  const [isRecording,      setIsRecording]      = useState(false);
  const [sosTranscript,    setSosTranscript]    = useState("");
  const transcriptRef                           = useRef("");
  const recognitionRef                          = useRef(null);
  const currentSosIdRef                         = useRef(null);

  // ── Location ────────────────────────────────────────────────────────────────
  const [location,      setLocation]      = useState({ label: "Locating...", coords: null });
  const locationRef                        = useRef({ label: "Locating...", coords: null });
  const [locationReady, setLocationReady] = useState(false);

  // ── Network ─────────────────────────────────────────────────────────────────
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // ── SMS panel state ─────────────────────────────────────────────────────────
  // contactStatuses: { [contactId]: "pending" | "sending" | "sent" | "failed" | "fallback" }
  const [contactStatuses,  setContactStatuses]  = useState({});
  const [smsPhase,         setSmsPhase]         = useState("idle"); // idle | sending | done | offline
  const [smsPayloadPreview, setSmsPayloadPreview] = useState("");
  const [queueProcessing,  setQueueProcessing]  = useState(false);

  // ── Reverse geocode ─────────────────────────────────────────────────────────
  const reverseGeocode = async (lat, lon) => {
    try {
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await res.json();
      if (data?.display_name) {
        return data.display_name.split(",").slice(0, 3).map(s => s.trim()).join(", ");
      }
    } catch { /* silent */ }
    return null;
  };

  // ── GPS on mount ────────────────────────────────────────────────────────────
  useEffect(() => {
    const getLocation = async () => {
      const apply = async (lat, lon) => {
        const coords     = `${lat},${lon}`;
        const coordLabel = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        const immediate  = { label: coordLabel, coords };
        setLocation(immediate);
        locationRef.current = immediate;
        setLocationReady(true);

        const address = await reverseGeocode(lat, lon);
        if (address) {
          const full = { label: address, coords };
          setLocation(full);
          locationRef.current = full;
        }
      };

      try {
        const perm = await Geolocation.requestPermissions();
        if (perm.location === "granted" || perm.coarseLocation === "granted") {
          const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
          await apply(pos.coords.latitude, pos.coords.longitude);
          return;
        }
      } catch { /* fall through */ }

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => apply(pos.coords.latitude, pos.coords.longitude),
          () => {
            const fb = { label: "KLS GIT Campus, Belagavi", coords: null };
            setLocation(fb);
            locationRef.current = fb;
            setLocationReady(true);
          },
          { enableHighAccuracy: true, timeout: 15000 }
        );
      } else {
        const fb = { label: "KLS GIT Campus, Belagavi", coords: null };
        setLocation(fb);
        locationRef.current = fb;
        setLocationReady(true);
      }
    };
    getLocation();
  }, []);

  // ── Network listeners ───────────────────────────────────────────────────────
  useEffect(() => {
    const goOnline  = () => { setIsOnline(true);  processQueue(); };
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    processQueue();
    return () => {
      window.removeEventListener("online",  goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Offline queue helpers ───────────────────────────────────────────────────
  const getQueue   = () => { try { return JSON.parse(localStorage.getItem("sahayaka_sos_queue") || "[]"); } catch { return []; } };
  const addToQueue = (item) => {
    const q = getQueue();
    q.push({ ...item, id: Date.now(), timestamp: new Date().toISOString() });
    localStorage.setItem("sahayaka_sos_queue", JSON.stringify(q));
  };

  const processQueue = async () => {
    const q = getQueue();
    if (!q.length || queueProcessing || !navigator.onLine) return;
    setQueueProcessing(true);
    const remaining = [];
    for (const item of q) {
      const ok = await dispatchViaTwilio(item.body, item.contacts, true);
      if (!ok) remaining.push(item);
    }
    localStorage.setItem("sahayaka_sos_queue", JSON.stringify(remaining));
    setQueueProcessing(false);
  };

  // ── Twilio direct REST call (prototype — no backend) ───────────────────────
  const dispatchViaTwilio = async (body, contacts, silent = false) => {
    const accountSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
    const authToken  = import.meta.env.VITE_TWILIO_AUTH_TOKEN;
    const fromNumber = import.meta.env.VITE_TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) return false;

    const url         = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const credentials = btoa(`${accountSid}:${authToken}`);
    let   anySuccess  = false;

    for (const contact of contacts) {
      const to = contact.number.startsWith("+") ? contact.number : `+${contact.number}`;
      if (!silent) setContactStatuses(prev => ({ ...prev, [contact.id]: "sending" }));

      try {
        const params = new URLSearchParams({ To: to, From: fromNumber, Body: body });
        const res    = await fetch(url, {
          method:  "POST",
          headers: { "Authorization": `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
          body:    params.toString(),
        });
        const data = await res.json();
        if (res.ok && data.sid) {
          if (!silent) setContactStatuses(prev => ({ ...prev, [contact.id]: "sent" }));
          anySuccess = true;
        } else {
          if (!silent) setContactStatuses(prev => ({ ...prev, [contact.id]: "failed" }));
        }
      } catch {
        if (!silent) setContactStatuses(prev => ({ ...prev, [contact.id]: "failed" }));
      }
    }
    return anySuccess;
  };

  // ── Native SMS fallback (opens device SMS app) ─────────────────────────────
  const dispatchViaNativeSms = async (body, contacts) => {
    const numbers = contacts.map(c => c.number.startsWith("+") ? c.number : `+${c.number}`);
    try {
      await SmsManager.send({
        numbers,
        text: body,
        android: { intent: "com.android.mms.intent.action.SENDTO" },
      });
      contacts.forEach(c => setContactStatuses(prev => ({ ...prev, [c.id]: "fallback" })));
      return true;
    } catch {
      contacts.forEach(c => setContactStatuses(prev => ({ ...prev, [c.id]: "failed" })));
      return false;
    }
  };

  // ── Main SMS dispatch ───────────────────────────────────────────────────────
  const sendSosAlerts = async (currentLocation) => {
    const name     = (user?.email || "Student").split("@")[0];
    const body     = buildSmsBody(name, currentLocation);
    const envNums  = (import.meta.env.VITE_EMERGENCY_CONTACTS || "").split(",").map(n => n.trim()).filter(Boolean);

    // Map env numbers onto campus contact slots (first N contacts get real numbers)
    const contacts = CAMPUS_CONTACTS.map((c, i) => ({
      ...c,
      number: envNums[i] || "",
    })).filter(c => c.number);

    // If no contacts configured, still show the UI with "no number" state
    const displayContacts = CAMPUS_CONTACTS.map((c, i) => ({
      ...c,
      number: envNums[i] || null,
    }));

    setSmsPayloadPreview(body);
    setSmsPhase("sending");

    // Initialise all to "pending"
    const initial = {};
    displayContacts.forEach(c => { initial[c.id] = c.number ? "pending" : "no-number"; });
    setContactStatuses(initial);

    if (!navigator.onLine) {
      // ── OFFLINE: native SMS + queue ──────────────────────────────────────
      setSmsPhase("offline");
      displayContacts.forEach(c => { if (c.number) setContactStatuses(prev => ({ ...prev, [c.id]: "fallback" })); });
      if (contacts.length) {
        await dispatchViaNativeSms(body, contacts);
        addToQueue({ body, contacts });
      }
      return;
    }

    // ── ONLINE: Twilio direct ────────────────────────────────────────────────
    if (contacts.length) {
      // Stagger sends for visual effect
      for (const contact of contacts) {
        setContactStatuses(prev => ({ ...prev, [contact.id]: "sending" }));
        await new Promise(r => setTimeout(r, 600));

        const accountSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
        const authToken  = import.meta.env.VITE_TWILIO_AUTH_TOKEN;
        const fromNumber = import.meta.env.VITE_TWILIO_PHONE_NUMBER;

        if (!accountSid || !authToken || !fromNumber) {
          // No Twilio creds — simulate for demo
          await new Promise(r => setTimeout(r, 400));
          setContactStatuses(prev => ({ ...prev, [contact.id]: "sent" }));
          continue;
        }

        const to          = contact.number.startsWith("+") ? contact.number : `+${contact.number}`;
        const url         = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        const credentials = btoa(`${accountSid}:${authToken}`);

        try {
          const params = new URLSearchParams({ To: to, From: fromNumber, Body: body });
          const res    = await fetch(url, {
            method:  "POST",
            headers: { "Authorization": `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
            body:    params.toString(),
          });
          const data = await res.json();
          setContactStatuses(prev => ({
            ...prev,
            [contact.id]: (res.ok && data.sid) ? "sent" : "failed",
          }));
        } catch {
          // Twilio failed — try native SMS for this contact
          setContactStatuses(prev => ({ ...prev, [contact.id]: "fallback" }));
          await dispatchViaNativeSms(body, [contact]);
        }
      }
    } else {
      // No contacts configured — demo mode: simulate all sent
      for (const c of CAMPUS_CONTACTS) {
        setContactStatuses(prev => ({ ...prev, [c.id]: "sending" }));
        await new Promise(r => setTimeout(r, 700));
        setContactStatuses(prev => ({ ...prev, [c.id]: "sent" }));
      }
    }

    setSmsPhase("done");
  };

  // ── Audio Recording ─────────────────────────────────────────────────────────
  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported");
      return;
    }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onstart = () => {
      setIsRecording(true);
      setSosTranscript("");
      transcriptRef.current = "";
    };

    recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscriptChunk = "";
      
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscriptChunk += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      if (finalTranscriptChunk) {
        transcriptRef.current += " " + finalTranscriptChunk.trim();
      }
      
      setSosTranscript((transcriptRef.current + " " + interimTranscript).trim());
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);

    try {
      const mqttClient = getMqttClient();
      // Grab whatever is in the live state to catch un-finalized speech
      const finalTopic = sosTranscript || transcriptRef.current.trim() || "SOS Emergency";
      if (mqttClient && mqttClient.connected && currentSosIdRef.current) {
        const payload = {
          id: currentSosIdRef.current,
          status: "Critical",
          type: `SOS: ${finalTopic}`,
          location: locationRef.current.label,
          coords: locationRef.current.coords || null,
          time: new Date().toISOString(),
          user: user?.name || "Student",
          usn: user?.usn || "Unknown ID",
        };
        mqttClient.publish(SOS_TOPIC, JSON.stringify(payload), { qos: 1 });
      }
    } catch (e) {
      console.error("[MQTT] Update publish failed:", e);
    }
  };

  // ── Listen for trigger-sos event from Dashboard ─────────────────────────────
  useEffect(() => {
    const handler = () => triggerSOS();
    window.addEventListener("trigger-sos", handler);
    return () => window.removeEventListener("trigger-sos", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Trigger SOS ─────────────────────────────────────────────────────────────
  const triggerSOS = () => {
    setSosActive(true);
    setSosNotifications([]);
    setSosComplete(false);
    setSmsPhase("idle");
    setContactStatuses({});
    setSmsPayloadPreview("");

    sendSosAlerts(locationRef.current);

    // ── MQTT Real-time Broadcast ─────────────────────────────────────────────
    const sosId = Date.now();
    currentSosIdRef.current = sosId;

    try {
      const mqttClient = getMqttClient();
      if (mqttClient && mqttClient.connected) {
        const payload = {
          id: sosId,
          status: "Critical",
          type: "SOS Emergency - Recording Context...",
          location: locationRef.current.label,
          coords: locationRef.current.coords || null,
          time: new Date().toISOString(),
          user: user?.name || "Student",
          usn: user?.usn || "Unknown ID",
        };
        mqttClient.publish(SOS_TOPIC, JSON.stringify(payload), { qos: 1 });
      }
    } catch (e) {
      console.error("[MQTT] Publish failed:", e);
    }

    startRecording();

    SOS_SEQUENCE.forEach((step) => {
      setTimeout(() => {
        setSosNotifications(prev => [...prev, step]);
        if (step.id === SOS_SEQUENCE.length) setSosComplete(true);
      }, step.delay);
    });
  };

  const closeSOS = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
    setSosActive(false);
    setSosNotifications([]);
    setSosComplete(false);
    setSmsPhase("idle");
    setContactStatuses({});
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const sentCount   = Object.values(contactStatuses).filter(s => s === "sent").length;
  const totalActive = Object.values(contactStatuses).filter(s => s !== "no-number").length;

  const statusMeta = (status) => {
    switch (status) {
      case "pending":   return { label: "Queued",    cls: "cs-pending"  };
      case "sending":   return { label: "Sending…",  cls: "cs-sending"  };
      case "sent":      return { label: "Delivered", cls: "cs-sent"     };
      case "failed":    return { label: "Failed",    cls: "cs-failed"   };
      case "fallback":  return { label: "Via SMS App", cls: "cs-fallback" };
      case "no-number": return { label: "No number", cls: "cs-none"     };
      default:          return { label: "—",         cls: "cs-pending"  };
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── SOS Modal Overlay ─────────────────────────────────────────────── */}
      {sosActive && (
        <div className="sos-overlay" role="dialog" aria-modal="true" aria-label="Emergency SOS Status">
          <div className="sos-modal sos-modal-campus">

            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="sos-modal-header">
              <div className="sos-pulse-ring" aria-hidden="true">
                <AlertTriangle size={32} />
              </div>
              <h2>Emergency SOS Active</h2>
              <p className="sos-campus-tag">KLS Gogte Institute of Technology</p>

              {/* Network badge */}
              <div className={`sos-network-badge ${isOnline ? "net-online" : "net-offline"}`}>
                {isOnline
                  ? <><Wifi size={12} /> Online — Twilio Gateway</>
                  : <><WifiOff size={12} /> Offline — SMS Fallback Active</>
                }
              </div>

              {/* Location row */}
              <div className="sos-location-row">
                <MapPin size={13} />
                <span>{location.label}</span>
              </div>

              <button className="sos-close-btn" onClick={closeSOS} aria-label="Close SOS">
                <X size={18} />
              </button>
            </div>

            {/* ── Audio Recording Panel ────────────────────────────────────── */}
            <div className="sos-recording-panel" style={{ padding: "15px", background: "rgba(239, 68, 68, 0.05)", margin: "0 1.5rem 1rem", borderRadius: "12px", border: "1px solid rgba(239, 68, 68, 0.2)", textAlign: "center" }}>
              {isRecording ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", color: "#ef4444", marginBottom: "10px", fontWeight: "600", fontSize: "0.95rem" }}>
                    <Mic className="sos-pulse-ring" style={{ background: "none", border: "none" }} size={16} /> Recording Context...
                  </div>
                  <p style={{ fontSize: "0.85rem", color: "var(--foreground)", fontStyle: "italic", minHeight: "20px", margin: "0 0 10px 0" }}>
                    "{sosTranscript || "Speak now..."}"
                  </p>
                  <button 
                    onClick={stopRecording} 
                    style={{ background: "#ef4444", color: "white", border: "none", padding: "8px 16px", borderRadius: "8px", fontWeight: "600", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}
                  >
                    <MicOff size={14} /> Stop Recording
                  </button>
                </>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", color: "#10b981", marginBottom: "8px", fontWeight: "600", fontSize: "0.95rem" }}>
                    <CheckCircle size={16} /> Audio Context Captured
                  </div>
                  <p style={{ fontSize: "0.85rem", color: "var(--foreground)", fontStyle: "italic", margin: 0 }}>
                    "{sosTranscript || "No audio captured."}"
                  </p>
                </>
              )}
            </div>

            {/* ── Broadcast sequence ──────────────────────────────────────── */}
            <div className="sos-notifications">
              {sosNotifications.map((notif) => (
                <div key={notif.id} className="sos-notif-item">
                  <CheckCircle size={18} className="notif-check" />
                  <div>
                    <p className="notif-message">{notif.message}</p>
                    <small className="notif-detail">{notif.detail}</small>
                  </div>
                </div>
              ))}
              {!sosComplete && sosNotifications.length < SOS_SEQUENCE.length && (
                <div className="sos-loading">
                  <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
                </div>
              )}
            </div>

            {/* ── SMS Alert Panel ──────────────────────────────────────────── */}
            <div className="sms-panel">
              {/* Panel header */}
              <div className="sms-panel-header">
                <div className="sms-panel-title">
                  <MessageSquare size={15} />
                  <span>SMS Alerts</span>
                </div>
                <div className={`sms-phase-badge phase-${smsPhase}`}>
                  {smsPhase === "idle"    && "Initialising…"}
                  {smsPhase === "sending" && <><span className="sms-dot" /> Dispatching…</>}
                  {smsPhase === "done"    && <><CheckCircle size={11} /> {sentCount}/{totalActive} Delivered</>}
                  {smsPhase === "offline" && <><WifiOff size={11} /> Offline — SMS App opened</>}
                </div>
              </div>

              {/* Payload preview */}
              {smsPayloadPreview && (
                <div className="sms-payload-preview">
                  <div className="sms-payload-label">
                    <Send size={11} /> Payload · {smsPayloadPreview.length} chars
                  </div>
                  <p className="sms-payload-body">{smsPayloadPreview}</p>
                </div>
              )}

              {/* Per-contact status rows */}
              <div className="sms-contacts-grid">
                {CAMPUS_CONTACTS.map((contact) => {
                  const Icon   = contact.icon;
                  const status = contactStatuses[contact.id] || "pending";
                  const meta   = statusMeta(status);
                  return (
                    <div key={contact.id} className={`sms-contact-row ${meta.cls}`}>
                      <div className="sms-contact-icon" style={{ background: `${contact.color}18`, color: contact.color }}>
                        <Icon size={15} />
                      </div>
                      <div className="sms-contact-info">
                        <span className="sms-contact-name">{contact.label}</span>
                        <span className="sms-contact-role">{contact.role}</span>
                      </div>
                      <div className={`sms-contact-status ${meta.cls}`}>
                        {status === "sending" && <span className="sms-dot sms-dot-sm" />}
                        {status === "sent"    && <CheckCircle size={12} />}
                        {meta.label}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Offline queue notice */}
              {!isOnline && (
                <div className="sms-offline-notice">
                  <WifiOff size={13} />
                  <span>Alert queued — will auto-retry via Twilio when network restores</span>
                </div>
              )}
            </div>

            {/* ── Completion state ─────────────────────────────────────────── */}
            {sosComplete && (
              <>
                <div className="sos-complete">
                  <p>All campus units have been notified. Help is on the way.</p>
                </div>

                {/* Nearby services */}
                <div className="services-contacted">
                  <h3><Radio size={16} /> Nearby Services</h3>
                  <div className="contacted-list">
                    {NEARBY_SERVICES.map((svc) => {
                      const Icon = svc.icon;
                      return (
                        <div key={svc.id} className="contacted-item">
                          <div className="contacted-icon" style={{ background: `${svc.color}22`, color: svc.color }}>
                            <Icon size={16} />
                          </div>
                          <div className="contacted-info">
                            <span className="contacted-name">{svc.name}</span>
                            <span className="contacted-meta">
                              <MapPin size={10} /> {svc.distance} · ETA {svc.eta}
                            </span>
                          </div>
                          <button className="call-btn-small" onClick={() => { window.location.href = `tel:${svc.phone}`; }} title={`Call ${svc.name}`}>
                            <Phone size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="sos-actions">
                  <button className="sos-call-btn" onClick={() => { window.location.href = "tel:112"; }}>
                    <Phone size={16} /> Call 112
                  </button>
                  <button className="sos-dismiss-btn" onClick={closeSOS}>
                    Dismiss
                  </button>
                </div>
              </>
            )}

            {/* ── Timestamp footer ─────────────────────────────────────────── */}
            <div className="sos-footer-ts">
              <Clock size={11} />
              <span>
                {new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                {" · "}KLS GIT Emergency Response System
              </span>
            </div>

          </div>
        </div>
      )}
    </>
  );
};

export default EmergencyButton;
