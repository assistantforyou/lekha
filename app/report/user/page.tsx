"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface UserReportData {
  ok: boolean;
  generatedAt: string;
  ms: number;
  user: {
    userId: string;
    displayName: string;
    joinedAt: number | null;
  };
  activity: {
    totalTurns: number;
    historyMessages: number;
    archiveEntries: number;
    sentActions: number;
    receiptsScanned: number;
  };
  memory: {
    factCount: number;
    facts: Array<{ category: string; content: string; createdAt: number }>;
  };
  tasks: {
    total: number;
    open: number;
    completed: number;
    recent: Array<{ id: string; title: string; completed: boolean; createdAt: number }>;
  };
  reminders: {
    total: number;
    upcoming: number;
    recent: Array<Record<string, unknown>>;
  };
  lists: {
    total: number;
    items: Array<{ name: string; count: number }>;
  };
  connections: {
    googleAccounts: string[];
    googleAccountCount: number;
  };
  settings: {
    timezone: string;
    locale: string;
    language: string;
    morningBriefingEnabled: boolean;
    morningBriefingTime: string;
    eveningSummaryEnabled: boolean;
    eveningSummaryTime: string;
  } | null;
}

export default function UserReportPage() {
  const [data, setData] = useState<UserReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/report/user")
      .then((r) => {
        if (r.status === 401) throw new Error("Please log in via the dashboard to view your report.");
        return r.json();
      })
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
          <h1 style={titleStyle}>Your Activity</h1>
          <p style={subtitleStyle}>Personal usage report — everything Lekha knows about you.</p>
        </header>

        {loading && <div style={loadingStyle}>Loading your report…</div>}
        {error && (
          <div style={errorStyle}>
            {error}
            <div style={{ marginTop: 12 }}>
              <Link href="/dashboard" style={loginLinkStyle}>Go to Dashboard →</Link>
            </div>
          </div>
        )}

        {data && (
          <>
            {/* Profile */}
            <div style={cardStyle}>
              <h3 style={sectionTitleStyle}>Profile</h3>
              <div style={profileGridStyle}>
                <div>
                  <div style={metaLabelStyle}>Display Name</div>
                  <div style={metaValueStyle}>{data.user.displayName}</div>
                </div>
                <div>
                  <div style={metaLabelStyle}>User ID</div>
                  <div style={metaValueStyle}>{data.user.userId.slice(0, 12)}…</div>
                </div>
                <div>
                  <div style={metaLabelStyle}>Joined</div>
                  <div style={metaValueStyle}>
                    {data.user.joinedAt ? new Date(data.user.joinedAt).toLocaleDateString() : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Activity Stats */}
            <div style={grid4Style}>
              <StatCard label="Total Turns" value={data.activity.totalTurns} color="#f5c842" />
              <StatCard label="History" value={data.activity.historyMessages} color="#54a0ff" />
              <StatCard label="Archive" value={data.activity.archiveEntries} color="#a29bfe" />
              <StatCard label="Sent Actions" value={data.activity.sentActions} color="#00cec9" />
            </div>

            {/* Tasks */}
            <div style={cardStyle}>
              <h3 style={sectionTitleStyle}>Tasks</h3>
              <div style={taskSummaryStyle}>
                <div style={taskStatStyle}>
                  <span style={{ ...taskStatValueStyle, color: "#fd79a8" }}>{data.tasks.open}</span>
                  <span style={taskStatLabelStyle}>Open</span>
                </div>
                <div style={taskStatStyle}>
                  <span style={{ ...taskStatValueStyle, color: "#06C755" }}>{data.tasks.completed}</span>
                  <span style={taskStatLabelStyle}>Done</span>
                </div>
                <div style={taskStatStyle}>
                  <span style={{ ...taskStatValueStyle, color: "#f5c842" }}>{data.tasks.total}</span>
                  <span style={taskStatLabelStyle}>Total</span>
                </div>
              </div>
              {data.tasks.recent.length > 0 && (
                <div style={taskListStyle}>
                  {data.tasks.recent.map((t) => (
                    <div key={t.id} style={taskRowStyle}>
                      <span style={{ ...taskCheckStyle, borderColor: t.completed ? "#06C755" : "#8a94a8" }}>
                        {t.completed && <span style={{ color: "#06C755", fontSize: 12 }}>✓</span>}
                      </span>
                      <span style={{ ...taskTitleStyle, opacity: t.completed ? 0.5 : 1, textDecoration: t.completed ? "line-through" : "none" }}>
                        {t.title}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Memory */}
            <div style={cardStyle}>
              <h3 style={sectionTitleStyle}>Memory · {data.memory.factCount} facts</h3>
              {data.memory.facts.length === 0 && (
                <div style={emptyStyle}>No memories yet — chat with Lekha to build your profile.</div>
              )}
              <div style={memListStyle}>
                {data.memory.facts.map((f, i) => (
                  <div key={i} style={memRowStyle}>
                    <span style={memTagStyle}>{f.category}</span>
                    <span style={memTextStyle}>{f.content}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reminders & Lists */}
            <div style={grid2Style}>
              <div style={cardStyle}>
                <h3 style={sectionTitleStyle}>Reminders</h3>
                <div style={miniStatStyle}>
                  <div style={miniStatItemStyle}>
                    <span style={miniStatValueStyle}>{data.reminders.total}</span>
                    <span style={miniStatLabelStyle}>Total</span>
                  </div>
                  <div style={miniStatItemStyle}>
                    <span style={{ ...miniStatValueStyle, color: "#54a0ff" }}>{data.reminders.upcoming}</span>
                    <span style={miniStatLabelStyle}>Upcoming</span>
                  </div>
                </div>
              </div>
              <div style={cardStyle}>
                <h3 style={sectionTitleStyle}>Lists</h3>
                <div style={miniStatStyle}>
                  <div style={miniStatItemStyle}>
                    <span style={miniStatValueStyle}>{data.lists.total}</span>
                    <span style={miniStatLabelStyle}>Lists</span>
                  </div>
                  <div style={miniStatItemStyle}>
                    <span style={{ ...miniStatValueStyle, color: "#e17055" }}>
                      {data.lists.items.reduce((a, b) => a + b.count, 0)}
                    </span>
                    <span style={miniStatLabelStyle}>Items</span>
                  </div>
                </div>
                {data.lists.items.length > 0 && (
                  <div style={listItemsStyle}>
                    {data.lists.items.map((l) => (
                      <div key={l.name} style={listItemRowStyle}>
                        <span style={listItemNameStyle}>{l.name}</span>
                        <span style={listItemCountStyle}>{l.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Connections */}
            <div style={cardStyle}>
              <h3 style={sectionTitleStyle}>Connections</h3>
              <div style={connGridStyle}>
                <div style={connItemStyle}>
                  <span style={{ ...connDotStyle, background: "#06C755" }} />
                  <span style={connNameStyle}>LINE</span>
                  <span style={connStatusStyle}>Connected</span>
                </div>
                {data.connections.googleAccounts.map((email) => (
                  <div key={email} style={connItemStyle}>
                    <span style={{ ...connDotStyle, background: "#4285F4" }} />
                    <span style={connNameStyle}>{email}</span>
                    <span style={connStatusStyle}>Connected</span>
                  </div>
                ))}
                {data.connections.googleAccountCount === 0 && (
                  <div style={connItemStyle}>
                    <span style={{ ...connDotStyle, background: "#333" }} />
                    <span style={{ ...connNameStyle, color: "#8a94a8" }}>Google Account</span>
                    <span style={{ ...connStatusStyle, color: "#8a94a8" }}>Not connected</span>
                  </div>
                )}
              </div>
            </div>

            {/* Settings */}
            {data.settings && (
              <div style={cardStyle}>
                <h3 style={sectionTitleStyle}>Settings</h3>
                <div style={settingsGridStyle}>
                  <div>
                    <div style={metaLabelStyle}>Timezone</div>
                    <div style={metaValueStyle}>{data.settings.timezone}</div>
                  </div>
                  <div>
                    <div style={metaLabelStyle}>Language</div>
                    <div style={metaValueStyle}>{data.settings.language}</div>
                  </div>
                  <div>
                    <div style={metaLabelStyle}>Morning Briefing</div>
                    <div style={metaValueStyle}>
                      {data.settings.morningBriefingEnabled ? data.settings.morningBriefingTime : "Off"}
                    </div>
                  </div>
                  <div>
                    <div style={metaLabelStyle}>Evening Summary</div>
                    <div style={metaValueStyle}>
                      {data.settings.eveningSummaryEnabled ? data.settings.eveningSummaryTime : "Off"}
                    </div>
                  </div>
                </div>
              </div>
            )}

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

const loginLinkStyle: React.CSSProperties = {
  color: "#f5c842",
  textDecoration: "none",
  fontWeight: 600,
};

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 14,
  padding: 24,
  marginBottom: 16,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.8,
  color: "#8a94a8",
  margin: "0 0 16px",
};

const grid4Style: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
  gap: 12,
  marginBottom: 16,
};

const statCardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 14,
  padding: "18px 20px",
};

const statValueStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  letterSpacing: -1,
  marginBottom: 4,
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#8a94a8",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const profileGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
  gap: 16,
};

const metaLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#8a94a8",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  marginBottom: 4,
};

const metaValueStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
};

const taskSummaryStyle: React.CSSProperties = {
  display: "flex",
  gap: 24,
  marginBottom: 16,
};

const taskStatStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
};

const taskStatValueStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
};

const taskStatLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#8a94a8",
  fontWeight: 600,
  textTransform: "uppercase",
};

const taskListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  borderTop: "1px solid rgba(255,255,255,0.05)",
  paddingTop: 12,
};

const taskRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const taskCheckStyle: React.CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 5,
  border: "2px solid",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};

const taskTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontFamily: "Manrope, sans-serif",
};

const emptyStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#8a94a8",
  fontStyle: "italic",
};

const memListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const memRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  padding: "8px 10px",
  background: "rgba(255,255,255,0.02)",
  borderRadius: 8,
};

const memTagStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  padding: "2px 8px",
  borderRadius: 100,
  background: "rgba(245,200,66,0.1)",
  color: "#f5c842",
  flexShrink: 0,
  marginTop: 2,
};

const memTextStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.5,
  fontFamily: "Manrope, sans-serif",
};

const grid2Style: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: 16,
  marginBottom: 16,
};

const miniStatStyle: React.CSSProperties = {
  display: "flex",
  gap: 24,
};

const miniStatItemStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
};

const miniStatValueStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  color: "#f5c842",
};

const miniStatLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#8a94a8",
  fontWeight: 600,
  textTransform: "uppercase",
};

const listItemsStyle: React.CSSProperties = {
  marginTop: 12,
  borderTop: "1px solid rgba(255,255,255,0.05)",
  paddingTop: 12,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const listItemRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 13,
};

const listItemNameStyle: React.CSSProperties = {
  fontFamily: "Manrope, sans-serif",
};

const listItemCountStyle: React.CSSProperties = {
  fontFamily: "JetBrains Mono, monospace",
  fontSize: 12,
  color: "#8a94a8",
};

const connGridStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const connItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  background: "rgba(255,255,255,0.02)",
  borderRadius: 10,
};

const connDotStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  flexShrink: 0,
};

const connNameStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  flex: 1,
};

const connStatusStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#06C755",
  fontWeight: 600,
};

const settingsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
  gap: 16,
};

const footerMetaStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#8a94a8",
  textAlign: "center",
  marginTop: 24,
};
