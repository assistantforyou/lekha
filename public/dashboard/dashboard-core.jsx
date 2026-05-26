/* LEKHA Dashboard — Customize features */
const { useState, useEffect, useRef, useMemo } = React;

/* ============== ICONS ============== */
const I = {
  spark:    (p) => <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" {...p}><path d="M12 2l2.39 6.61L21 11l-6.61 2.39L12 20l-2.39-6.61L3 11l6.61-2.39L12 2z"/></svg>,
  chat:     (p) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>,
  bell:     (p) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>,
  news:     (p) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zM2 18v2a2 2 0 0 0 2 2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6z"/></svg>,
  check:    (p) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6L9 17l-5-5"/></svg>,
  chart:    (p) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-7"/></svg>,
  mail:     (p) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>,
  search:   (p) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>,
  cal:      (p) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>,
  send:     (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>,
  globe:    (p) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/></svg>,
  shield:   (p) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z"/></svg>,
  bolt:     (p) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg>,
  doc:      (p) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>,
  drive:    (p) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 2l5 8.66H7L12 2zM7 10.66L2 19.32h10L7 10.66zM17 10.66L22 19.32H12L17 10.66z"/></svg>,
  brain:    (p) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-3 3 3 3 0 0 0 1 2.2A3 3 0 0 0 5 15a3 3 0 0 0 4 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3z"/><path d="M15 3a3 3 0 0 1 3 3 3 3 0 0 1 3 3 3 3 0 0 1-1 2.2A3 3 0 0 1 19 15a3 3 0 0 1-4 3 3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z"/></svg>,
  user:     (p) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  card:     (p) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,
  link:     (p) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5"/></svg>,
  home:     (p) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V9.5z"/></svg>,
  trash:    (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>,
  plus:     (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 5v14M5 12h14"/></svg>,
  caret:    (p) => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 9l6 6 6-6"/></svg>,
  sun:      (p) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>,
  moon:     (p) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  image:    (p) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>,
};

const LekhaMark = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 5v10a4 4 0 0 0 4 4h6"/>
    <circle cx="17" cy="7" r="2.2" fill="white" stroke="none"/>
  </svg>
);

/* ============== DATA ============== */
const TOPICS = [
  { id: 'stocks',   emoji: '📈', name: 'Stock Markets',       thai: 'หุ้นและการลงทุน',   desc: 'Live quotes, sentiment, watchlist alerts and earnings calendar.', sources: 42 },
  { id: 'wellness', emoji: '🌿', name: 'Wellness',             thai: 'สุขภาพและความเป็นอยู่', desc: 'Research-backed health, sleep, nutrition and recovery.',            sources: 28 },
  { id: 'politics', emoji: '🏛️', name: 'Politics',             thai: 'การเมือง',          desc: 'Policy, regulation and government — Thailand and global.',          sources: 36 },
  { id: 'crime',    emoji: '🚨', name: 'Breaking & Crime',     thai: 'ข่าวด่วนและอาชญากรรม', desc: 'Critical safety alerts and major incidents only — no clickbait.',  sources: 24 },
  { id: 'sports',   emoji: '⚽', name: 'Sports Journalism',    thai: 'กีฬาเชิงลึก',        desc: 'Long-form sports — strategy, business of sport, athlete profiles.', sources: 21 },
  { id: 'business', emoji: '💼', name: 'Business & Economy',   thai: 'ธุรกิจและเศรษฐกิจ', desc: 'M&A, macro trends, ASEAN markets, and global business news.',       sources: 58 },
  { id: 'entertain',emoji: '🎬', name: 'Entertainment & Celebrity', thai: 'บันเทิงและคนดัง', desc: 'Film, music, lifestyle, celebrity moves — curated, not gossipy.', sources: 19 },
];

const TOOLS = [
  {
    id: 'todo', icon: <I.check/>, name: 'To-do list', sub: 'Capture, prioritise, follow through',
    fields: [
      { id: 'prio', kind: 'seg', label: 'Default sort', options: ['Deadline', 'Priority', 'Energy fit'] },
      { id: 'nudge', kind: 'slider', label: 'Nudge frequency', min: 0, max: 4, step: 1, fmt: (v) => ['Off','Once daily','Twice daily','Hourly','Every 30 min'][v] },
      { id: 'followup', kind: 'toggle', label: 'Auto-capture follow-ups from meetings' },
    ]
  },
  {
    id: 'reminders', icon: <I.bell/>, name: 'Reminders', sub: 'Time, location, and event-based nudges',
    fields: [
      { id: 'quiet', kind: 'time-range', label: 'Quiet hours' },
      { id: 'preempt', kind: 'slider', label: 'Pre-meeting alert', min: 5, max: 60, step: 5, fmt: (v) => v + ' min before' },
      { id: 'skipHolidays', kind: 'toggle', label: 'Skip public holidays (TH calendar)' },
    ]
  },
  {
    id: 'calendar', icon: <I.cal/>, name: 'Calendar', sub: 'Cross-timezone, deep-work protection, briefs',
    fields: [
      { id: 'tz', kind: 'chips', label: 'Timezone', options: ['Asia/Bangkok', 'Asia/Singapore', 'America/New_York', 'Europe/London'] },
      { id: 'deepwork', kind: 'time-range', label: 'Deep-work block' },
      { id: 'noMeet', kind: 'days', label: 'No-meeting days' },
      { id: 'prebrief', kind: 'toggle', label: 'Auto-generate pre-meeting briefs' },
    ]
  },
  {
    id: 'email', icon: <I.mail/>, name: 'Email & assistant', sub: 'Send and receive on your behalf',
    fields: [
      { id: 'tone', kind: 'chips', label: 'Default tone', options: ['Warm', 'Professional', 'Concise', 'Friendly'] },
      { id: 'signoff', kind: 'chips', label: 'Sign-off', options: ['Best,', 'Thanks,', 'Cheers,', 'Warmly,'] },
      { id: 'autosend', kind: 'seg', label: 'Send behavior', options: ['Always confirm', 'Confirm if > $1k', 'Auto-send drafts'] },
    ]
  },
  {
    id: 'drive', icon: <I.drive/>, name: 'Drive & Google', sub: 'Search, summarise, organise files',
    fields: [
      { id: 'scope', kind: 'chips', label: 'Default scope', options: ['My Drive', 'Shared with me', 'Everything'] },
      { id: 'fmt',   kind: 'seg', label: 'Summary length', options: ['Headline', 'Bullets', '1 page'] },
      { id: 'autosort', kind: 'toggle', label: 'Auto-file attachments into Drive › Expenses / Memos' },
    ]
  },
];

const CONNECTIONS = [
  { id: 'line',     name: 'LINE Messenger',  meta: 'Lekha runs here',         status: 'connected',    handle: 'LEKHA Official · LINE ID captured',  brand: '#06C755', glyph: 'L' },
  { id: 'gcal',     name: 'Google Calendar', meta: 'Schedule, briefs, deep-work',   status: 'connected', handle: 'alex@saraburi.co · last sync 2 min ago', brand: '#4285F4', glyph: 'C' },
  { id: 'gmail',    name: 'Gmail',           meta: 'Triage, draft, send',     status: 'connected',    handle: 'alex@saraburi.co · 23 unread', brand: '#EA4335', glyph: 'M' },
  { id: 'gdrive',   name: 'Google Drive',    meta: 'Search and summarise',    status: 'connected',    handle: 'alex@saraburi.co · 14.2 GB / 30 GB', brand: '#34A853', glyph: 'D' },
  { id: 'gcontacts',name: 'Google Contacts', meta: 'Resolve "mom", "bob" to email', status: 'disconnected', handle: 'Not connected', brand: '#FBBC05', glyph: 'P' },
  { id: 'gpeople',  name: 'Notion',          meta: 'Export memos and briefs', status: 'disconnected', handle: 'Connect to sync', brand: '#000', glyph: 'N' },
];

const NAV_SECTIONS = [
  { group: 'WORKSPACE', items: [
    { id: 'overview',     label: 'Overview',                ico: <I.home/>,  count: null },
  ]},
  { group: 'CUSTOMIZE LEKHA', items: [
    { id: 'briefing',     label: 'Daily Brief Topics',      ico: <I.news/>,  countKey: 'topicsOn', total: 7 },
    { id: 'tools',        label: 'Productivity Tools',      ico: <I.bolt/>,  countKey: 'toolsOn',  total: 5 },
    { id: 'connections',  label: 'Connections',             ico: <I.link/>,  countKey: 'connsOn',  total: 6 },
    { id: 'memory',       label: 'Memory & Persona',        ico: <I.brain/>, count: null },
  ]},
  { group: 'ACCOUNT', items: [
    { id: 'plan',         label: 'Plan & Billing',          ico: <I.card/>,  count: null },
  ]},
];

/* ============== DEFAULT STATE ============== */
const DEFAULT_STATE = {
  /* Schedule */
  morningOn: true,
  morningTime: '07:00',
  eveningOn: true,
  eveningTime: '21:00',
  /* Topics */
  topics: {
    stocks: true, wellness: true, politics: false, crime: false,
    sports: false, business: true, entertain: false,
  },
  /* Brief format */
  briefLength: 'Headlines', // Headlines | Bullets | Full
  briefLang: 'EN + ไทย',
  briefChannels: { line: true, email: false, push: true },
  /* Productivity */
  tools: { todo: true, reminders: true, calendar: true, email: true, drive: true },
  toolSettings: {
    todo:      { prio: 'Deadline', nudge: 2, followup: true },
    reminders: { quietStart: '22:00', quietEnd: '06:30', preempt: 15, skipHolidays: true },
    calendar:  { tz: 'Asia/Bangkok', deepStart: '09:00', deepEnd: '11:00', noMeet: ['Wed','Fri'], prebrief: true },
    email:     { tone: 'Warm', signoff: 'Best,', autosend: 'Always confirm' },
    drive:     { scope: 'My Drive', fmt: 'Bullets', autosort: true },
  },
  /* Connections */
  connections: { line: true, gcal: true, gmail: true, gdrive: true, gcontacts: false, gpeople: false },
  /* Memory */
  compactAt: 10,
  memoryEnabled: true,
  memories: [
    { tag: 'Coffee',  text: 'Prefers espresso. No sugar.' },
    { tag: 'Family',  text: 'Wife: Pim · Birthday Mar 14' },
    { tag: 'Work',    text: 'CEO, Saraburi Group · Bangkok' },
    { tag: 'Habit',   text: 'Walks every morning before briefing' },
    { tag: 'Watchlist', text: 'NVDA · TSLA · SET · BTC' },
  ],
  /* Persona */
  persona: {
    tone: 'Warm',           // Warm | Professional | Playful
    addressing: 'First name',
    primaryLang: 'English',
    voiceMatch: true,
  },
};

const STORAGE_KEY = 'lekha-dashboard-v1';
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch (e) { return DEFAULT_STATE; }
}

/* ============== HELPERS ============== */
const Toggle = ({ on, onChange }) => (
  <button
    className={`toggle ${on ? 'on' : ''}`}
    aria-pressed={on}
    onClick={(e) => { e.stopPropagation(); onChange(!on); }}
  />
);

const Seg = ({ value, options, onChange }) => (
  <div className="seg">
    {options.map(o => (
      <button key={o} className={value === o ? 'on' : ''} onClick={() => onChange(o)}>{o}</button>
    ))}
  </div>
);

const Chips = ({ value, options, onChange, multi }) => (
  <div className="chips">
    {options.map(o => {
      const on = multi ? (value || []).includes(o) : value === o;
      return (
        <button key={o} className={`chip ${on ? 'on' : ''}`}
          onClick={() => {
            if (multi) {
              const arr = value || [];
              onChange(arr.includes(o) ? arr.filter(x => x !== o) : [...arr, o]);
            } else onChange(o);
          }}>{o}</button>
      );
    })}
  </div>
);

const Slider = ({ value, min, max, step = 1, onChange, fmt }) => {
  const p = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider-wrap">
      <input type="range" className="slider"
        min={min} max={max} step={step} value={value}
        style={{ '--p': `${p}%` }}
        onChange={(e) => onChange(Number(e.target.value))}/>
      <span className="slider-val">{fmt ? fmt(value) : value}</span>
    </div>
  );
};

