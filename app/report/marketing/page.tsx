"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface MarketingData {
  ok: boolean;
  generatedAt: string;
  ms: number;
  users: {
    total: number;
    allowed: number;
    pending: number;
    activeToday: number;
  };
  content: {
    facts: number;
    tasks: number;
    reminders: number;
    lists: number;
    scheduledEmails: number;
  };
  infra: {
    googleOAuth: boolean;
    qStash: boolean;
    upstashVector: boolean;
    tavily: boolean;
    stripe: boolean;
  };
}

export default function MarketingReportPage() {
  const [data, setData] = useState<MarketingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/report/marketing")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setData(d);
        else setError(d.error || "Failed to load");
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <header style={headerStyle}>
          <Link href="/report" style={breadcrumbStyle}>← Reports</Link>
          <h1 style={titleStyle}>Marketing Report</h1>
          <p style={subtitleStyle}>Aggregate bot metrics and infrastructure status.</p>
        </header>

        {loading && <div style={loadingStyle}>Loading…</div>}
        {error && <div style={errorStyle}>{error}</div>}

        {data && (
          <>
            <div style={grid2Style}>
              <StatCard label="Total Users" value={data.users.total} color="#f5c842" />
              <StatCard label="Allowed Users" value={data.users.allowed} color="#06C755" />
              <StatCard label="Pending Approval" value={data.users.pending} color="#ff9f43" />
              <StatCard label="Active Today" value={data.users.activeToday} color="#54a0ff" />
            </div>

            <div style={grid2Style}>
              <StatCard label="Facts Stored" value={data.content.facts} color="#a29bfe" />
              <StatCard label="Tasks Created" value={data.content.tasks} color="#fd79a8" />
              <StatCard label="Reminders Set" value={data.content.reminders} color="#00cec9" />
              <StatCard label="Lists Created" value={data.content.lists} color="#e17055" />
            </div>

            <div style={cardStyle}>
              <h3 style={sectionTitleStyle}>Infrastructure</h3>
              <div style={infraGridStyle}>
                <InfraItem label="Google OAuth" on={data.infra.googleOAuth} />
                <InfraItem label="QStash" on={data.infra.qStash} />
                <InfraItem label="Upstash Vector" on={data.infra.upstashVector} />
                <InfraItem label="Tavily Search" on={data.infra.tavily} />
                <InfraItem label="Stripe Payments" on={data.infra.stripe} />
              </div>
            </div>

            <div style={footerMetaStyle}>
              Generated {new Date(data.generatedAt).toLocaleString()} · {data.ms}ms
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={statCardStyle}>
      <div style={{ ...statValueStyle, color }}>{value.toLocaleString()}</div>
      <div style={statLabelStyle}>{label}</div>
    </div>
  );
}

function InfraItem({ label, on }: { label: string; on: boolean }) {
  return (
    <div style={infraItemStyle}>
      <span style={{ ...infraDotStyle, background: on ? "#06C755" : "#ff6b6b" }} />
      <span style={infraLabelStyle}>{label}</span>
      <span style={{ ...infraStatusStyle, color: on ? "#06C755" : "#ff6b6b" }}>{on ? "Enabled" : "Disabled"}</span>
    </div>
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

const containerStyle: React.CSSProperties = { maxWidth: 960, margin: "0 auto" };

const headerStyle: React.CSSProperties = { marginBottom: 32 };

const breadcrumbStyle: React.CSSProperties = {
  display: "inline-block",
  fontSize: 13,
  color: "#8a94a8",
  textDecoration: "none",
  marginBottom: 12,
};

const titleStyle: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 800,
  margin: "0 0 6px",
  letterSpacing: -0.5,
  background: "linear-gradient(135deg,#f5c842,#e8ecf4)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 15,
  color: "#8a94a8",
  margin: 0,
};

const loadingStyle: React.CSSProperties = {
  padding: 40,
  textAlign: "center",
  color: "#8a94a8",
};

const errorStyle: React.CSSProperties = {
  padding: 24,
  background: "rgba(255,107,107,0.08)",
  border: "1px solid rgba(255,107,107,0.2)",
  borderRadius: 12,
  color: "#ff6b6b",
};

const grid2Style: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
  gap: 12,
  marginBottom: 16,
};

const statCardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 14,
  padding: "20px 22px",
};

const statValueStyle: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 800,
  letterSpacing: -1,
  marginBottom: 4,
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#8a94a8",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 14,
  padding: 24,
  marginBottom: 16,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.8,
  color: "#8a94a8",
  margin: "0 0 16px",
};

const infraGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
  gap: 12,
};

const infraItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 14px",
  background: "rgba(255,255,255,0.02)",
  borderRadius: 10,
};

const infraDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  flexShrink: 0,
};

const infraLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  flex: 1,
};

const infraStatusStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
};

const footerMetaStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#8a94a8",
  textAlign: "center",
  marginTop: 24,
};
