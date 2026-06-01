"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface StatusData {
  ok: boolean;
  checks: Record<string, { ok: boolean; error?: string; ms?: number; detail?: string }>;
  ts: number;
}

export default function StatusReportPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/report/status")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const allOk = data?.ok ?? false;

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <header style={headerStyle}>
          <Link href="/report" style={breadcrumbStyle}>← Reports</Link>
          <h1 style={titleStyle}>System Status</h1>
          <p style={subtitleStyle}>Real-time health checks across all services.</p>
        </header>

        {loading && <div style={loadingStyle}>Running health checks…</div>}
        {error && <div style={errorStyle}>{error}</div>}

        {data && (
          <>
            <div style={{ ...statusBannerStyle, background: allOk ? "rgba(6,199,85,0.08)" : "rgba(255,107,107,0.08)", borderColor: allOk ? "rgba(6,199,85,0.2)" : "rgba(255,107,107,0.2)" }}>
              <div style={{ ...statusDotStyle, background: allOk ? "#06C755" : "#ff6b6b" }} />
              <span style={{ fontWeight: 700, color: allOk ? "#06C755" : "#ff6b6b" }}>
                {allOk ? "All Systems Operational" : "Some Services Degraded"}
              </span>
              <span style={mutedStyle}>· checked {new Date(data.ts).toLocaleTimeString()}</span>
            </div>

            <div style={checksGridStyle}>
              {Object.entries(data.checks).map(([name, check]) => (
                <div key={name} style={checkCardStyle}>
                  <div style={checkTopStyle}>
                    <span style={checkNameStyle}>{formatName(name)}</span>
                    <span style={{ ...checkBadgeStyle, background: check.ok ? "rgba(6,199,85,0.12)" : "rgba(255,107,107,0.12)", color: check.ok ? "#06C755" : "#ff6b6b" }}>
                      {check.ok ? "UP" : "DOWN"}
                    </span>
                  </div>
                  {check.ms !== undefined && (
                    <div style={checkMetaStyle}>{check.ms}ms</div>
                  )}
                  {check.detail && (
                    <div style={checkDetailStyle}>{check.detail}</div>
                  )}
                  {check.error && (
                    <div style={checkErrorStyle}>{check.error}</div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function formatName(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
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

const statusBannerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "14px 18px",
  borderRadius: 12,
  border: "1px solid",
  marginBottom: 20,
};

const statusDotStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  flexShrink: 0,
};

const mutedStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#8a94a8",
  marginLeft: "auto",
};

const checksGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: 12,
};

const checkCardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 14,
  padding: "18px 20px",
};

const checkTopStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 8,
};

const checkNameStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
};

const checkBadgeStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  padding: "3px 10px",
  borderRadius: 100,
  letterSpacing: 0.5,
};

const checkMetaStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#8a94a8",
  fontFamily: "JetBrains Mono, monospace",
};

const checkDetailStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#a0aec0",
  marginTop: 6,
};

const checkErrorStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#ff6b6b",
  marginTop: 6,
  lineHeight: 1.4,
};
