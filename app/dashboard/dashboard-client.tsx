"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import "./dashboard.css";
import { deriveCheckInTime } from "@/lib/time-utils";

/* ============== ICONS ============== */
const I = {
  spark:    (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" {...p}><path d="M12 2l2.39 6.61L21 11l-6.61 2.39L12 20l-2.39-6.61L3 11l6.61-2.39L12 2z"/></svg>,
  chat:     (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
  bell:     (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>,
  news:     (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zM2 18v2a2 2 0 0 0 2 2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6z"/></svg>,
  check:    (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6L9 17l-5-5"/></svg>,
  chart:    (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-7"/></svg>,
  mail:     (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>,
  search:   (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>,
  cal:      (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>,
  send:     (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>,
  globe:    (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/></svg>,
  shield:   (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z"/></svg>,
  bolt:     (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg>,
  doc:      (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>,
  drive:    (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 2l5 8.66H7L12 2zM7 10.66L2 19.32h10L7 10.66zM17 10.66L22 19.32H12L17 10.66z"/></svg>,
  brain:    (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-3 3 3 3 0 0 0 1 2.2A3 3 0 0 0 5 15a3 3 0 0 0 4 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3z"/><path d="M15 3a3 3 0 0 1 3 3 3 3 0 0 1 3 3 3 3 0 0 1-1 2.2A3 3 0 0 1 19 15a3 3 0 0 1-4 3 3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z"/></svg>,
  user:     (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  card:     (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,
  link:     (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5"/></svg>,
  home:     (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V9.5z"/></svg>,
  trash:    (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>,
  plus:     (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 5v14M5 12h14"/></svg>,
  caret:    (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 9l6 6 6-6"/></svg>,
  sun:      (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>,
  moon:     (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  image:    (p: React.SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>,
};

const LekhaMark = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 5v10a4 4 0 0 0 4 4h6"/>
    <circle cx="17" cy="7" r="2.2" fill="white" stroke="none"/>
  </svg>
);

/* ============== DATA ============== */
const TOPICS = [
  { id: "stocks",   emoji: "📈", name: "Stock Markets",       thai: "หุ้นและการลงทุน",   desc: "Live quotes, sentiment, watchlist alerts and earnings calendar.", sources: ["Bloomberg", "Reuters", "MarketWatch", "SET"] },
  { id: "wellness", emoji: "🌿", name: "Wellness",             thai: "สุขภาพและความเป็นอยู่", desc: "Research-backed health, sleep, nutrition and recovery.", sources: ["Healthline", "Mayo Clinic", "NIH", "WHO"] },
  { id: "politics", emoji: "🏛️", name: "Politics",             thai: "การเมือง",          desc: "Policy, regulation and government — Thailand and global.", sources: ["BBC", "Reuters", "AP", "Bangkok Post"] },
  { id: "crime",    emoji: "🚨", name: "Breaking & Crime",     thai: "ข่าวด่วนและอาชญากรรม", desc: "Critical safety alerts and major incidents only — no clickbait.", sources: ["BBC", "CNN", "Local news", "Police feeds"] },
  { id: "sports",   emoji: "⚽", name: "Sports Journalism",    thai: "กีฬาเชิงลึก",        desc: "Long-form sports — strategy, business of sport, athlete profiles.", sources: ["ESPN", "BBC Sport", "The Athletic", "SI"] },
  { id: "business", emoji: "💼", name: "Business & Economy",   thai: "ธุรกิจและเศรษฐกิจ", desc: "M&A, macro trends, ASEAN markets, and global business news.", sources: ["WSJ", "FT", "Bloomberg", "Nikkei"] },
  { id: "entertain",emoji: "🎬", name: "Entertainment & Celebrity", thai: "บันเทิงและคนดัง", desc: "Film, music, lifestyle, celebrity moves — curated, not gossipy.", sources: ["Variety", "THR", "Billboard", "Deadline"] },
];

const TOOLS = [
  {
    id: "todo", icon: <I.check/>, name: "To-do list", sub: "Capture, prioritise, follow through",
    fields: [
      { id: "prio", kind: "seg" as const, label: "Default sort", options: ["Deadline", "Priority", "Energy fit"] },
      { id: "nudge", kind: "slider" as const, label: "Nudge frequency", min: 0, max: 4, step: 1, fmt: (v: number) => (["Off","Once daily","Twice daily","Hourly","Every 30 min"][v] ?? "") },
      { id: "followup", kind: "toggle" as const, label: "Auto-capture follow-ups from meetings" },
    ]
  },
  {
    id: "reminders", icon: <I.bell/>, name: "Reminders", sub: "Time, location, and event-based nudges",
    fields: [
      { id: "quiet", kind: "time-range" as const, label: "Quiet hours" },
      { id: "preempt", kind: "slider" as const, label: "Pre-meeting alert", min: 5, max: 60, step: 5, fmt: (v: number) => v + " min before" },
      { id: "skipHolidays", kind: "toggle" as const, label: "Skip public holidays (TH calendar)" },
    ]
  },
  {
    id: "calendar", icon: <I.cal/>, name: "Calendar", sub: "Cross-timezone, deep-work protection, briefs",
    fields: [
      { id: "tz", kind: "chips" as const, label: "Timezone", options: ["Asia/Bangkok", "Asia/Singapore", "America/New_York", "Europe/London"] },
      { id: "deepwork", kind: "time-range" as const, label: "Deep-work block" },
      { id: "noMeet", kind: "days" as const, label: "No-meeting days" },
      { id: "prebrief", kind: "toggle" as const, label: "Auto-generate pre-meeting briefs" },
    ]
  },
  {
    id: "email", icon: <I.mail/>, name: "Email & assistant", sub: "Send and receive on your behalf",
    fields: [
      { id: "tone", kind: "chips" as const, label: "Default tone", options: ["Warm", "Professional", "Concise", "Friendly"] },
      { id: "signoff", kind: "chips" as const, label: "Sign-off", options: ["Best,", "Thanks,", "Cheers,", "Warmly,"] },
      { id: "autosend", kind: "seg" as const, label: "Send behavior", options: ["Always confirm", "Confirm if > $1k", "Auto-send drafts"] },
    ]
  },
  {
    id: "drive", icon: <I.drive/>, name: "Drive & Google", sub: "Search, summarise, organise files",
    fields: [
      { id: "scope", kind: "chips" as const, label: "Default scope", options: ["My Drive", "Shared with me", "Everything"] },
      { id: "fmt",   kind: "seg" as const, label: "Summary length", options: ["Headline", "Bullets", "1 page"] },
      { id: "autosort", kind: "toggle" as const, label: "Auto-file attachments into Drive › Expenses / Memos" },
    ]
  },
];

const NAV_SECTIONS = [
  { group: "WORKSPACE", items: [
    { id: "overview",     label: "Overview",                ico: <I.home/>,  count: null as string | null },
  ]},
  { group: "CUSTOMIZE LEKHA", items: [
    { id: "briefing",     label: "Daily Brief Topics",      ico: <I.news/>,  countKey: "topicsOn" as const, total: 7 },
    { id: "tools",        label: "Productivity Tools",      ico: <I.bolt/>,  countKey: "toolsOn" as const,  total: 5 },
    { id: "connections",  label: "Connections",             ico: <I.link/>,  countKey: "connsOn" as const,  total: 1 },
    { id: "memory",       label: "Memory & Persona",        ico: <I.brain/>, count: null as string | null },
  ]},
  { group: "ACCOUNT", items: [
    { id: "plan",         label: "Account",          ico: <I.card/>,  count: null as string | null },
  ]},
];

/* ============== DEFAULT STATE ============== */
function makeDefaultState(displayName: string, userId?: string) {
  const firstName = displayName.split(" ")[0] ?? "You";
  return {
    userId: userId ?? "",
    /* Schedule */
    morningOn: true,
    morningTime: "07:00",
    eveningOn: true,
    eveningTime: "21:00",
    checkinOn: true,
    checkinTime: deriveCheckInTime("21:00"),
    /* Topics */
    topics: {
      stocks: true, wellness: true, politics: false, crime: false,
      sports: false, business: true, entertain: false,
    } as Record<string, boolean>,
    /* Brief format */
    briefLength: "Headlines" as "Headlines" | "Bullets" | "Full",
    briefLang: "EN + ไทย" as "English" | "ไทย" | "EN + ไทย",
    briefChannels: { line: true, email: false, push: true },
    topicSources: {} as Record<string, string[]>,
    /* Productivity */
    tools: { todo: true, reminders: true, calendar: true, email: true, drive: true } as Record<string, boolean>,
    toolSettings: {
      todo:      { prio: "Deadline", nudge: 2, followup: true },
      reminders: { quietStart: "22:00", quietEnd: "06:30", preempt: 15, skipHolidays: true },
      calendar:  { tz: "Asia/Bangkok", deepStart: "09:00", deepEnd: "11:00", noMeet: ["Wed","Fri"], prebrief: true },
      email:     { tone: "Warm", signoff: "Best,", autosend: "Always confirm" },
      drive:     { scope: "My Drive", fmt: "Bullets", autosort: true },
    } as Record<string, Record<string, unknown>>,
    /* Connections */
    connections: { line: true, gcal: false, gmail: false, gdrive: false, gcontacts: false, gpeople: false } as Record<string, boolean>,
    /* Locale */
    timezone: "Asia/Bangkok" as string,
    /* Memory */
    compactAt: 10,
    memoryEnabled: true,
    memories: [] as Array<{ id: string; tag: string; text: string }>,
    /* Persona */
    persona: {
      tone: "Warm" as "Warm" | "Professional" | "Playful",
      addressing: "First name" as "First name" | "Khun" | "Sir / Madam" | "No address",
      primaryLang: "English" as "English" | "Thai",
      voiceMatch: true,
      preferredName: null as string | null,
    },
    displayName: firstName,
    googleAccounts: [] as Array<{ email: string; addedAt: number }>,
    activeGoogleEmail: null as string | null,
    joinedAt: null as number | null,
    subscriptionActive: false,
  };
}

type State = ReturnType<typeof makeDefaultState>;

/* ============== HELPERS ============== */
const Toggle = ({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) => (
  <button
    className={`toggle ${on ? "on" : ""}`}
    aria-pressed={on}
    onClick={(e) => { e.stopPropagation(); onChange(!on); }}
  />
);

const Seg = ({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) => (
  <div className="seg">
    {options.map(o => (
      <button key={o} className={value === o ? "on" : ""} onClick={() => onChange(o)}>{o}</button>
    ))}
  </div>
);

const Chips = ({ value, options, onChange, multi }: { value: string | string[]; options: string[]; onChange: (v: string | string[]) => void; multi?: boolean }) => (
  <div className="chips">
    {options.map(o => {
      const on = multi ? (value as string[] || []).includes(o) : value === o;
      return (
        <button key={o} className={`chip ${on ? "on" : ""}`}
          onClick={() => {
            if (multi) {
              const arr = value as string[] || [];
              onChange(arr.includes(o) ? arr.filter(x => x !== o) : [...arr, o]);
            } else onChange(o);
          }}>{o}</button>
      );
    })}
  </div>
);

const Slider = ({ value, min, max, step = 1, onChange, fmt }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; fmt?: (v: number) => string }) => {
  const p = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider-wrap">
      <input type="range" className="slider"
        min={min} max={max} step={step} value={value}
        style={{ ["--p" as string]: `${p}%` }}
        onChange={(e) => onChange(Number(e.target.value))}/>
      <span className="slider-val">{fmt ? fmt(value) : value}</span>
    </div>
  );
};

/* ============== SIDEBAR ============== */
const Sidebar = ({ active, setActive, counts, displayName }: { active: string; setActive: (id: string) => void; counts: Record<string, number>; displayName: string }) => (
  <aside className="sidebar">
    <div className="brand">
      <div className="brand-mark"><LekhaMark/></div>
      <div>
        <div className="brand-text">LEKHA</div>
        <div className="brand-sub">DASHBOARD · V1.1</div>
      </div>
    </div>
    {NAV_SECTIONS.map(group => (
      <div className="nav-group" key={group.group}>
        <div className="nav-group-label">{group.group}</div>
        {group.items.map(it => {
          const count = it.countKey ? counts[it.countKey] : null;
          return (
            <button key={it.id}
              className={`nav-item ${active === it.id ? "active" : ""}`}
              onClick={() => setActive(it.id)}>
              <div className="nv-ico">{it.ico}</div>
              <span className="nv-label">{it.label}</span>
              {count !== null && it.total ? (
                <span className="nv-count">{count}/{it.total}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    ))}
    <div className="user-card">
      <div className="avatar">{displayName.charAt(0).toUpperCase()}</div>
      <div className="meta">
        <div className="name">{displayName}</div>
        <div className="plan">LEKHA DASHBOARD</div>
      </div>
    </div>
  </aside>
);

/* ============== TOPBAR ============== */
const Topbar = ({ active }: { active: string }) => {
  const crumbs: Record<string, string[]> = {
    overview: ["Workspace", "Overview"],
    briefing: ["Customize Lekha", "Daily Brief"],
    tools: ["Customize Lekha", "Productivity"],
    connections: ["Customize Lekha", "Connections"],
    memory: ["Customize Lekha", "Memory & Persona"],
    plan: ["Account", "Profile"],
  };
  const c = crumbs[active] || ["Workspace"];
  return (
    <div className="topbar">
      <div className="crumbs">
        <span>~</span><span className="sep">/</span>
        {c.map((crumb, i) => (
          <span key={i}>
            {i > 0 && <span className="sep">/</span>}
            <span className={i === c.length - 1 ? "cur" : ""}>{crumb.toLowerCase().replace(/ /g, "-")}</span>
          </span>
        ))}
      </div>
      <div className="topbar-spacer"/>
      <div className="save-state">
        <span className="dot"/>
        All changes synced to LINE
      </div>
    </div>
  );
};

/* ============== GETTING STARTED ============== */
const GettingStartedCard = ({ setActive }: { setActive: (id: string) => void }) => {
  const [show, setShow] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("lekha_dismissed_tour") !== "1" : true,
  );
  if (!show) return null;
  const steps = [
    { id: "briefing", label: "Pick your briefings", ico: "📰" },
    { id: "tools", label: "Choose tools", ico: "🛠" },
    { id: "memory", label: "Set your persona", ico: "🎭" },
    { id: "connections", label: "Connect Google", ico: "🔗" },
  ];
  return (
    <div className="card" style={{ background: "linear-gradient(90deg, rgba(91,111,240,0.12) 0%, rgba(91,111,240,0.04) 100%)", borderColor: "rgba(91,111,240,0.25)" }}>
      <div className="card-hdr">
        <div className="card-hdr-icon"><I.spark/></div>
        <div>
          <h3>Getting started</h3>
          <p className="sub">Four quick steps to make Lekha yours.</p>
        </div>
        <button className="btn-mini btn-ghost" onClick={() => { setShow(false); localStorage.setItem("lekha_dismissed_tour", "1"); }}>Dismiss</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 8 }}>
        {steps.map((s, i) => (
          <button key={s.id} className="card" style={{ textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: "inherit", padding: 12 }}
            onClick={() => setActive(s.id)}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{s.ico}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{i + 1}. {s.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

/* ============== OVERVIEW ============== */
const OverviewView = ({ state, setActive }: { state: State; setActive: (id: string) => void }) => {
  const topicsOn = Object.values(state.topics).filter(Boolean).length;
  const toolsOn = Object.values(state.tools).filter(Boolean).length;
  return (
    <div className="row-gap">
      <div className="section-hdr">
        <div className="section-eyebrow">Workspace · Overview</div>
        <h1 className="section-title">Welcome back, <span className="gold-text">{state.displayName}.</span></h1>
        <p className="section-desc">Your assistant is ready. Make her yours — customize what she briefs you on, which tools she runs, and how she remembers you.</p>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="v"><span className="gold-text">{topicsOn}</span><span style={{opacity:0.35}}>/7</span></div>
          <div className="lbl">Topics<br/>Active</div>
        </div>
        <div className="stat">
          <div className="v"><span className="gold-text">{toolsOn}</span><span style={{opacity:0.35}}>/5</span></div>
          <div className="lbl">Tools<br/>Enabled</div>
        </div>
        <div className="stat">
          <div className="v">{state.memories.length}</div>
          <div className="lbl">Memory<br/>Entries</div>
        </div>
        <div className="stat">
          <div className="v">{[state.morningOn, state.eveningOn, state.checkinOn].filter(Boolean).length}</div>
          <div className="lbl">Daily Briefs<br/>Scheduled</div>
          <div className="trend">{state.morningOn ? state.morningTime : "—"} · {state.eveningOn ? state.eveningTime : "—"} · {state.checkinOn ? state.checkinTime : "—"}</div>
        </div>
      </div>

      <GettingStartedCard setActive={setActive} />

      <div className="grid-2">
        <button className="card" style={{textAlign:"left", cursor:"pointer", fontFamily:"inherit", color:"inherit"}}
          onClick={() => setActive("briefing")}>
          <div className="card-hdr">
            <div className="card-hdr-icon"><I.news/></div>
            <div>
              <h3>Daily Brief Topics</h3>
              <p className="sub">{topicsOn} of 7 verticals — read in 90 seconds.</p>
            </div>
            <div className="card-hdr-trail"><I.caret/></div>
          </div>
          <div className="chips">
            {TOPICS.filter(t => state.topics[t.id]).map(t => (
              <span key={t.id} className="chip on" style={{cursor:"default"}}>{t.emoji} {t.name}</span>
            ))}
            {topicsOn === 0 && <span className="muted" style={{fontSize:12.5}}>No topics yet — tap to add some.</span>}
          </div>
        </button>

        <button className="card" style={{textAlign:"left", cursor:"pointer", fontFamily:"inherit", color:"inherit"}}
          onClick={() => setActive("tools")}>
          <div className="card-hdr">
            <div className="card-hdr-icon"><I.bolt/></div>
            <div>
              <h3>Productivity Tools</h3>
              <p className="sub">{toolsOn} of 5 surfaces running.</p>
            </div>
            <div className="card-hdr-trail"><I.caret/></div>
          </div>
          <div className="chips">
            {TOOLS.filter(t => state.tools[t.id]).map(t => (
              <span key={t.id} className="chip on" style={{cursor:"default"}}>{t.name}</span>
            ))}
          </div>
        </button>

        <button className="card" style={{textAlign:"left", cursor:"pointer", fontFamily:"inherit", color:"inherit"}}
          onClick={() => setActive("connections")}>
          <div className="card-hdr">
            <div className="card-hdr-icon"><I.link/></div>
            <div>
              <h3>Connections</h3>
              <p className="sub">{state.googleAccounts.length} Google account{state.googleAccounts.length !== 1 ? "s" : ""} connected.</p>
            </div>
            <div className="card-hdr-trail"><I.caret/></div>
          </div>
          <div style={{display:"flex", gap:8}}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "#06C755", display: "grid", placeItems: "center",
              fontFamily: "Sora, sans-serif", fontWeight: 800, fontSize: 14,
              color: "white", boxShadow: "0 0 0 2px rgba(7,17,44,1)"
            }}>L</div>
            {state.googleAccounts.map((acc) => (
              <div key={acc.email} style={{
                width: 32, height: 32, borderRadius: 8,
                background: "#4285F4", display: "grid", placeItems: "center",
                fontFamily: "Sora, sans-serif", fontWeight: 800, fontSize: 14,
                color: "white", boxShadow: "0 0 0 2px rgba(7,17,44,1)"
              }}>G</div>
            ))}
          </div>
        </button>

        <button className="card" style={{textAlign:"left", cursor:"pointer", fontFamily:"inherit", color:"inherit"}}
          onClick={() => setActive("memory")}>
          <div className="card-hdr">
            <div className="card-hdr-icon"><I.brain/></div>
            <div>
              <h3>Memory &amp; Persona</h3>
              <p className="sub">{state.memories.length} memories · tone is <span className="gold-text">{state.persona.tone}</span></p>
            </div>
            <div className="card-hdr-trail"><I.caret/></div>
          </div>
          <div className="mem-list">
            {state.memories.slice(0, 2).map((m) => (
              <div key={m.id} className="mem-row" style={{pointerEvents:"none"}}>
                <span className="mem-tag">{m.tag}</span>
                <span className="mem-text">{m.text}</span>
              </div>
            ))}
          </div>
        </button>
      </div>
    </div>
  );
};

/* ============== DAILY BRIEF VIEW ============== */
const BriefingView = ({ state, set }: { state: State; set: (patch: Partial<State>) => void }) => {
  const topicsOn = Object.values(state.topics).filter(Boolean).length;
  const [editingSources, setEditingSources] = useState<string | null>(null);
  const [sourceDraft, setSourceDraft] = useState("");

  const addSource = (topicId: string) => {
    const domain = sourceDraft.trim().toLowerCase();
    if (!domain) return;
    const current = state.topicSources[topicId] ?? [];
    if (current.includes(domain)) return;
    set({
      topicSources: { ...state.topicSources, [topicId]: [...current, domain] },
    });
    setSourceDraft("");
  };

  const removeSource = (topicId: string, domain: string) => {
    const current = state.topicSources[topicId] ?? [];
    set({
      topicSources: { ...state.topicSources, [topicId]: current.filter(d => d !== domain) },
    });
  };

  return (
    <div className="row-gap">
      <div className="section-hdr">
        <div className="section-eyebrow">Customize Lekha · Daily Brief</div>
        <h1 className="section-title">Wake up to <span className="gold-text">what actually matters.</span></h1>
        <p className="section-desc">Pick the verticals Lekha scans overnight. She reads 200+ sources per topic and assembles a personal briefing in 90 seconds.</p>
      </div>

      {/* Schedule */}
      <div className="card">
        <div className="card-hdr">
          <div className="card-hdr-icon"><I.cal/></div>
          <div>
            <h3>Briefing schedule</h3>
            <p className="sub">Two daily slots — morning intel and evening wrap.</p>
          </div>
        </div>
        <div className="sched">
          <div className={`sched-slot ${state.morningOn ? "on" : ""}`}>
            <div className="sched-slot-hdr">
              <div className="sched-slot-name"><span className="ico">☀️</span> Morning briefing</div>
              <Toggle on={state.morningOn} onChange={v => set({ morningOn: v })}/>
            </div>
            <input type="time" className="sched-time-input" value={state.morningTime}
              onChange={(e) => set({ morningTime: e.target.value })}/>
            <div className="sched-meta">{state.morningOn ? `Sent ${state.morningTime} · ${state.timezone}` : "Off — turn on to receive"}</div>
          </div>
          <div className={`sched-slot ${state.eveningOn ? "on" : ""}`}>
            <div className="sched-slot-hdr">
              <div className="sched-slot-name"><span className="ico">🌙</span> Evening wrap</div>
              <Toggle on={state.eveningOn} onChange={v => set({ eveningOn: v })}/>
            </div>
            <input type="time" className="sched-time-input" value={state.eveningTime}
              onChange={(e) => set({ eveningTime: e.target.value })}/>
            <div className="sched-meta">{state.eveningOn ? `Sent ${state.eveningTime} · ${state.timezone}` : "Off — turn on to receive"}</div>
          </div>
          <div className={`sched-slot ${state.checkinOn ? "on" : ""}`}>
            <div className="sched-slot-hdr">
              <div className="sched-slot-name"><span className="ico">✅</span> Task check-in</div>
              <Toggle on={state.checkinOn} onChange={v => set({ checkinOn: v })}/>
            </div>
            <input type="time" className="sched-time-input" value={state.checkinTime}
              onChange={(e) => set({ checkinTime: e.target.value })}/>
            <div className="sched-meta">{state.checkinOn ? `Sent ${state.checkinTime} · ${state.timezone}` : "Off — turn on to receive"}</div>
          </div>
        </div>

        <div style={{height: 18}}/>
        <div className="field">
          <div className="field-label">Delivery channels</div>
          <div className="field-control">
            {[
              { id: "line",  label: "💬 LINE chat" },
              { id: "email", label: "📧 Email" },
              { id: "push",  label: "🔔 Push notification" },
            ].map(c => {
              const on = state.briefChannels[c.id as keyof typeof state.briefChannels];
              return (
                <button key={c.id} className={`ch-pill ${on ? "on" : ""}`}
                  onClick={() => set({ briefChannels: { ...state.briefChannels, [c.id]: !on } })}>
                  <span className="dot"/>{c.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Topics */}
      <div className="card">
        <div className="card-hdr">
          <div className="card-hdr-icon"><I.news/></div>
          <div>
            <h3>Topic verticals</h3>
            <p className="sub">Pick what Lekha briefs you on. Re-mix anytime, mid-week.</p>
          </div>
          <div className="card-hdr-trail">
            <span className="kbd">{topicsOn} ON</span>
          </div>
        </div>
        <div className="topic-grid">
          {TOPICS.map(t => {
            const on = !!state.topics[t.id];
            const custom = state.topicSources[t.id] ?? [];
            const isEditing = editingSources === t.id;
            const sourceList = custom.length > 0 ? custom : t.sources;
            return (
              <div key={t.id} className={`topic ${on ? "on" : ""}`} role="button" tabIndex={0}
                onClick={() => set({ topics: { ...state.topics, [t.id]: !on } })}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); set({ topics: { ...state.topics, [t.id]: !on } }); }}}>
                <div className="topic-top">
                  <div className="topic-emoji">{t.emoji}</div>
                  <Toggle on={on} onChange={() => set({ topics: { ...state.topics, [t.id]: !on } })}/>
                </div>
                <div>
                  <div className="topic-title">{t.name}</div>
                  <div className="topic-thai">{t.thai}</div>
                </div>
                <div className="topic-desc">{t.desc}</div>
                <div className="topic-sources" onClick={(e) => e.stopPropagation()}>
                  <span className="pip"/> {sourceList.slice(0, 3).join(" · ")}
                  <button className="btn-mini" style={{marginLeft: "auto", fontSize: 10, padding: "2px 8px"}}
                    onClick={(e) => { e.stopPropagation(); setEditingSources(isEditing ? null : t.id); }}>
                    {isEditing ? "Done" : "Edit sources"}
                  </button>
                </div>
                {isEditing && (
                  <div className="topic-source-editor" onClick={(e) => e.stopPropagation()}>
                    <div style={{fontSize: 11, color: "var(--ink-mute)", marginBottom: 6}}>
                      {custom.length > 0 ? "Custom sources" : "Default sources"} — add domains like <code>bloomberg.com</code>
                    </div>
                    <div style={{display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8}}>
                      {sourceList.map((s) => (
                        <span key={s} className="chip on" style={{fontSize: 10, padding: "3px 8px", display: "flex", alignItems: "center", gap: 4}}>
                          {s}
                          <button style={{background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 12, padding: 0, lineHeight: 1}}
                            onClick={() => removeSource(t.id, s)}>×</button>
                        </span>
                      ))}
                    </div>
                    <div style={{display: "flex", gap: 6}}>
                      <input value={sourceDraft} placeholder="e.g. reuters.com"
                        onChange={(e) => setSourceDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSource(t.id); } }}
                        style={{flex: 1, background: "rgba(0,0,0,0.2)", border: "1px solid var(--line)", borderRadius: 6, padding: "5px 10px", color: "inherit", fontSize: 12, fontFamily: "inherit"}}/>
                      <button className="btn-mini" onClick={() => addSource(t.id)}>Add</button>
                    </div>
                    {custom.length > 0 && (
                      <button className="btn-mini btn-ghost" style={{marginTop: 6, fontSize: 10}}
                        onClick={() => set({ topicSources: { ...state.topicSources, [t.id]: [] } })}>
                        Reset to defaults
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Format */}
      <div className="card">
        <div className="card-hdr">
          <div className="card-hdr-icon"><I.doc/></div>
          <div>
            <h3>Format &amp; language</h3>
            <p className="sub">How Lekha presents the briefing in chat.</p>
          </div>
        </div>
        <div className="row-gap" style={{gap: 14}}>
          <div className="field">
            <div className="field-label">Length</div>
            <div className="field-control">
              <Seg value={state.briefLength} options={["Headlines", "Bullets", "Full"]}
                onChange={(v) => set({ briefLength: v as State["briefLength"] })}/>
              <span className="field-help">~{state.briefLength === "Headlines" ? "30s" : state.briefLength === "Bullets" ? "90s" : "3 min"} read</span>
            </div>
          </div>
          <div className="field">
            <div className="field-label">Language</div>
            <div className="field-control">
              <Seg value={state.briefLang} options={["English", "ไทย", "EN + ไทย"]}
                onChange={(v) => set({ briefLang: v as State["briefLang"] })}/>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============== TOOLS VIEW ============== */
const ToolField = ({ field, settings, onSet }: { field: typeof TOOLS[0]["fields"][0]; settings: Record<string, unknown>; onSet: (k: string, v: unknown) => void }) => {
  if (field.kind === "seg") {
    return (
      <div className="field">
        <div className="field-label">{field.label}</div>
        <div className="field-control"><Seg value={settings[field.id] as string} options={field.options} onChange={(v) => onSet(field.id, v)}/></div>
      </div>
    );
  }
  if (field.kind === "chips") {
    return (
      <div className="field">
        <div className="field-label">{field.label}</div>
        <div className="field-control"><Chips value={settings[field.id] as string} options={field.options} onChange={(v) => onSet(field.id, v)}/></div>
      </div>
    );
  }
  if (field.kind === "slider") {
    return (
      <div className="field">
        <div className="field-label">{field.label}</div>
        <div className="field-control"><Slider value={settings[field.id] as number} min={field.min} max={field.max} step={field.step} fmt={field.fmt} onChange={(v) => onSet(field.id, v)}/></div>
      </div>
    );
  }
  if (field.kind === "toggle") {
    return (
      <div className="field">
        <div className="field-label">{field.label}</div>
        <div className="field-control"><Toggle on={!!settings[field.id]} onChange={(v) => onSet(field.id, v)}/></div>
      </div>
    );
  }
  if (field.kind === "time-range") {
    const startKey = field.id === "quiet" ? "quietStart" : "deepStart";
    const endKey   = field.id === "quiet" ? "quietEnd"   : "deepEnd";
    return (
      <div className="field">
        <div className="field-label">{field.label}</div>
        <div className="field-control">
          <span className="time-input active">
            <span className="label">From</span>
            <input type="time" style={{background:"transparent", border:"none", color:"inherit", font:"inherit", outline:"none", width: 70}}
              value={settings[startKey] as string} onChange={(e) => onSet(startKey, e.target.value)}/>
          </span>
          <span className="muted">→</span>
          <span className="time-input active">
            <span className="label">To</span>
            <input type="time" style={{background:"transparent", border:"none", color:"inherit", font:"inherit", outline:"none", width: 70}}
              value={settings[endKey] as string} onChange={(e) => onSet(endKey, e.target.value)}/>
          </span>
        </div>
      </div>
    );
  }
  if (field.kind === "days") {
    const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    return (
      <div className="field">
        <div className="field-label">{field.label}</div>
        <div className="field-control"><Chips multi value={settings[field.id] as string[]} options={days} onChange={(v) => onSet(field.id, v)}/></div>
      </div>
    );
  }
  return null;
};

const ToolsView = ({ state, set }: { state: State; set: (patch: Partial<State>) => void }) => {
  const [open, setOpen] = useState<Record<string, boolean>>({ todo: false });
  const toolsOn = Object.values(state.tools).filter(Boolean).length;
  return (
    <div className="row-gap">
      <div className="section-hdr">
        <div className="section-eyebrow">Customize Lekha · Productivity Tools</div>
        <h1 className="section-title">Five surfaces. <span className="gold-text">One assistant.</span></h1>
        <p className="section-desc">Lekha runs as much or as little of your day as you let her. Toggle a tool and click the caret to fine-tune its behavior.</p>
      </div>

      <div className="card tight">
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
          <div style={{fontSize:13.5, color:"var(--ink-dim)"}}>
            <span style={{color: "var(--gold)", fontFamily:"JetBrains Mono, monospace", fontWeight:600, marginRight:8}}>{toolsOn} / 5</span>
            tools enabled · last used <span className="mono" style={{color:"var(--ink)"}}>2m ago</span>
          </div>
          <div className="seg">
            <button className="on">All</button>
            <button>Recent</button>
            <button>Disabled</button>
          </div>
        </div>
      </div>

      <div className="tool-list">
        {TOOLS.map(t => {
          const on = !!state.tools[t.id];
          const isOpen = open[t.id];
          return (
            <div key={t.id} className={`tool ${on ? "on" : ""}`}>
              <div className="tool-head">
                <div className="tool-ico">{t.icon}</div>
                <div className="tool-body">
                  <div className="tool-name">{t.name}</div>
                  <div className="tool-sub">{t.sub}</div>
                </div>
                <Toggle on={on} onChange={(v) => set({ tools: { ...state.tools, [t.id]: v } })}/>
                <button className={`tool-expand ${isOpen ? "open" : ""}`}
                  onClick={() => setOpen({ ...open, [t.id]: !isOpen })}
                  aria-label="Expand settings"><I.caret/></button>
              </div>
              {isOpen && (
                <div className="tool-settings">
                  {t.fields.map(f => (
                    <ToolField key={f.id} field={f}
                      settings={state.toolSettings[t.id] || {}}
                      onSet={(k, v) => set({
                        toolSettings: { ...state.toolSettings,
                          [t.id]: { ...state.toolSettings[t.id], [k]: v }
                        }
                      })}/>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ============== CONNECTIONS VIEW ============== */
const ConnectionsView = ({ state, set }: { state: State; set: (patch: Partial<State>) => void }) => {
  const [connecting, setConnecting] = useState(false);

  const addGoogle = async () => {
    if (connecting) return;
    setConnecting(true);
    try {
      const res = await fetch("/api/dashboard/connect-google");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Google OAuth is not configured.");
      }
    } catch (err) {
      console.error("[dashboard] failed to get connect url", err);
      alert("Could not start Google connection.");
    } finally {
      setConnecting(false);
    }
  };

  const disconnectGoogle = async (email: string) => {
    if (!confirm(`Disconnect ${email}? This will revoke access at Google.`)) return;
    try {
      const res = await fetch("/api/dashboard/disconnect-google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.accounts) {
        set({
          googleAccounts: data.accounts,
          activeGoogleEmail: data.activeEmail,
          connections: {
            ...state.connections,
            gcal: data.accounts.length > 0,
            gmail: data.accounts.length > 0,
            gdrive: data.accounts.length > 0,
            gcontacts: data.accounts.length > 0,
          },
        });
      }
    } catch (err) {
      console.error("[dashboard] failed to disconnect", err);
    }
  };

  const hasGoogle = state.googleAccounts.length > 0;
  return (
    <div className="row-gap">
      <div className="section-hdr">
        <div className="section-eyebrow">Customize Lekha · Connections</div>
        <h1 className="section-title">Plug in <span className="gold-text">your stack.</span></h1>
        <p className="section-desc">Connect Google Workspace for calendar, mail, Drive and contacts. OAuth captures your identity once.</p>
      </div>

      <div className="card">
        <div className="card-hdr">
          <div className="card-hdr-icon"><I.drive/></div>
          <div>
            <h3>Google Workspace</h3>
            <p className="sub">Calendar, Gmail, Drive, Contacts — connected in a single OAuth flow.</p>
          </div>
          <div className="card-hdr-trail">
            <span className="kbd">SECURE · OAUTH 2.0</span>
          </div>
        </div>
        <div className="conn-list">
          {state.googleAccounts.map(acc => (
            <div key={acc.email} className="conn connected">
              <div className="conn-logo" style={{background: "#4285F4", color: "white", fontFamily:"Sora,sans-serif", fontWeight:800, fontSize: 18}}>G</div>
              <div className="conn-body">
                <div className="conn-name">{acc.email}</div>
                <div className="conn-meta ok">● Connected · Calendar, Gmail, Drive, Contacts</div>
              </div>
              <div style={{display:"flex", gap: 8, alignItems:"center"}}>
                {acc.email === state.activeGoogleEmail && (
                  <span className="kbd" style={{fontSize: 11}}>Active</span>
                )}
                <button className="btn-mini disconnect" onClick={() => disconnectGoogle(acc.email)}>Disconnect</button>
              </div>
            </div>
          ))}
          <div className="conn" style={{borderStyle: "dashed", opacity: 0.7}}>
            <div className="conn-logo" style={{background: "rgba(66,133,244,0.15)", color: "#4285F4", fontFamily:"Sora,sans-serif", fontWeight:800, fontSize: 18}}>+</div>
            <div className="conn-body">
              <div className="conn-name" style={{color: "var(--ink-dim)"}}>Add another Google account</div>
              <div className="conn-meta">Multi-account support</div>
            </div>
            <button className="btn-mini connect" onClick={addGoogle} disabled={connecting}>
              {connecting ? "…" : "Connect"}
            </button>
          </div>
          {!hasGoogle && (
            <div className="conn">
              <div className="conn-logo" style={{background: "#333", color: "white", fontFamily:"Sora,sans-serif", fontWeight:800, fontSize: 18}}>G</div>
              <div className="conn-body">
                <div className="conn-name">Google Account</div>
                <div className="conn-meta">Not connected</div>
              </div>
              <button className="btn-mini connect" onClick={addGoogle} disabled={connecting}>
                {connecting ? "…" : "Connect"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ============== MEMORY & PERSONA VIEW ============== */
const MemoryView = ({ state, set }: { state: State; set: (patch: Partial<State>) => void }) => {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const addMemory = async () => {
    if (!draft.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/dashboard/facts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", content: draft.trim(), category: "other" }),
      });
      const data = await res.json();
      if (data.facts) {
        set({ memories: data.facts.map((f: { id: string; category: string; content: string }) => ({ id: f.id, tag: f.category, text: f.content })) });
      }
      setDraft("");
    } catch (err) {
      console.error("[dashboard] failed to add fact", err);
    } finally {
      setSaving(false);
    }
  };

  const deleteMemory = async (id: string) => {
    try {
      const res = await fetch("/api/dashboard/facts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const data = await res.json();
      if (data.facts) {
        set({ memories: data.facts.map((f: { id: string; category: string; content: string }) => ({ id: f.id, tag: f.category, text: f.content })) });
      }
    } catch (err) {
      console.error("[dashboard] failed to delete fact", err);
    }
  };

  return (
    <div className="row-gap">
      <div className="section-hdr">
        <div className="section-eyebrow">Customize Lekha · Memory & Persona</div>
        <h1 className="section-title">How she <span className="gold-text">remembers</span> you.</h1>
        <p className="section-desc">Lekha auto-compacts conversation context every few messages and keeps a small set of long-term facts about you. Edit, add, or delete any time.</p>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-hdr">
            <div className="card-hdr-icon"><I.brain/></div>
            <div>
              <h3>Memory box</h3>
              <p className="sub">Auto-compact rolls up older messages into a summary. Lower = lighter context, higher = more recall.</p>
            </div>
          </div>
          <div className="field">
            <div className="field-label">Memory enabled</div>
            <div className="field-control"><Toggle on={state.memoryEnabled} onChange={v => set({ memoryEnabled: v })}/></div>
          </div>
          <div className="field" style={{marginTop: 12}}>
            <div className="field-label">Auto-compact at</div>
            <div className="field-control"><Slider value={state.compactAt} min={5} max={30} step={1} fmt={(v) => v + " messages"} onChange={(v) => set({ compactAt: v })}/></div>
          </div>
          <div className="divider"/>
          <div style={{fontSize: 12, color: "var(--ink-mute)", lineHeight: 1.5}}>
            <strong style={{color: "var(--ink-dim)"}}>How facts are added:</strong> Every 10 messages, Lekha automatically extracts durable facts about you — preferences, people, habits, work — and stores them here. You can also add or remove facts manually below.
          </div>
        </div>

        <div className="card">
          <div className="card-hdr">
            <div className="card-hdr-icon"><I.user/></div>
            <div>
              <h3>Persona</h3>
              <p className="sub">How Lekha sounds when she speaks to you.</p>
            </div>
          </div>
          <div className="row-gap" style={{gap: 14}}>
            <div className="field">
              <div className="field-label">Tone</div>
              <div className="field-control">
                <Seg value={state.persona.tone} options={["Warm", "Professional", "Playful"]}
                  onChange={(v) => set({ persona: { ...state.persona, tone: v as State["persona"]["tone"] } })}/>
              </div>
            </div>
            <div className="field">
              <div className="field-label">Address you as</div>
              <div className="field-control">
                <Chips value={state.persona.addressing} options={["First name", "Khun", "Sir / Madam", "No address"]}
                  onChange={(v) => set({ persona: { ...state.persona, addressing: v as State["persona"]["addressing"] } })}/>
              </div>
            </div>
            <div className="field">
              <div className="field-label">Primary language</div>
              <div className="field-control">
                <Seg value={state.persona.primaryLang} options={["English", "Thai"]}
                  onChange={(v) => set({ persona: { ...state.persona, primaryLang: v as State["persona"]["primaryLang"] } })}/>
              </div>
            </div>
            <div className="field">
              <div className="field-label">Match your writing voice</div>
              <div className="field-control"><Toggle on={state.persona.voiceMatch} onChange={(v) => set({ persona: { ...state.persona, voiceMatch: v } })}/></div>
            </div>
            <div className="field">
              <div className="field-label">Preferred name</div>
              <div className="field-control">
                <input
                  type="text"
                  className="sched-time-input"
                  placeholder={state.displayName || "LINE display name"}
                  value={state.persona.preferredName ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    set({
                      persona: {
                        ...state.persona,
                        preferredName: v.trim() || null,
                      },
                    });
                  }}
                />
              </div>
              <span className="field-help">What Lekha should call you in chat.</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-hdr">
          <div className="card-hdr-icon"><I.doc/></div>
          <div>
            <h3>What Lekha knows about you</h3>
            <p className="sub">Long-term facts pinned to your profile. She brings these up when relevant.</p>
          </div>
          <div className="card-hdr-trail">
            <span className="kbd">{state.memories.length} entries</span>
          </div>
        </div>
        <div className="mem-list">
          {state.memories.length === 0 && (
            <div className="mem-row" style={{opacity: 0.5}}>
              <span className="mem-text">No memories yet — add one below.</span>
            </div>
          )}
          {state.memories.map((m) => (
            <div key={m.id} className="mem-row">
              <span className="mem-tag">{m.tag}</span>
              <span className="mem-text">{m.text}</span>
              <button className="mem-del" onClick={() => deleteMemory(m.id)}>
                <I.trash/>
              </button>
            </div>
          ))}
          <div className="mem-add">
            <I.plus/>
            <input value={draft} placeholder="Tell Lekha something she should remember about you…"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMemory()}/>
            <button className="btn-mini" onClick={addMemory} disabled={saving}>{saving ? "Saving…" : "Add"}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============== PLAN VIEW ============== */
const PlanView = ({ state }: { state: State }) => {
  const joined = state.joinedAt
    ? new Date(state.joinedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "—";
  return (
    <div className="row-gap">
      <div className="section-hdr">
        <div className="section-eyebrow">Account · Profile</div>
        <h1 className="section-title">Your <span className="gold-text">account.</span></h1>
        <p className="section-desc">Manage your profile and connected services.</p>
      </div>

      <div className="plan-card">
        <div className="plan-eyebrow">PROFILE</div>
        <div className="plan-name">{state.displayName}</div>
        <div className="plan-price">LINE user · {state.userId?.slice(0, 8) ?? ""}…</div>
        <div className="plan-row"><span className="k">Joined</span> <span className="v">{joined}</span></div>
        <div className="plan-row"><span className="k">Subscription</span> <span className="v" style={{color: state.subscriptionActive ? "var(--ok)" : "var(--warn)"}}>{state.subscriptionActive ? "● Active" : "Inactive"}</span></div>
        <div className="plan-row"><span className="k">Google accounts</span> <span className="v">{state.googleAccounts.length} connected</span></div>
        <div className="plan-row"><span className="k">Memory entries</span> <span className="v">{state.memories.length} facts</span></div>
      </div>

      {state.googleAccounts.length > 0 && (
        <div className="card">
          <div className="card-hdr">
            <div className="card-hdr-icon"><I.drive/></div>
            <div>
              <h3>Connected Google accounts</h3>
              <p className="sub">Calendar, Gmail, Drive and Contacts are enabled for each account.</p>
            </div>
          </div>
          <div className="mem-list">
            {state.googleAccounts.map((acc) => (
              <div key={acc.email} className="mem-row">
                <span className="mem-tag" style={{background:"rgba(66,133,244,0.14)", color:"#4285F4"}}>G</span>
                <span className="mem-text"><span style={{color:"var(--ink)"}}>{acc.email}</span> {acc.email === state.activeGoogleEmail ? "· Active" : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ============== LIVE LINE PREVIEW ============== */
const Phone = ({ state, scene }: { state: State; scene: string }) => {
  const activeTopics = TOPICS.filter(t => state.topics[t.id]);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const greeting = ({
    Warm:         "Good morning",
    Professional: "Morning",
    Playful:      "Rise and shine",
  })[state.persona.tone] || "Good morning";

  const address = ({
    "First name":  `, ${state.displayName}`,
    "Khun":        `, Khun ${state.displayName}`,
    "Sir / Madam": ", Sir",
    "No address":  "",
  })[state.persona.addressing] || `, ${state.displayName}`;

  const sceneEl = scene === "briefing" ? (
    <>
      <div className="bubble user">Brief me on today.</div>
      <div className="bubble bot rich">
        <h4>{today} · {activeTopics.length} verticals</h4>
        {activeTopics.length === 0 && (
          <div style={{fontSize: 12, color: "#888", padding: "8px 0"}}>
            No topics enabled — turn some on in the dashboard.
          </div>
        )}
        {activeTopics.slice(0, 4).map((t, i) => (
          <div key={i} className="brief-row">
            <span className="brief-pill">{t.emoji}</span>
            <span className="txt">{t.name} — {t.desc}</span>
          </div>
        ))}
      </div>
      <div className="bubble bot">{greeting + address}. Want me to expand on any of these, or shall I check what&apos;s on your calendar?</div>
    </>
  ) : scene === "tasks" ? (
    <>
      <div className="bubble user">What&apos;s on for today?</div>
      <div className="bubble bot rich">
        <h4>Your agenda</h4>
        <div style={{fontSize: 12, color: "#888", padding: "8px 0"}}>
          Tasks and meetings from your connected calendar will appear here.
        </div>
      </div>
      <div className="bubble bot">I&apos;ll nudge you {state.toolSettings.reminders?.preempt as number ?? 15} min before each meeting.</div>
    </>
  ) : (
    <>
      <div className="bubble user">Set me a reminder for 8am every weekday.</div>
      <div className="bubble bot">Set. Recurring weekdays · 8:00 AM. {(state.toolSettings.reminders?.skipHolidays as boolean) ? "I&apos;ll skip public holidays." : ""} Sound right?</div>
      <div className="bubble user">Draft a reply to my last email.</div>
      <div className="bubble bot">Drafting now in a <strong>{(state.toolSettings.email?.tone as string ?? "warm").toLowerCase()}</strong> tone. Want to review before I send?</div>
    </>
  );

  return (
    <div className="phone">
      <div className="phone-header">
        <div className="phone-back"/>
        <div className="phone-avatar">L</div>
        <div>
          <div className="phone-name">LEKHA · เลขา</div>
          <div className="phone-status">Online</div>
        </div>
        <div className="phone-icons">☎ ⋮</div>
      </div>
      <div className="phone-body">
        {sceneEl}
      </div>
      <div className="phone-input">
        <I.spark style={{color: "#06C755"}}/>
        <span>Type a message…</span>
        <div className="send-btn"><I.send/></div>
      </div>
    </div>
  );
};

const PreviewCol = ({ state }: { state: State }) => {
  const [scene, setScene] = useState("briefing");
  const activeTopics = Object.values(state.topics).filter(Boolean).length;
  const activeTools  = Object.values(state.tools).filter(Boolean).length;
  return (
    <aside className="preview-col">
      <div className="pv-head">
        <div className="pv-eyebrow">Live preview <span className="live">LIVE</span></div>
        <div className="pv-tabs">
          <button className={`pv-tab ${scene==="briefing"?"on":""}`} onClick={() => setScene("briefing")}>Brief</button>
          <button className={`pv-tab ${scene==="tasks"?"on":""}`} onClick={() => setScene("tasks")}>Today</button>
          <button className={`pv-tab ${scene==="inbox"?"on":""}`} onClick={() => setScene("inbox")}>Reply</button>
        </div>
      </div>

      <div className="pv-summary">
        <div className="pv-summary-row">
          <span className="k">Briefing</span>
          <span className="v">{state.morningOn ? state.morningTime : "—"} · {state.eveningOn ? state.eveningTime : "—"}</span>
        </div>
        <div className="pv-summary-row">
          <span className="k">Verticals</span>
          <span className="v gold">{activeTopics} of 7</span>
        </div>
        <div className="pv-summary-row">
          <span className="k">Tools</span>
          <span className="v">{activeTools} active</span>
        </div>
        <div className="pv-summary-row">
          <span className="k">Tone · Lang</span>
          <span className="v">{state.persona.tone} · {state.briefLang}</span>
        </div>
      </div>

      <Phone state={state} scene={scene}/>
    </aside>
  );
};

/* ============== APP ============== */
const TestLineButton = ({ userId }: { userId: string }) => {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const onClick = async () => {
    if (sending) return;
    setSending(true);
    setSent(false);
    try {
      const res = await fetch("/api/dashboard/test-line", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setSent(true);
        setTimeout(() => setSent(false), 3000);
      } else {
        alert("Failed to send test message. Check console.");
      }
    } catch (err) {
      console.error("[dashboard] test-line failed", err);
      alert("Network error — could not send test message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <button className="btn btn-primary" onClick={onClick} disabled={sending}>
      {sending ? "Sending…" : sent ? "Sent ✓" : "Test in LINE →"}
    </button>
  );
};

const TWEAK_DEFAULTS = {
  accent: "blue",
  panelDensity: "comfortable",
  showLivePreview: true,
};

const VIEWS: Record<string, React.FC<any>> = {
  overview:    OverviewView,
  briefing:    BriefingView,
  tools:       ToolsView,
  connections: ConnectionsView,
  memory:      MemoryView,
  plan:        PlanView,
};

export default function DashboardClient({ userId, displayName }: { userId: string; displayName: string }) {
  const [active, setActive] = useState("briefing");
  const [state, setState] = useState<State>(() => makeDefaultState(displayName, userId));
  const [loaded, setLoaded] = useState(false);
  const [tweaks, setTweaks] = useState(TWEAK_DEFAULTS);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastServerState = useRef<State | null>(null);
  const changeGen = useRef(0);
  const abortCtrl = useRef<AbortController | null>(null);
  const stateRef = useRef<State>(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Load settings from backend on mount
  useEffect(() => {
    fetch("/api/dashboard/me")
      .then(r => r.json())
      .then(data => {
        if (data.settings) {
          setState(prev => {
            const s = data.settings;
            const next = {
              ...prev,
              morningOn: s.morningBriefingTime !== null,
              morningTime: s.morningBriefingTime ?? "07:00",
              eveningOn: s.eveningSummaryEnabled,
              eveningTime: s.eveningSummaryTime ?? "21:00",
              checkinOn: s.taskCheckInEnabled,
              checkinTime: s.taskCheckInTime ?? deriveCheckInTime(s.eveningSummaryTime ?? "21:00"),
              topics: s.briefingTopics ?? prev.topics,
              briefLength: s.briefingLength ?? prev.briefLength,
              briefLang: s.briefingLanguage ?? prev.briefLang,
              briefChannels: s.briefingChannels ?? prev.briefChannels,
              topicSources: s.briefingTopicSources ?? prev.topicSources,
              timezone: s.timezone ?? prev.timezone,
              tools: s.tools ?? prev.tools,
              toolSettings: s.toolSettings ?? prev.toolSettings,
              compactAt: s.memoryCompactAt ?? prev.compactAt,
              memoryEnabled: s.memoryEnabled ?? prev.memoryEnabled,
              persona: {
                tone: s.personaTone ?? prev.persona.tone,
                addressing: s.personaAddressing ?? prev.persona.addressing,
                primaryLang: s.personaPrimaryLang ?? prev.persona.primaryLang,
                voiceMatch: s.personaVoiceMatch ?? prev.persona.voiceMatch,
                preferredName: s.personaPreferredName ?? prev.persona.preferredName,
              },
              displayName: data.displayName ?? prev.displayName,
              memories: data.facts
                ? data.facts.map((f: { id: string; category: string; content: string }) => ({ id: f.id, tag: f.category, text: f.content }))
                : prev.memories,
              googleAccounts: data.googleAccounts ?? prev.googleAccounts,
              activeGoogleEmail: data.activeGoogleEmail ?? prev.activeGoogleEmail,
              joinedAt: data.joinedAt ?? prev.joinedAt,
              subscriptionActive: data.subscriptionActive ?? prev.subscriptionActive,
              connections: {
                ...prev.connections,
                line: true,
                gcal: (data.googleAccounts?.length ?? 0) > 0,
                gmail: (data.googleAccounts?.length ?? 0) > 0,
                gdrive: (data.googleAccounts?.length ?? 0) > 0,
                gcontacts: (data.googleAccounts?.length ?? 0) > 0,
              },
            };
            lastServerState.current = next;
            return next;
          });
        } else {
          lastServerState.current = stateRef.current;
        }
        setLoaded(true);
      })
      .catch(err => {
        console.error("[dashboard] failed to load settings", err);
        lastServerState.current = stateRef.current;
        setLoaded(true);
      });
  }, []);

  // Persist to backend on change (debounced, optimistic + silent retry)
  const syncToBackend = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (!lastServerState.current) return;
      const snapshot = stateRef.current;
      changeGen.current += 1;
      const syncGen = changeGen.current;

      const derivedCheckIn = deriveCheckInTime(snapshot.eveningTime);
      const checkinTimeToSave = !snapshot.checkinOn
        ? null
        : snapshot.checkinTime === derivedCheckIn
          ? null
          : snapshot.checkinTime;
      const body = {
        morningOn: snapshot.morningOn,
        morningTime: snapshot.morningTime,
        eveningOn: snapshot.eveningOn,
        eveningTime: snapshot.eveningTime,
        checkinOn: snapshot.checkinOn,
        checkinTime: checkinTimeToSave,
        topics: snapshot.topics,
        briefLength: snapshot.briefLength,
        briefLang: snapshot.briefLang,
        briefChannels: snapshot.briefChannels,
        briefingTopicSources: snapshot.topicSources,
        tools: snapshot.tools,
        toolSettings: snapshot.toolSettings,
        compactAt: snapshot.compactAt,
        memoryEnabled: snapshot.memoryEnabled,
        personaTone: snapshot.persona.tone,
        personaAddressing: snapshot.persona.addressing,
        personaPrimaryLang: snapshot.persona.primaryLang,
        personaVoiceMatch: snapshot.persona.voiceMatch,
        personaPreferredName: snapshot.persona.preferredName?.trim() || null,
      };

      if (abortCtrl.current) abortCtrl.current.abort();
      const ctrl = new AbortController();
      abortCtrl.current = ctrl;

      const serverSnapshot = lastServerState.current;
      const attempt = async (retriesLeft: number, delayMs: number) => {
        try {
          const res = await fetch("/api/dashboard/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: ctrl.signal,
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error ?? `save failed (${res.status})`);
          }
          if (syncGen === changeGen.current) {
            lastServerState.current = snapshot;
            setSaveNotice(null);
          }
        } catch (err) {
          if (ctrl.signal.aborted) return;
          if (syncGen !== changeGen.current) return;
          console.error("[dashboard] save attempt failed", err);
          if (retriesLeft > 0) {
            setTimeout(() => attempt(retriesLeft - 1, delayMs * 3), delayMs);
            return;
          }
          setState(serverSnapshot);
          setSaveNotice("Couldn't save — changes reverted");
          setTimeout(() => {
            setSaveNotice((cur) =>
              cur === "Couldn't save — changes reverted" ? null : cur,
            );
          }, 4000);
        }
      };
      attempt(2, 500);
    }, 1200);
  }, []);

  const set = useCallback((patch: Partial<State>) => {
    setState(prev => ({ ...prev, ...patch }));
    syncToBackend();
  }, [syncToBackend]);

  // apply accent tweak
  useEffect(() => {
    const root = document.documentElement;
    const accents: Record<string, { blue: string; bright: string; gold: string }> = {
      blue:  { blue: "#3b82f6", bright: "#60a5fa", gold: "#f5b942" },
      gold:  { blue: "#d97706", bright: "#f5b942", gold: "#fcd34d" },
      sage:  { blue: "#10b981", bright: "#34d399", gold: "#fcd34d" },
      rose:  { blue: "#e11d48", bright: "#fb7185", gold: "#fcd34d" },
    };
    const a = accents[tweaks.accent] ?? accents.blue;
    root.style.setProperty("--blue", a!.blue);
    root.style.setProperty("--blue-bright", a!.bright);
    root.style.setProperty("--gold", a!.gold);
    root.style.setProperty("--grad-blue", `linear-gradient(135deg, ${a!.blue} 0%, ${a!.bright} 100%)`);
  }, [tweaks.accent]);

  const counts = {
    topicsOn: Object.values(state.topics).filter(Boolean).length,
    toolsOn:  Object.values(state.tools).filter(Boolean).length,
    connsOn:  state.googleAccounts.length,
  };

  const ViewComp = (VIEWS[active] ?? VIEWS.briefing) as React.FC<any>;
  if (!loaded) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100vh", color: "var(--ink-dim)", background: "var(--bg)" }}>
        <div style={{ fontFamily: "Sora, sans-serif", fontSize: 14 }}>Loading your dashboard…</div>
      </div>
    );
  }

  return (
    <>
      <div className="aurora"/>
      <div className="grid-bg"/>
      <div className="noise"/>

      <div className="app" style={tweaks.showLivePreview === false ? { gridTemplateColumns: "264px minmax(0, 1fr)" } : undefined}>
        <Sidebar active={active} setActive={setActive} counts={counts} displayName={state.displayName}/>

        <main className="main">
          <Topbar active={active}/>
          <ViewComp state={state} set={set} setActive={setActive}/>

          <div className="savebar">
            {saveNotice ? (
              <div className="save-notice">{saveNotice}</div>
            ) : (
              <I.shield style={{color:"var(--ok)"}}/>
            )}
            <div>
              <div style={{color:"var(--ink)", fontWeight:600, fontSize:13.5}}>Auto-save on</div>
              <div style={{fontSize:12, color:"var(--ink-mute)", fontFamily:"JetBrains Mono, monospace"}}>
                Every change syncs to Lekha within 2 seconds · stored in the cloud
              </div>
            </div>
            <button className="btn btn-ghost" onClick={() => {
              if (confirm("Reset all customizations to default?")) {
                const def = makeDefaultState(displayName, userId);
                setState(def);
                lastServerState.current = def;
                syncToBackend();
              }
            }}>Reset to defaults</button>
            <TestLineButton userId={userId} />
          </div>
        </main>

        {tweaks.showLivePreview !== false && <PreviewCol state={state}/>}
      </div>
    </>
  );
}