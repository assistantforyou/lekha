import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Reports — LEKHA",
  description: "System reports, marketing metrics, health status, and user analytics for LEKHA.",
};

const REPORTS = [
  {
    id: "marketing",
    title: "Marketing Report",
    desc: "Bot usage stats, user growth, feature adoption, and infrastructure overview.",
    icon: "📊",
    public: true,
  },
  {
    id: "status",
    title: "System Status",
    desc: "Real-time health checks for Redis, Gemini, QStash, LINE, Tavily, and Vector search.",
    icon: "🩺",
    public: true,
  },
  {
    id: "tests",
    title: "Test Report",
    desc: "Latest test suite results — vitest coverage across all bot features.",
    icon: "🧪",
    public: true,
  },
  {
    id: "user",
    title: "Your Activity",
    desc: "Personal usage report — memories, tasks, reminders, and conversation stats.",
    icon: "👤",
    public: false,
  },
];

export default function ReportLanding() {
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <header style={headerStyle}>
          <h1 style={titleStyle}>Reports</h1>
          <p style={subtitleStyle}>Every metric, health check, and test result in one place.</p>
        </header>

        <div style={gridStyle}>
          {REPORTS.map((r) => (
            <Link key={r.id} href={`/report/${r.id}`} style={cardStyle}>
              <div style={cardTopStyle}>
                <span style={cardIconStyle}>{r.icon}</span>
                {!r.public && <span style={badgeStyle}>Private</span>}
              </div>
              <h3 style={cardTitleStyle}>{r.title}</h3>
              <p style={cardDescStyle}>{r.desc}</p>
              <div style={cardActionStyle}>Open report →</div>
            </Link>
          ))}
        </div>

        <div style={footerStyle}>
          <Link href="/dashboard" style={backStyle}>← Back to Dashboard</Link>
          <span style={mutedStyle}>·</span>
          <Link href="/" style={backStyle}>Home</Link>
        </div>
      </div>
    </main>
  );
}

/* ── Styles ── */
const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#050d22",
  color: "#e8ecf4",
  fontFamily: "Sora, Manrope, sans-serif",
  padding: "48px 24px",
};

const containerStyle: React.CSSProperties = {
  maxWidth: 960,
  margin: "0 auto",
};

const headerStyle: React.CSSProperties = {
  marginBottom: 40,
};

const titleStyle: React.CSSProperties = {
  fontSize: 36,
  fontWeight: 800,
  margin: "0 0 8px",
  letterSpacing: -0.5,
  background: "linear-gradient(135deg,#f5c842,#e8ecf4)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 15,
  color: "#8a94a8",
  margin: 0,
  fontFamily: "Manrope, sans-serif",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
  gap: 16,
};

const cardStyle: React.CSSProperties = {
  display: "block",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 16,
  padding: 24,
  textDecoration: "none",
  color: "inherit",
  transition: "all 0.2s ease",
  cursor: "pointer",
};

const cardTopStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 14,
};

const cardIconStyle: React.CSSProperties = {
  fontSize: 28,
  lineHeight: 1,
};

const badgeStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  padding: "3px 8px",
  borderRadius: 100,
  background: "rgba(245,200,66,0.12)",
  color: "#f5c842",
  border: "1px solid rgba(245,200,66,0.2)",
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  margin: "0 0 6px",
};

const cardDescStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#8a94a8",
  margin: "0 0 16px",
  lineHeight: 1.5,
  fontFamily: "Manrope, sans-serif",
};

const cardActionStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#f5c842",
};

const footerStyle: React.CSSProperties = {
  marginTop: 40,
  display: "flex",
  alignItems: "center",
  gap: 12,
  fontSize: 13,
  color: "#8a94a8",
};

const backStyle: React.CSSProperties = {
  color: "#8a94a8",
  textDecoration: "none",
  transition: "color 0.2s",
};

const mutedStyle: React.CSSProperties = {
  color: "rgba(138,148,168,0.4)",
};
