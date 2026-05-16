import { Link } from "react-router-dom";
import { ArrowRight, Globe, Zap, Shield, MapPin, Bell, HeartPulse } from "lucide-react";

const Landing = () => {
  return (
    <div style={{ overflowX: "hidden" }}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="container" style={{ paddingTop: "12vh", textAlign: "center" }}>
        <header className="hero-section" style={{ marginBottom: "80px" }}>

          {/* Campus pill */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            padding: "6px 16px", borderRadius: "100px",
            background: "rgba(230, 57, 70, 0.05)", fontSize: "0.85rem",
            fontWeight: "600", color: "var(--primary)", marginBottom: "32px",
            border: "1px solid rgba(230, 57, 70, 0.1)"
          }}>
            <Shield size={14} /> KLS Gogte Institute of Technology · Belagavi
          </div>

          <h1 style={{
            fontSize: "clamp(2.8rem, 7vw, 4.5rem)", fontWeight: "900",
            lineHeight: "1.05", marginBottom: "24px", letterSpacing: "-0.04em"
          }}>
            Campus Safety at{" "}
            <span style={{ color: "var(--primary)" }}>One Tap</span>.
          </h1>

          <p style={{
            maxWidth: "620px", margin: "0 auto 48px auto",
            fontSize: "1.2rem", color: "var(--accents-3)", lineHeight: "1.65"
          }}>
            Sahayaka is KLS GIT's AI-powered emergency response system — instant SOS
            alerts, real-time triage, and offline-first communication built for every
            corner of our campus.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: "16px", flexWrap: "wrap" }}>
            <Link to="/auth" style={{ textDecoration: "none" }}>
              <button style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "1rem 2.5rem", fontSize: "1.05rem"
              }}>
                Enter Campus Portal <ArrowRight size={20} />
              </button>
            </Link>
            <Link to="/auth" style={{ textDecoration: "none" }}>
              <button className="secondary-btn" style={{ padding: "1rem 2.5rem", fontSize: "1.05rem" }}>
                Student Login
              </button>
            </Link>
          </div>

          {/* Campus stat strip */}
          <div style={{
            display: "flex", justifyContent: "center", gap: "48px",
            marginTop: "56px", flexWrap: "wrap"
          }}>
            {[
              { value: "6,000+", label: "Students Protected" },
              { value: "< 3 min", label: "Avg. Response Time" },
              { value: "24 / 7", label: "Campus Monitoring" },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.75rem", fontWeight: "900", color: "var(--foreground)", letterSpacing: "-0.03em" }}>
                  {s.value}
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--accents-3)", fontWeight: "600", marginTop: "4px" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </header>

        {/* ── Feature cards ──────────────────────────────────────────────── */}
        <section style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "24px", marginTop: "40px", paddingBottom: "100px"
        }}>
          <div className="card" style={{ textAlign: "left" }}>
            <div className="action-icon" style={{ marginBottom: "20px" }}>
              <HeartPulse size={26} />
            </div>
            <h3 style={{ fontSize: "1.3rem", marginBottom: "10px" }}>AI Triage Assistant</h3>
            <p>
              Describe symptoms in Kannada, Hindi, or English. Sahayaka classifies
              severity — Green to Red — and guides you with step-by-step first aid
              until campus medical arrives.
            </p>
          </div>

          <div className="card" style={{ textAlign: "left" }}>
            <div className="action-icon" style={{ marginBottom: "20px" }}>
              <Zap size={26} />
            </div>
            <h3 style={{ fontSize: "1.3rem", marginBottom: "10px" }}>Offline-First SOS</h3>
            <p>
              Works in basement labs, server rooms, and dead zones across KLS GIT.
              Alerts are queued locally and auto-dispatched via SMS the moment
              connectivity returns.
            </p>
          </div>

          <div className="card" style={{ textAlign: "left" }}>
            <div className="action-icon" style={{ marginBottom: "20px" }}>
              <MapPin size={26} />
            </div>
            <h3 style={{ fontSize: "1.3rem", marginBottom: "10px" }}>Safe Path Routing</h3>
            <p>
              Live hazard overlays on the campus map — active fires, chemical spills,
              or blocked exits. The routing engine recalculates the safest path to
              the nearest assembly point in real time.
            </p>
          </div>

          <div className="card" style={{ textAlign: "left" }}>
            <div className="action-icon" style={{ marginBottom: "20px" }}>
              <Globe size={26} />
            </div>
            <h3 style={{ fontSize: "1.3rem", marginBottom: "10px" }}>Multilingual Support</h3>
            <p>
              Kannada, Hindi, Marathi, Telugu, Tamil and more. Every student and
              faculty member can report and receive guidance in their native language.
            </p>
          </div>

          <div className="card" style={{ textAlign: "left" }}>
            <div className="action-icon" style={{ marginBottom: "20px" }}>
              <Bell size={26} />
            </div>
            <h3 style={{ fontSize: "1.3rem", marginBottom: "10px" }}>Instant Campus Alerts</h3>
            <p>
              Security control room, chief warden, campus ambulance, and the
              principal's office are notified simultaneously the moment an SOS
              is triggered — no manual relay needed.
            </p>
          </div>

          <div className="card" style={{ textAlign: "left" }}>
            <div className="action-icon" style={{ marginBottom: "20px" }}>
              <Shield size={26} />
            </div>
            <h3 style={{ fontSize: "1.3rem", marginBottom: "10px" }}>4-Level Triage System</h3>
            <p>
              Green · Yellow · Orange · Red. Each severity level triggers a
              different response protocol — from self-care guidance all the way
              to immediate ambulance dispatch and hospital coordination.
            </p>
          </div>
        </section>
      </div>

      {/* ── Footer strip ──────────────────────────────────────────────────── */}
      <div style={{
        borderTop: "1px solid var(--accents-2)", padding: "1.5rem 2rem",
        textAlign: "center", fontSize: "0.8rem", color: "var(--accents-3)"
      }}>
        <strong style={{ color: "var(--foreground)" }}>Sahayaka</strong>
        {" · "}KLS Gogte Institute of Technology, Belagavi — 590008
        {" · "}Built for Hack The Future 3.0
      </div>
    </div>
  );
};

export default Landing;