/* ============== SIDEBAR ============== */
const Sidebar = ({ active, setActive, counts }) => (
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
              className={`nav-item ${active === it.id ? 'active' : ''}`}
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
      <div className="avatar">A</div>
      <div className="meta">
        <div className="name">Alex Saraburi</div>
        <div className="plan">YEARLY · เลขา</div>
      </div>
    </div>
  </aside>
);

/* ============== TOPBAR ============== */
const Topbar = ({ active }) => {
  const crumbs = {
    overview: ['Workspace', 'Overview'],
    briefing: ['Customize Lekha', 'Daily Brief'],
    tools: ['Customize Lekha', 'Productivity'],
    connections: ['Customize Lekha', 'Connections'],
    memory: ['Customize Lekha', 'Memory & Persona'],
    plan: ['Account', 'Plan & Billing'],
  }[active] || ['Workspace'];
  return (
    <div className="topbar">
      <div className="crumbs">
        <span>~</span><span className="sep">/</span>
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="sep">/</span>}
            <span className={i === crumbs.length - 1 ? 'cur' : ''}>{c.toLowerCase().replace(/ /g, '-')}</span>
          </React.Fragment>
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

Object.assign(window, { I, LekhaMark, TOPICS, TOOLS, CONNECTIONS, NAV_SECTIONS, DEFAULT_STATE, STORAGE_KEY, loadState, Toggle, Seg, Chips, Slider, Sidebar, Topbar });
