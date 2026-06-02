// @ts-nocheck
"use client";

import "./marketing.css";
/* LEKHA marketing site — main app */
import React, { useState, useEffect, useRef, useMemo } from "react";
import type { SVGProps } from "react";
import Link from "next/link";

/* ---------- Icons (inline SVGs, single-line strokes) ---------- */
const Ico = {
  spark: (p: SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" {...p}><path d="M12 2l2.39 6.61L21 11l-6.61 2.39L12 20l-2.39-6.61L3 11l6.61-2.39L12 2z" /></svg>,
  chat: (p: SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>,
  bell: (p: SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>,
  news: (p: SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zM2 18v2a2 2 0 0 0 2 2" /><path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6z" /></svg>,
  check: (p: SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6L9 17l-5-5" /></svg>,
  chart: (p: SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 5-7" /></svg>,
  mail: (p: SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>,
  search: (p: SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>,
  cal: (p: SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></svg>,
  send: (p: SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>,
  globe: (p: SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" /></svg>,
  shield: (p: SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" /></svg>,
  bolt: (p: SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" /></svg>,
  doc: (p: SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>,
  lang: (p: SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 8h12M9 4v4c0 5-2 8-5 9M12 16c.5 2 2 4 4 5M15 20l4-9 4 9M16.5 17h5" /></svg>,
  image: (p: SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></svg>,
  tune: (p: SVGProps<SVGSVGElement>) => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>
};

/* ---------- Logo mark ---------- */
const LekhaMark = () =>
<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 5v10a4 4 0 0 0 4 4h6" />
    <circle cx="17" cy="7" r="2.2" fill="white" stroke="none" />
  </svg>;


/* ---------- Nav ---------- */
const Nav = () =>
<nav className="nav">
    <div className="container nav-inner">
      <div className="brand">
        <div className="brand-mark"><LekhaMark /></div>
        <span>LEKHA</span>
      </div>
      <ul className="nav-links">
        <li><Link href="#features">Features</Link></li>
        <li><Link href="#operations">Operations Layer</Link></li>
        <li><Link href="#builtfor">Use Cases</Link></li>
        <li><Link href="#pricing">Pricing</Link></li>
        <li><Link href="#faq">FAQ</Link></li>
      </ul>
      <div className="nav-cta">
        <Link className="btn btn-ghost hide-sm" href="/api/auth/line/dashboard-start">Sign in</Link>
        <a className="btn btn-primary" href="https://forms.gle/6qu52TxR4sYHWymX7" target="_blank" rel="noopener">Book a 1-on-1 session with us <Ico.cal /></a>
      </div>
    </div>
  </nav>;


/* ---------- QR Modal (Instagram / LINE) ---------- */
const QR_CONFIGS = {
  instagram: {
    variant: 'instagram',
    eyebrow: 'Follow on Instagram',
    title: 'Scan to follow',
    titleAccent: '@assisstantforyou',
    sub: 'Point your phone camera at the code, or tap below to open Instagram in a new tab.',
    qrSrc: '/assets/instagram-qr.png',
    qrAlt: 'Instagram QR code for @assisstantforyou',
    handle: '@assisstantforyou',
    handleIcon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>,
    ctaLabel: 'Open Instagram',
    ctaHref: 'https://www.instagram.com/assisstantforyou/',
    ariaLabel: 'Follow LEKHA on Instagram'
  },
  line: {
    variant: 'line',
    eyebrow: 'Add LEKHA on LINE',
    title: 'Scan to add',
    titleAccent: 'LEKHA on LINE',
    sub: 'Open the LINE app, tap “Add friend → QR code”, and point your camera here. Or tap below to open in a new tab.',
    qrSrc: '/assets/line-qr.png',
    qrAlt: 'LINE Add friend QR code for LEKHA',
    handle: 'LEKHA Official',
    handleIcon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>,
    ctaLabel: 'Open LINE',
    ctaHref: 'https://lin.ee/NuCuel7',
    ariaLabel: 'Add LEKHA on LINE'
  }
};

const QRModal = ({ open, onClose, config }: { open: boolean; onClose: () => void; config: (typeof QR_CONFIGS)[keyof typeof QR_CONFIGS] | null }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !config) return null;
  const c = config;
  return (
    <div className={`ig-modal ig-modal-${c.variant}`} role="dialog" aria-modal="true" aria-label={c.ariaLabel} onClick={onClose}>
      <div className="ig-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="ig-close" aria-label="Close" onClick={onClose}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>

        <div className="ig-eyebrow">
          <span className="ig-eyebrow-dot"></span>
          {c.eyebrow}
        </div>
        <h3 className="ig-title">{c.title} <span className="ig-gradient">{c.titleAccent}</span></h3>
        <p className="ig-sub">{c.sub}</p>

        <div className="ig-qr-frame">
          <span className="ig-corner tl"></span>
          <span className="ig-corner tr"></span>
          <span className="ig-corner bl"></span>
          <span className="ig-corner br"></span>
          <img src={c.qrSrc} alt={c.qrAlt} />
        </div>

        <div className="ig-handle">
          {c.handleIcon}
          <span>{c.handle}</span>
        </div>

        <div className="ig-actions">
          <a className="btn btn-gold" href={c.ctaHref} target="_blank" rel="noopener">
            {c.ctaLabel}
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M9 7h8v8" /></svg>
          </a>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>);

};

/* ---------- Hero ---------- */
const Hero = () => {
  const phrases = ['Brief me on today.', 'Add a 3pm reminder.', 'Analyze NVDA stock.', 'Draft a reply to David.', 'What\u2019s on my calendar?'];
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState('');
  const [qrModal, setQrModal] = useState<string | null>(null);
  useEffect(() => {
    let i = 0;
    let dir = 1;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const tick = () => {
      const target = phrases[idx] ?? "";
      i += dir;
      if (i > target.length) {
        dir = -1;
        timers.push(setTimeout(tick, 1500));
        return;
      }
      if (i < 0) {
        timers.push(setTimeout(() => {
          setIdx((p) => (p + 1) % phrases.length);
        }, 0));
        dir = 1;
        timers.push(setTimeout(tick, 200));
        return;
      }
      setTyped(target.slice(0, i));
      timers.push(setTimeout(tick, dir === 1 ? 55 : 28));
    };
    timers.push(setTimeout(tick, 400));
    return () => timers.forEach(clearTimeout);
  }, [idx]);

  return (
    <section className="hero">
      <div className="container hero-grid">
        <div>
          <span className="pill"><span className="spark"></span> AI Executive Assistant · Bilingual EN / ไทย</span>
          <h1>
            <span className="row">Meet</span>
            <span className="row gold-text thai">เลขา</span>
            <span className="row" style={{ color: "rgb(240, 246, 255)" }}>your AI Chief of Operations (COO).</span>
          </h1>
          <p className="hero-sub">LEKHA, a LLM trained by GOOGLE, briefs you twice a day, runs your to-do list, watches your calendar, drafts replies, analyses stock markets, daily news brief, and a personal secretary that you can talk to - all in one chat. Built for executives and high performance workers who want their day on autopilot.

          </p>
          <div className="hero-cta">
            <button type="button" className="btn btn-gold btn-qr" onClick={() => setQrModal('line')}>
              Contact us on LINE <Ico.bolt />
              <span className="ig-pill ig-pill-line">QR</span>
            </button>
            <button type="button" className="btn btn-ghost btn-qr" onClick={() => setQrModal('instagram')}>
              <Ico.chat /> Our Instagram
              <span className="ig-pill">QR</span>
            </button>
          </div>
          <div className="hero-meta">
            <div className="stat"><div className="num"><span className="gold-text"></span></div><div className="lbl"></div></div>
            <div className="stat"><div className="num"></div><div className="lbl"></div></div>
            <div className="stat"><div className="num"></div><div className="lbl"></div></div>
          </div>
        </div>

        <div>
          <div className="avatar-stage">
            <img src="/assets/lekha-hero.png" alt="LEKHA avatar" />
            <div className="chat-float">
              <span className="dot"></span>{" Online\n            "}
            </div>
            <div className="floater-stack">
              <div className="floater fx">
                <div className="icon-box ic-square"><Ico.bell /></div>
                <div>
                  <div className="fx-label">Reminder</div>
                  <div className="fx-body">Morning Meeting · 10:00 AM</div>
                </div>
              </div>
              <div className="floater fx">
                <div className="icon-box ic-round"><Ico.chat /></div>
                <div>
                  <div className="fx-label">Chat</div>
                  <div className="fx-body thai">สวัสดีค่ะ วันนี้ให้คุณเลขาช่วยอะไรได้บ้างคะ</div>
                </div>
              </div>
              <div className="floater fx">
                <div className="icon-box ic-diamond"><Ico.chat /></div>
                <div>
                  <div className="fx-label">Chat</div>
                  <div className="fx-body">Good morning. What can LEKHA help you with today?</div>
                </div>
              </div>
            </div>
            <div className="glow-ring"></div>
          </div>
        </div>
      </div>

      <MetricsStrip />

      <div className="container">
        <div className="trusted" style={{ height: "1px", padding: "24px" }}>
          <div className="trusted-inner">
            <span className="trusted-label" style={{ textAlign: "center" }}>&quot;OUR PRODUCT HAS BEEN USED AND TRUSTED BY BUSINESS EXECUTIVES, DOCTORS, AND OTHER HIGH PERFORMANCE FIELDS&quot; - LEKHA ADMINS</span>
            <div className="trusted-logos">
              <span></span>
              <span>
</span>
              <span>
</span>
              <span>
</span>
              <span></span>
            </div>
          </div>
        </div>
      </div>
      <QRModal open={!!qrModal} onClose={() => setQrModal(null)} config={qrModal ? QR_CONFIGS[qrModal as keyof typeof QR_CONFIGS] : null} />
    </section>);};
/* ---------- Feature explorer data ---------- */
const FEATURES = [
{
  id: 'briefing',
  icon: <Ico.news />,
  label: 'Daily Briefing',
  short: 'News tuned to you',
  eyebrow: 'Morning intel',
  title: 'Wake up to what actually matters — to you.',
  body: 'Choose your categories — innovation, technology, wellness, self-care, markets, world. LEKHA scans 200+ trusted sources overnight and assembles a briefing only on the topics you care about, read in 90 seconds.',
  bullets: ['Pick & re-mix categories anytime — innovation, tech, wellness, self-care, markets, world', 'Cited sources, no hallucinated facts', 'Delivered to chat, email, or Line at the time you wake']
},
{
  id: 'tasks',
  icon: <Ico.check />,
  label: 'Tasks & Reminders',
  short: 'Todos that actually get done',
  eyebrow: 'Get it done',
  title: 'A todo list that nags you politely.',
  body: 'Just tell LEKHA what needs doing. She remembers, prioritises, schedules nudges, and follows up after meetings to capture loose ends automatically.',
  bullets: ['Natural language input — type or speak', 'Smart prioritisation by deadline & energy', 'Recurring reminders, snooze, and follow-throughs']
},
{
  id: 'stocks',
  icon: <Ico.chart />,
  label: 'Stock Analysis',
  short: 'Market read in plain English',
  eyebrow: 'Markets',
  title: 'A junior analyst on call.',
  body: 'Ask about any ticker, sector or macro event. LEKHA pulls live data, fundamentals and sentiment — then summarises the thesis in language you can act on.',
  bullets: ['Live quotes, fundamentals & earnings', 'Sentiment + news triangulation', 'Watchlist alerts on price & headline events']
},
{
  id: 'inbox',
  icon: <Ico.mail />,
  label: 'Email · Send & Receive',
  short: 'Writes & answers for you',
  eyebrow: 'Communication',
  title: 'She writes — and replies — on your behalf.',
  body: 'Connect Gmail or Outlook and LEKHA receives incoming mail, triages it, and drafts (or sends) responses in your voice. Composing a new email? Just describe it in chat — she writes and sends.',
  bullets: ['Sends emails on your behalf — dictate in chat, she writes and ships', 'Receives & triages incoming mail — surfaces only what needs you', 'Voice-cloned tone & signature · auto-replies when you’re away']
},
{
  id: 'research',
  icon: <Ico.search />,
  label: 'Research & Insights',
  short: 'Deep-dive in minutes',
  eyebrow: 'Research',
  title: 'Deep research, citations included.',
  body: 'Ask a hard question — competitive landscape, regulatory change, a company background — and LEKHA delivers a structured brief with sources.',
  bullets: ['Multi-source synthesis', 'Tables, comparisons & charts', 'Export to Docs, Notion or PDF']
},
{
  id: 'cal',
  icon: <Ico.cal />,
  label: 'Calendar',
  short: 'Scheduling on autopilot',
  eyebrow: 'Calendar',
  title: 'Stop playing meeting Tetris.',
  body: 'LEKHA negotiates times, prepares pre-reads, and protects deep-work blocks. She knows your timezone, your travel and when you’d rather walk the dog.',
  bullets: ['Cross-timezone scheduling', 'Auto-generated meeting briefs', 'Deep-work protection & no-meeting days']
},
{
  id: 'media',
  icon: <Ico.image />,
  label: 'Image Analysis',
  short: 'Drop a photo, get answers',
  eyebrow: 'Vision',
  title: 'Send her a picture — she reads it.',
  body: 'Receipts, whiteboards, slides, screenshots, lab results, a menu in another language. LEKHA extracts the data, summarises what’s in the frame, and files it where it belongs.',
  bullets: ['Receipts → expense entries, instantly', 'Whiteboards & screenshots → typed notes', 'Translate signs, menus & documents from a single photo']
}];


/* ---------- Chat preview content by feature ---------- */
const ChatBody = ({ id }: { id: string }) => {
  if (id === 'briefing') return (
    <React.Fragment>
      <div className="bubble user">Brief me on today.</div>
      <div className="bubble bot rich">
        <h4>Tuesday · May 20 · Your categories</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {['Innovation', 'Technology', 'Wellness', 'Self-care', 'Markets', 'World'].map((c) =>
          <span key={c} style={{
            fontSize: 11, padding: '4px 9px', borderRadius: 999,
            background: 'rgba(96,165,250,0.12)', color: 'var(--blue-bright)',
            border: '1px solid rgba(96,165,250,0.25)', letterSpacing: '0.02em'
          }}>{c}</span>
          )}
        </div>
        <div className="brief-card">
          <div className="brief-item"><span className="bi-tag">Innovation</span><span className="bi-text">First commercial solid-state battery ships in Japan — 2x range, half the charge time.</span></div>
          <div className="brief-item"><span className="bi-tag">Wellness</span><span className="bi-text">New Stanford study: 7-min morning light exposure beats caffeine for afternoon focus.</span></div>
          <div className="brief-item"><span className="bi-tag">Self-care</span><span className="bi-text">Your sleep score dipped 12% this week — try winding down 30 min earlier tonight.</span></div>
          <div className="brief-item"><span className="bi-tag">Markets</span><span className="bi-text">SET opens +0.6%. NVDA on your watchlist up 2.1% pre-market.</span></div>
        </div>
      </div>
      <div className="bubble user">Swap &quot;Markets&quot; for &quot;Design&quot; tomorrow.</div>
      <div className="bubble bot">Done. Tomorrow’s 7 AM brief: Innovation · Technology · Wellness · Self-care · Design · World.</div>
    </React.Fragment>);

  if (id === 'tasks') return (
    <React.Fragment>
      <div className="bubble user">Remind me to review the Q3 deck before tomorrow’s board.</div>
      <div className="bubble bot rich">
        <h4>Today · 4 tasks</h4>
        <div className="task-list">
          <div className="task-row done"><div className="check"><Ico.check /></div><div className="task-text">Meeting follow-up — Helix Labs</div><div className="task-time">9:15</div></div>
          <div className="task-row done"><div className="check"><Ico.check /></div><div className="task-text">Send commercial to legal</div><div className="task-time">11:00</div></div>
          <div className="task-row"><div className="check"></div><div className="task-text">Review Q3 deck</div><div className="task-time">3:00 pm</div></div>
          <div className="task-row"><div className="check"></div><div className="task-text">Call Khun Anan back</div><div className="task-time">5:30</div></div>
        </div>
      </div>
      <div className="bubble bot">I’ll nudge you at 2:30pm — that gives 30 min before board prep.</div>
    </React.Fragment>);

  if (id === 'stocks') return (
    <React.Fragment>
      <div className="bubble user">How is NVDA doing? Should I be worried about the pullback?</div>
      <div className="bubble bot rich">
        <div className="stock-card">
          <div className="stock-sym">NVDA</div>
          <div className="stock-price">$1,184.20</div>
          <div className="stock-name">NVIDIA Corp · NASDAQ</div>
          <div className="stock-chg up">+2.14%  ▲ 24.80</div>
          <div className="stock-spark">
            <svg viewBox="0 0 200 40" width="100%" height="100%" preserveAspectRatio="none">
              <defs>
                <linearGradient id="sp" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 28 L20 24 L40 26 L60 18 L80 20 L100 14 L120 16 L140 8 L160 12 L180 6 L200 4 L200 40 L0 40 Z" fill="url(#sp)" />
              <path d="M0 28 L20 24 L40 26 L60 18 L80 20 L100 14 L120 16 L140 8 L160 12 L180 6 L200 4" stroke="#10b981" strokeWidth="1.5" fill="none" />
            </svg>
          </div>
        </div>
      </div>
      <div className="bubble bot">Short answer: no. The pullback last week was profit-taking, not thesis-breaking. Computex keynote tonight is the next catalyst — I’ll ping you if guidance shifts.</div>
    </React.Fragment>);

  if (id === 'inbox') return (
    <React.Fragment>
      <div className="bubble user">Summarise my inbox.</div>
      <div className="bubble bot rich">
        <h4>23 new · 3 need you</h4>
        <div className="brief-card">
          <div className="brief-item"><span className="bi-tag" style={{ background: 'rgba(239,68,68,0.18)', color: '#fca5a5' }}>Urgent</span><span className="bi-text">David @ Atlas — wants term sheet signed by Friday.</span></div>
          <div className="brief-item"><span className="bi-tag">Meeting</span><span className="bi-text">Pim suggesting Thu 2pm or Fri 10am for kickoff.</span></div>
          <div className="brief-item"><span className="bi-tag">FYI</span><span className="bi-text">Legal cleared the MSA. No action needed.</span></div>
        </div>
      </div>
      <div className="bubble user">Draft a reply to David — push to next Tuesday.</div>
      <div className="bubble bot">Drafted. Tone matches your last three emails to him. Want to review or send as-is?</div>
    </React.Fragment>);

  if (id === 'research') return (
    <React.Fragment>
      <div className="bubble user">Quick brief on the EU AI Act and how it affects Thai SaaS exporters.</div>
      <div className="bubble bot rich">
        <h4>EU AI Act · Briefing</h4>
        <div className="brief-card">
          <div className="brief-item"><span className="bi-tag">Scope</span><span className="bi-text">Risk-tiered framework; Thai vendors selling into EU must comply if “placing on market”.</span></div>
          <div className="brief-item"><span className="bi-tag">Timing</span><span className="bi-text">High-risk obligations active Aug 2026. Most general-purpose AI provisions live now.</span></div>
          <div className="brief-item"><span className="bi-tag">Action</span><span className="bi-text">3 immediate steps for your stack — see attached PDF.</span></div>
        </div>
      </div>
      <div className="bubble bot">Pulled from 14 sources · all cited. Want me to expand on the technical documentation requirements?</div>
    </React.Fragment>);

  if (id === 'cal') return (
    <React.Fragment>
      <div className="bubble user">Find 45 min with Sarah next week — afternoons Bangkok time.</div>
      <div className="bubble bot rich">
        <h4>3 slots that work for both</h4>
        <div className="brief-card">
          <div className="brief-item"><span className="bi-tag">Wed</span><span className="bi-text">22 May · 2:00 – 2:45 PM ICT (3:00 AM Sarah’s tz)</span></div>
          <div className="brief-item"><span className="bi-tag">Thu</span><span className="bi-text">23 May · 4:00 – 4:45 PM ICT — Sarah’s preferred window</span></div>
          <div className="brief-item"><span className="bi-tag">Fri</span><span className="bi-text">24 May · 3:30 – 4:15 PM ICT</span></div>
        </div>
      </div>
      <div className="bubble user">Book Thursday and send a pre-read.</div>
      <div className="bubble bot">Booked. I’ll generate a one-pager from your last call notes and share 24h prior.</div>
    </React.Fragment>);

  if (id === 'memory') return (
    <React.Fragment>
      <div className="bubble user">Remember that I prefer espresso, and my wife Pim’s birthday is March 14.</div>
      <div className="bubble bot">Saved. I’ll bring it up when it matters — want me to remind you a week before Pim’s birthday?</div>
      <div className="bubble user">Yes. Also — what do you remember about me?</div>
      <div className="bubble bot rich">
        <h4>What I know about you</h4>
        <div className="brief-card">
          <div className="brief-item"><span className="bi-tag">Coffee</span><span className="bi-text">Prefers espresso. No sugar.</span></div>
          <div className="brief-item"><span className="bi-tag">Family</span><span className="bi-text">Wife: Pim · Birthday Mar 14</span></div>
          <div className="brief-item"><span className="bi-tag">Work</span><span className="bi-text">CEO, Saraburi Group · Based in Bangkok</span></div>
          <div className="brief-item"><span className="bi-tag">Habit</span><span className="bi-text">Walks every morning before briefing.</span></div>
        </div>
      </div>
      <div className="bubble bot">Tap any memory to edit or forget it.</div>
    </React.Fragment>);

  if (id === 'reminders') return (
    <React.Fragment>
      <div className="bubble user">Remind me every weekday at 8 AM to take my vitamins.</div>
      <div className="bubble bot">Set. Recurring weekdays · 8:00 AM. I’ll skip public holidays — sound right?</div>
      <div className="bubble user">List my pending reminders.</div>
      <div className="bubble bot rich">
        <h4>5 pending</h4>
        <div className="brief-card">
          <div className="brief-item"><span className="bi-tag">Daily</span><span className="bi-text">8:00 AM · Take vitamins</span></div>
          <div className="brief-item"><span className="bi-tag">Today</span><span className="bi-text">2:30 PM · Review Q3 deck before board</span></div>
          <div className="brief-item"><span className="bi-tag">Fri</span><span className="bi-text">10:00 AM · Sign term sheet with Atlas</span></div>
          <div className="brief-item"><span className="bi-tag">Weekly</span><span className="bi-text">Sun 6:00 PM · Plan the week</span></div>
        </div>
      </div>
    </React.Fragment>);

  if (id === 'drive') return (
    <React.Fragment>
      <div className="bubble user">Find the latest Q3 forecast in my Drive.</div>
      <div className="bubble bot rich">
        <h4>3 matches</h4>
        <div className="brief-card">
          <div className="brief-item"><span className="bi-tag">PDF</span><span className="bi-text">Q3 Forecast — v4 final.pdf · edited yesterday</span></div>
          <div className="brief-item"><span className="bi-tag">Sheet</span><span className="bi-text">FY26 Model · Q3 tab · edited 3d ago</span></div>
          <div className="brief-item"><span className="bi-tag">Doc</span><span className="bi-text">Board memo — Q3 narrative · last week</span></div>
        </div>
      </div>
      <div className="bubble user">Summarise the PDF in 5 bullets.</div>
      <div className="bubble bot">Done. Top line: revenue tracking +12% vs plan, gross margin compressed 80bps on input costs, ASEAN sales up 24% YoY… (2 more)</div>
    </React.Fragment>);

  if (id === 'media') return (
    <React.Fragment>
      <div className="bubble user">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: 'linear-gradient(135deg,#fbbf24,#d97706)', display: 'grid', placeItems: 'center', color: '#1a1207' }}><Ico.image /></div>
          <span>receipt_lunch.jpg</span>
        </div>
      </div>
      <div className="bubble bot rich">
        <h4>Receipt extracted</h4>
        <div className="brief-card">
          <div className="brief-item"><span className="bi-tag">Vendor</span><span className="bi-text">Issaya Siamese Club · Sathorn</span></div>
          <div className="brief-item"><span className="bi-tag">Total</span><span className="bi-text">฿ 3,840 incl. 7% VAT · paid by AmEx</span></div>
          <div className="brief-item"><span className="bi-tag">Date</span><span className="bi-text">19 May 2026 · 13:42</span></div>
        </div>
      </div>
      <div className="bubble user">File it under May client expenses and attach to my note to Finance.</div>
      <div className="bubble bot">Done. Saved to Drive › Expenses/May, and attached to your draft email to Finance.</div>
    </React.Fragment>);

  if (id === 'settings') return (
    <React.Fragment>
      <div className="bubble user">What did you do for me yesterday?</div>
      <div className="bubble bot rich">
        <h4>Actions on 19 May</h4>
        <div className="brief-card">
          <div className="brief-item"><span className="bi-tag">Email</span><span className="bi-text">Sent 4 drafts you approved. Scheduled 1 for tomorrow 9 AM.</span></div>
          <div className="brief-item"><span className="bi-tag">Calendar</span><span className="bi-text">Booked 2 meetings, rescheduled 1, declined 1 conflict.</span></div>
          <div className="brief-item"><span className="bi-tag">Drive</span><span className="bi-text">Saved 3 attachments. Read 1 PDF for summary.</span></div>
          <div className="brief-item"><span className="bi-tag">Reminders</span><span className="bi-text">Fired 5, snoozed 1, completed 4.</span></div>
        </div>
      </div>
      <div className="bubble user">Switch my briefing language to Thai.</div>
      <div className="bubble bot">เปลี่ยนแล้ว — พรุ่งนี้สรุปข่าวจะส่งเป็นภาษาไทย. You can switch back anytime.</div>
    </React.Fragment>);

  return null;
};

/* ---------- Streaming chat animation ---------- */
const CHAT_SCRIPTS = {
  briefing: [
  { r: 'u', t: 'Brief me on today.' },
  { r: 'b', t: 'Tuesday · May 20 · Your categories', rich: 'briefing' },
  { r: 'u', t: 'Swap "Markets" for "Design" tomorrow.' },
  { r: 'b', t: "Done. Tomorrow's 7 AM brief: Innovation · Technology · Wellness · Self-care · Design · World." }],

  tasks: [
  { r: 'u', t: 'Remind me to review the Q3 deck before tomorrow\'s board.' },
  { r: 'b', t: 'Today · 4 tasks', rich: 'tasks' },
  { r: 'b', t: "I'll nudge you at 2:30pm — that gives 30 min before board prep." }],

  stocks: [
  { r: 'u', t: 'How is NVDA doing? Should I be worried about the pullback?' },
  { r: 'b', t: 'NVDA · $1,184.20 · +2.14% ▲ 24.80', rich: 'stocks' },
  { r: 'b', t: "Short answer: no. The pullback was profit-taking, not thesis-breaking. Computex keynote tonight is the next catalyst — I'll ping you if guidance shifts." }],

  inbox: [
  { r: 'u', t: 'Summarise my inbox.' },
  { r: 'b', t: '23 new · 3 need you', rich: 'inbox' },
  { r: 'u', t: 'Draft a reply to David — push to next Tuesday.' },
  { r: 'b', t: 'Drafted. Tone matches your last three emails to him. Want to review or send as-is?' }],

  research: [
  { r: 'u', t: 'Quick brief on the EU AI Act and how it affects Thai SaaS exporters.' },
  { r: 'b', t: 'EU AI Act · Briefing', rich: 'research' },
  { r: 'b', t: 'Pulled from 14 sources · all cited. Want me to expand on the technical documentation requirements?' }],

  cal: [
  { r: 'u', t: 'Find 45 min with Sarah next week — afternoons Bangkok time.' },
  { r: 'b', t: '3 slots that work for both', rich: 'cal' },
  { r: 'u', t: 'Book Thursday and send a pre-read.' },
  { r: 'b', t: "Booked. I'll generate a one-pager from your last call notes and share 24h prior." }],

  media: [
  { r: 'u', t: '📷  receipt_lunch.jpg' },
  { r: 'b', t: 'Receipt extracted', rich: 'media' },
  { r: 'u', t: 'File it under May client expenses and attach to Finance.' },
  { r: 'b', t: 'Done. Saved to Drive › Expenses/May, and attached to your draft email to Finance.' }]

};

const InlineRich = ({ type }: { type: string }) => {
  const card = (items: [string, string][]) =>
  <div className="brief-card" style={{ marginTop: 8 }}>
      {items.map(([tag, text], i) =>
    <div key={i} className="brief-item">
          <span className="bi-tag">{tag}</span>
          <span className="bi-text">{text}</span>
        </div>
    )}
    </div>;

  if (type === 'briefing') return card([
  ['Innovation', 'First commercial solid-state battery ships in Japan.'],
  ['Wellness', '7-min morning light beats caffeine for afternoon focus.'],
  ['Markets', 'SET opens +0.6%. NVDA up 2.1% pre-market.']]
  );
  if (type === 'tasks') return (
    <div className="task-list" style={{ marginTop: 8 }}>
      <div className="task-row done"><div className="check"><Ico.check /></div><div className="task-text">Meeting follow-up — Helix Labs</div><div className="task-time">9:15</div></div>
      <div className="task-row done"><div className="check"><Ico.check /></div><div className="task-text">Send commercial to legal</div><div className="task-time">11:00</div></div>
      <div className="task-row"><div className="check"></div><div className="task-text">Review Q3 deck</div><div className="task-time">3:00 pm</div></div>
    </div>);

  if (type === 'stocks') return (
    <div className="stock-card" style={{ marginTop: 8 }}>
      <div className="stock-sym">NVDA</div>
      <div className="stock-price">$1,184.20</div>
      <div className="stock-chg up">+2.14%  ▲ 24.80</div>
    </div>);

  if (type === 'inbox') return card([
  ['Urgent', 'David @ Atlas — wants term sheet signed by Friday.'],
  ['Meeting', 'Pim suggesting Thu 2pm or Fri 10am.'],
  ['FYI', 'Legal cleared the MSA. No action needed.']]
  );
  if (type === 'research') return card([
  ['Scope', 'Thai vendors must comply if "placing on market" in EU.'],
  ['Timing', 'High-risk obligations active Aug 2026.'],
  ['Action', '3 immediate steps for your stack — see attached PDF.']]
  );
  if (type === 'cal') return card([
  ['Wed', '22 May · 2:00 – 2:45 PM ICT'],
  ['Thu', '23 May · 4:00 – 4:45 PM ICT — Sarah\'s preferred'],
  ['Fri', '24 May · 3:30 – 4:15 PM ICT']]
  );
  if (type === 'media') return card([
  ['Vendor', 'Issaya Siamese Club · Sathorn'],
  ['Total', '฿ 3,840 incl. 7% VAT · AmEx'],
  ['Date', '19 May 2026 · 13:42']]
  );
  return null;
};

type DisplayMsg = {
  r: 'u' | 'b';
  text: string;
  typing?: boolean;
  done?: boolean;
  rich?: string | null;
};

const StreamingChat = ({ id }: { id: string }) => {
  const [display, setDisplay] = useState<DisplayMsg[]>([]);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!bodyRef.current) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  });

  useEffect(() => {
    const script = CHAT_SCRIPTS[id as keyof typeof CHAT_SCRIPTS] || [];
    let cancelled = false;

    const after = (ms: number, fn: () => void) => setTimeout(() => { if (!cancelled) fn(); }, ms);

    const updateLast = (updater: (m: DisplayMsg) => DisplayMsg) =>
      setDisplay((prev) => {
        if (!prev.length) return prev;
        const copy = [...prev];
        copy[copy.length - 1] = updater(copy[copy.length - 1]!);
        return copy;
      });

    const restart = () => {
      after(3800, () => {
        setDisplay([]);
        after(500, () => run(0));
      });
    };

    const streamMsg = (msgIdx: number, charIdx: number) => {
      const msg = script[msgIdx];
      const full = msg.t;
      const next = full.slice(0, charIdx + 1);
      updateLast((m) => ({ ...m, text: next, typing: false }));

      if (charIdx + 1 < full.length) {
        const spd = charIdx % 4 === 0 ? 32 : 20;
        after(spd, () => streamMsg(msgIdx, charIdx + 1));
      } else {
        updateLast((m) => ({ ...m, done: true, rich: msg.rich || null }));
        const nextIdx = msgIdx + 1;
        if (nextIdx < script.length) {
          const gap = script[nextIdx].r === 'u' ? 1000 : 650;
          after(gap, () => run(nextIdx));
        } else {
          restart();
        }
      }
    };

    const run = (msgIdx: number) => {
      if (msgIdx >= script.length) { restart(); return; }
      const msg = script[msgIdx];
      if (msg.r === 'u') {
        setDisplay((prev) => [...prev, { r: 'u', text: msg.t, done: true }]);
        const nextIdx = msgIdx + 1;
        if (nextIdx < script.length && script[nextIdx].r === 'b') {
          after(480, () => {
            setDisplay((prev) => [...prev, { r: 'b', text: '', typing: true, done: false, rich: null }]);
            after(860, () => streamMsg(nextIdx, 0));
          });
        } else {
          after(600, () => run(nextIdx));
        }
      } else {
        setDisplay((prev) => [...prev, { r: 'b', text: '', typing: true, done: false, rich: null }]);
        after(750, () => streamMsg(msgIdx, 0));
      }
    };

    queueMicrotask(() => setDisplay([]));
    after(350, () => run(0));
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div ref={bodyRef} style={{ display: 'contents' }}>
      {display.map((msg, i) =>
      <div key={i} className={`bubble ${msg.r === 'u' ? 'user' : 'bot' + (msg.rich && msg.done ? ' rich' : '')}`}>
          {msg.typing ?
        <span className="typing-dots"><span></span><span></span><span></span></span> :

        <React.Fragment>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, letterSpacing: '-0.01em' }}>
                {msg.text}
                {!msg.done && <span className="tw-cursor">▍</span>}
              </span>
              {msg.done && msg.rich && <InlineRich type={msg.rich} />}
            </React.Fragment>
        }
        </div>
      )}
    </div>);

};

/* ---------- Feature explorer component ---------- */
const FeatureExplorer = () => {
  const [active, setActive] = useState(FEATURES[0].id);
  const cur = FEATURES.find((f) => f.id === active);
  if (!cur) return null;
  const placeholders = {
    briefing: 'Brief me on today...',
    memory: 'Remember that I...',
    tasks: 'Add a task to...',
    reminders: 'Remind me every weekday at 8 AM...',
    inbox: 'Summarise my inbox...',
    cal: 'Find time with Sarah...',
    drive: 'Find the Q3 forecast in my Drive...',
    media: 'Drop a photo, audio or PDF...',
    stocks: 'Analyse TSLA stock...',
    research: 'Research the EU AI Act...',
    settings: 'What did you do for me yesterday?'
  };
  return (
    <div className="explorer">
      <div className="feature-tabs">
        {FEATURES.map((f) =>
        <button key={f.id} className={`feature-tab ${active === f.id ? 'active' : ''}`} onClick={() => setActive(f.id)}>
            <div className="ft-icon">{f.icon}</div>
            <div>
              <span className="ft-label">{f.label}</span>
              <div className="ft-desc">{f.short}</div>
            </div>
          </button>
        )}
      </div>
      <div className="feature-display" key={active}>
        <div className="feature-info">
          <div className="ft-eyebrow">{cur.eyebrow}</div>
          <h3>{cur.title}</h3>
          <p>{cur.body}</p>
          <ul>{cur.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
        </div>
        <div className="chat-preview">
          <div className="chat-header">
            <div className="chat-avatar">L</div>
            <div>
              <div className="chat-name">LEKHA</div>
              <div className="chat-status"><span className="dot"></span> Online</div>
            </div>
          </div>
          <div className="chat-body">
            <StreamingChat id={active} key={active} />
          </div>
          <div className="chat-input">
            <Ico.spark style={{ color: 'var(--blue-bright)' }} />
            <input readOnly placeholder={placeholders[active as keyof typeof placeholders]} />
            <button><Ico.send /></button>
          </div>
          <div className="line-footnote">Chatting via LINE</div>
        </div>
      </div>
    </div>);

};

/* ---------- Capabilities grid ---------- */
const CAPABILITIES = [
{ icon: <Ico.news />, h: 'Customisable news brief', thai: 'ข่าวตามความสนใจ', p: 'Pick your categories — innovation, technology, wellness, self-care, markets, world. Re-mix anytime.' },
{ icon: <Ico.check />, h: 'Tasks & todos', thai: 'งานและสิ่งที่ต้องทำ', p: 'Capture, prioritise and follow through. Recurring, snoozeable, accountable.' },
{ icon: <Ico.bell />, h: 'Smart reminders', thai: 'เตือนความจำ', p: 'Time, location and event-based nudges — never another missed birthday or board call.' },
{ icon: <Ico.chart />, h: 'Stock & market analysis', thai: 'วิเคราะห์หุ้น', p: 'Live quotes, fundamentals and sentiment for any ticker — explained simply.' },
{ icon: <Ico.cal />, h: 'Calendar & scheduling', thai: 'จัดตารางนัด', p: 'Cross-timezone booking, deep-work protection, automatic meeting briefs.' },
{ icon: <Ico.mail />, h: 'Email · send & receive', thai: 'รับส่งอีเมลแทนคุณ', p: 'Receives, triages and replies on your behalf — or writes & sends new emails on command.' },
{ icon: <Ico.image />, h: 'Image analysis', thai: 'วิเคราะห์รูปภาพ', p: 'Drop a photo — receipts, whiteboards, screenshots, menus. She reads, extracts and files.' },
{ icon: <Ico.search />, h: 'Deep research', thai: 'ค้นคว้าเชิงลึก', p: 'Multi-source synthesis with citations. From competitor scan to policy brief.' },
{ icon: <Ico.doc />, h: 'Document drafting', thai: 'ร่างเอกสาร', p: 'Memos, emails, proposals, board updates — drafted in seconds, polished in minutes.' },
{ icon: <Ico.tune />, h: 'Customisable to you', thai: 'ปรับได้ตามต้องการ', p: 'Pick the categories, channels, briefing times and tone that fit your life. Change anything, anytime.' },
{ icon: <Ico.lang />, h: 'Bilingual fluency', thai: 'สองภาษา', p: 'Switch between English and ภาษาไทย mid-conversation. Translation and culture-aware.' }];


/* ---------- How it works ---------- */
const STEPS = [
{ n: '01', h: 'Connect your tools', p: 'Plug in Line and your Google account. Takes 90 seconds.' },
{ n: '02', h: 'Tell her your context', p: 'A short onboarding chat: your role, your watchlist, your priorities, your day-to-day routine.' },
{ n: '03', h: 'Let her run the day', p: 'LEKHA keeps you updated with two daily briefings at 7 AM and 9 PM. Chat with LEKHA to stay on top of your tasks, receive timely reminders, and get the information you need—when you need it.' }];


/* ---------- Use cases ---------- */
const USES = [
{ tag: 'For founders', h: 'Your one-person chief of staff.', p: 'Brief on competitors before every call. Draft investor updates. Never drop a follow-up again.', img: '/assets/use-founders.png' },
{ tag: 'For executives', h: 'Reclaim the first hour of every day.', p: 'Wake up to a briefing tuned to your portfolio, your team and your blockers.', img: '/assets/use-executives.png' },
{ tag: 'For analysts', h: 'Markets, news and research in one chat.', p: 'Live data, sentiment and instant deep-dives — show your working with cited sources.', img: '/assets/use-analysts.png' },
{ tag: 'For busy people', h: 'A todo list that finally sticks.', p: 'Plain-language input, smart prioritisation, polite but persistent nudges.', img: '/assets/use-busy.png' }];


/* ---------- Pricing ---------- */
const BASE_PRICING = [
{
  name: 'Monthly', label: 'MONTHLY', price: 599, period: '/month', desc: 'Pay as you go. Cancel any time.',
  features: [
  { ok: true, t: 'Personalised briefing and much more' },
  { ok: true, t: 'Unlimited tasks & smart reminders' },
  { ok: true, t: 'Live stock & market analysis' },
  { ok: true, t: 'Inbox triage & drafted replies' },
  { ok: true, t: 'Deep research with citations' }],

  cta: 'Start 7-day trial', primary: false
},
{
  name: 'Yearly', label: 'YEARLY', price: 5990, period: '/year', desc: 'Two months free. Best for daily users.', featured: true,
  tag: 'SAVE 17%',
  features: [
  { ok: true, t: 'Everything in Monthly' },
  { ok: true, t: 'Equivalent to ฿499/month — 2 months free' },
  { ok: true, t: 'Priority response · under 3s average' },
  { ok: true, t: 'Early access to new capabilities' },
  { ok: true, t: 'Dedicated onboarding session' }],

  cta: 'Start 7-day trial', primary: true
}];


/* ---------- FAQ ---------- */
const FAQS = [
{ q: 'Does LEKHA speak Thai?', a: 'Yes — fully bilingual in English and ภาษาไทย. You can switch languages mid-conversation, and briefings can be delivered in either.' },
{ q: 'What tools does LEKHA connect to?', a: 'LEKHA talks to you through LINE but by connecting to your Google account, it can work and draft emails for you. Setup takes approximately 90 seconds.' },
{ q: 'Where does my data live?', a: 'Your data is encrypted at rest and in transit. We never train on your messages, and you can export or delete everything with one click.' },
{ q: 'Can I use LEKHA on mobile?', a: 'Yes — iOS, Android, web, and Line. Your context follows you across every surface.' },
{ q: 'How is this different from ChatGPT?', a: 'LEKHA is a stateful executive assistant, not a chatbot. She remembers you, runs background jobs (briefing, reminders, monitoring), and connects to your real tools. Think of her as a personal executive secretary with AI engraved in her system.' }];


const FAQ = () => {
  const [open, setOpen] = useState(0);
  return (
    <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {FAQS.map((f, i) =>
      <div key={i} style={{
        background: 'linear-gradient(180deg, rgba(10,26,62,0.55), rgba(7,17,44,0.35))',
        border: '1px solid var(--line)',
        borderRadius: 14, padding: '20px 24px', cursor: 'pointer'
      }} onClick={() => setOpen(open === i ? -1 : i)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: 17 }}>{f.q}</span>
            <span style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(96,165,250,0.1)', display: 'grid', placeItems: 'center',
            transition: 'transform 0.2s', transform: open === i ? 'rotate(45deg)' : 'none',
            color: 'var(--blue-bright)', flexShrink: 0
          }}>+</span>
          </div>
          {open === i &&
        <div style={{ marginTop: 12, color: 'var(--ink-dim)', fontSize: 15, lineHeight: 1.6 }}>{f.a}</div>
        }
        </div>
      )}
    </div>);

};

/* ---------- Metrics strip ---------- */
const METRICS = [
{ suffix: 's', end: 5, prefix: '<', label: 'Response\nTime' },
{ suffix: '×', end: 2, label: 'Daily\nBriefings' },
{ suffix: '/7', end: 24, label: 'Task\nMonitoring' },
{ suffix: '+', end: 12, label: 'Tools\nConnected' },
{ suffix: ' langs', end: 2, label: 'EN / ไทย\nBilingual' }];


const MetricsStrip = () => {
  const refs = useRef([]);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const idx = parseInt((el as HTMLElement).dataset.idx, 10);
        const m = METRICS[idx];
        // @ts-expect-error window.countUp is injected via external script tag.
        // @ts-expect-error window.countUp injected via script tag.
        if (window.countUp) {
          const cu = new window.countUp.CountUp(el, m.end, {
            duration: 2.2,
            prefix: m.prefix || '',
            suffix: m.suffix || '',
            useEasing: true
          });
          if (!cu.error) cu.start();
        } else {
          el.textContent = (m.prefix || '') + m.end + (m.suffix || '');
        }
        observer.unobserve(el);
      });
    }, { threshold: 0.5 });
    refs.current.forEach((el) => {if (el) observer.observe(el);});
    return () => observer.disconnect();
  }, []);

  return (
    <div className="metrics-strip">
      <div className="container">
        <div className="metrics-grid">
          {METRICS.map((m, i) =>
          <div key={i} className="metric-item reveal">
              <div className="metric-value" ref={(el: HTMLDivElement | null) => { refs.current[i] = el; }} data-idx={i}>
                {(m.prefix || '') + m.end + (m.suffix || '')}
              </div>
              <div className="metric-label" style={{ whiteSpace: 'pre-line' }}>{m.label}</div>
            </div>
          )}
        </div>
      </div>
    </div>);

};

/* ---------- Built-for section ---------- */
const BUILTFOR = [
{ tag: 'C-Suite Executives', wide: true, h: 'Run the day before it runs you.', p: 'Morning intelligence briefings, calendar protection, email triage, and task follow-through — all before 8 AM. LEKHA is the first member of your operations team.' },
{ tag: 'Doctors & Clinicians', h: 'Clinical focus. Zero admin drift.', p: 'Reminders, research summaries, and scheduling — so your attention stays on patients, not paperwork.' },
{ tag: 'Founders & CEOs', h: 'Move at founder speed.', p: 'Draft investor updates, monitor markets, triage inboxes, and brief yourself on competitors — all in one chat.' },
{ tag: 'Finance Professionals', h: 'Markets never sleep. Neither does LEKHA.', p: 'Live stock data, news sentiment, watchlist alerts, and research synthesis on demand.' },
{ tag: 'Investors', h: 'Intelligence before every call.', p: 'Company backgrounds, market context, and portfolio news — synthesised in 60 seconds.' }];


const BuiltForSection = () =>
<section className="section" id="builtfor" style={{ paddingTop: 0 }}>
    <div className="container">
      <div className="section-head reveal">
        <span className="mono-eyebrow">Built for</span>
        <h2 className="serif-h2">High-performance people<br /><em className="serif-italic" style={{ color: 'var(--ink-dim)' }}>who can&apos;t afford to miss a beat.</em></h2>
      </div>
      <div className="builtfor-grid">
        {BUILTFOR.map((b, i) =>
      <div key={i} className={`builtfor-card reveal ${b.wide ? 'builtfor-card-wide' : ''}`}>
            <div className="builtfor-tag">{b.tag}</div>
            <h3>{b.h}</h3>
            <p>{b.p}</p>
            <div className="builtfor-accent"></div>
          </div>
      )}
      </div>
    </div>
  </section>;


/* ---------- Live Operations Layer — Command Center ---------- */
const TICKERS = [
{ sym: 'NVDA', price: '1,184.20', chg: '+2.14%', up: true },
{ sym: 'AAPL', price: '189.45', chg: '-0.32%', up: false },
{ sym: 'TSLA', price: '178.20', chg: '+1.85%', up: true },
{ sym: 'MSFT', price: '422.80', chg: '+0.55%', up: true },
{ sym: 'GOOG', price: '174.30', chg: '-0.18%', up: false },
{ sym: 'META', price: '510.60', chg: '+0.92%', up: true },
{ sym: 'AMZN', price: '190.15', chg: '+1.23%', up: true },
{ sym: 'SET', price: '1,342', chg: '+0.62%', up: true },
{ sym: 'BTC', price: '68,420', chg: '+3.45%', up: true },
{ sym: 'ETH', price: '3,820', chg: '+2.10%', up: true },
{ sym: 'JPY', price: '157.32', chg: '-0.14%', up: false },
{ sym: 'GOLD', price: '2,341', chg: '+0.28%', up: true }];


const CMD_EVENTS = [
{ time: '09:00', title: 'Board Prep', tag: 'Internal', past: true },
{ time: '10:00', title: 'Helix Labs Call', tag: 'External', now: true },
{ time: '13:00', title: 'Lunch — David', tag: 'Client' },
{ time: '14:30', title: 'Q3 Review', tag: 'Internal' },
{ time: '16:00', title: 'Deep Work Block', tag: 'Protected' }];


const CMD_TASKS = [
{ done: true, text: 'Send term sheet to David' },
{ done: true, text: 'Review legal MSA' },
{ done: false, text: 'Q3 board deck review' },
{ done: false, text: 'Call Khun Anan · before 5pm' },
{ done: false, text: 'Market brief — SET opening' }];


const CMD_OPS = ['Email · 23 unread', 'Docs · Q3 deck updated', 'Reminders · 5 pending'];

const GlobeSection = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // @ts-expect-error window.THREE is injected via external script tag.
    // @ts-expect-error window.THREE injected via script tag.
    if (!window.THREE || !canvasRef.current) return;
    const THREE = window.THREE;
    const canvas = canvasRef.current;
    const W = canvas.clientWidth || 300;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, W);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 2.8);
    // Sphere body
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(1, 48, 48),
      new THREE.MeshPhongMaterial({ color: 0x0a1a3e, transparent: true, opacity: 0.9, emissive: 0x0d2d6b, emissiveIntensity: 0.4 })
    ));
    // Wireframe
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.002, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0x1e3a6e, wireframe: true, transparent: true, opacity: 0.22 })
    ));
    // Blue equator ring
    scene.add(new THREE.Mesh(
      new THREE.TorusGeometry(1.18, 0.004, 2, 120),
      new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.5 })
    ));
    // Gold tilted ring
    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(1.22, 0.002, 2, 120),
      new THREE.MeshBasicMaterial({ color: 0xf5b942, transparent: true, opacity: 0.25 })
    );
    ring2.rotation.x = Math.PI / 3;
    scene.add(ring2);
    // Orbit dots
    const dotGeo = new THREE.SphereGeometry(0.022, 8, 8);
    const dots: { userData: { angle: number; speed: number; tilt: number }; position: { x: number; y: number; z: number } }[] = [];
    for (let i = 0; i < 24; i++) {
      const d = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({
        color: i % 4 === 0 ? 0xf5b942 : 0x60a5fa
      }));
      const tilt = i % 2 === 0 ? 0 : Math.PI / 3;
      d.userData = { angle: i / 24 * Math.PI * 2, speed: 0.004 + Math.random() * 0.004, tilt };
      scene.add(d);
      dots.push(d);
    }
    scene.add(new THREE.AmbientLight(0x1e3a6e, 1.4));
    const pt = new THREE.PointLight(0x3b82f6, 2.5, 10);pt.position.set(3, 2, 3);scene.add(pt);
    const pt2 = new THREE.PointLight(0xf5b942, 0.6, 10);pt2.position.set(-3, -1, -2);scene.add(pt2);
    let frame: number;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      scene.rotation.y += 0.003;
      dots.forEach((d) => {
        d.userData.angle += d.userData.speed;
        const r = d.userData.tilt === 0 ? 1.18 : 1.22;
        d.position.x = Math.cos(d.userData.angle) * r;
        d.position.y = Math.sin(d.userData.tilt) * Math.sin(d.userData.angle) * 0.35;
        d.position.z = Math.sin(d.userData.angle) * r;
      });
      renderer.render(scene, camera);
    };
    animate();
    return () => {cancelAnimationFrame(frame);renderer.dispose();};
  }, []);

  return (
    <section className="ops-layer" id="operations">
      <div className="container">
        <div className="section-head reveal" style={{ marginBottom: 32 }}>
          <span className="mono-eyebrow">Live Operations Layer</span>
          <h2 className="serif-h2">Always on. <em className="serif-italic" style={{ color: 'var(--gold)' }}>Always watching.</em></h2>
          <p className="section-sub">A continuous intelligence loop across every stream that matters.</p>
        </div>

        <div className="cmd-panel reveal">
          {/* Ticker tape */}
          <div className="cmd-ticker-row">
            <span className="cmd-ticker-label">MARKETS</span>
            <div className="cmd-ticker-wrap">
              <div className="cmd-ticker-track">
                {[...TICKERS, ...TICKERS].map((t, i) =>
                <span key={i} className="cmd-tick">
                    <span className="cmd-tick-sym">{t.sym}</span>
                    <span className="cmd-tick-price">{t.price}</span>
                    <span className={`cmd-tick-chg ${t.up ? 'cup' : 'cdn'}`}>{t.chg}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Main 3-column grid */}
          <div className="cmd-main">
            {/* Calendar */}
            <div className="cmd-widget">
              <div className="cmd-widget-header">
                <Ico.cal /><span>Calendar</span>
                <span className="cmd-widget-meta">Mon 26 May</span>
              </div>
              <div className="cmd-events">
                {CMD_EVENTS.map((ev, i) =>
                <div key={i} className={`cmd-event${ev.past ? ' cpast' : ''}${ev.now ? ' cnow' : ''}`}>
                    <span className="cmd-event-time">{ev.time}</span>
                    <span className="cmd-event-bar"></span>
                    <div className="cmd-event-body">
                      <div className="cmd-event-title">{ev.title}</div>
                      <div className="cmd-event-tag">{ev.tag}</div>
                    </div>
                    {ev.now && <span className="cmd-now-pill">NOW</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Globe center */}
            <div className="cmd-globe-col">
              <canvas ref={canvasRef} className="cmd-globe-canvas"></canvas>
              <div className="cmd-globe-label">LEKHA Intelligence Network</div>
            </div>

            {/* Tasks */}
            <div className="cmd-widget cmd-widget-right">
              <div className="cmd-widget-header">
                <Ico.check /><span>Tasks</span>
                <span className="cmd-widget-meta">3 pending</span>
              </div>
              <div className="cmd-tasks-list">
                {CMD_TASKS.map((tk, i) =>
                <div key={i} className={`cmd-task${tk.done ? ' cdone' : ''}`}>
                    <span className="cmd-task-box">{tk.done && <Ico.check />}</span>
                    <span>{tk.text}</span>
                  </div>
                )}
              </div>
              <div className="cmd-ops-mini">
                {CMD_OPS.map((s, i) =>
                <div key={i} className="cmd-ops-row">
                    <span className="cmd-ops-dot"></span>
                    <span>{s}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>);

};

/* ---------- Scroll reveal ---------- */
const useReveal = () => {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {if (e.isIntersecting) {e.target.classList.add('in');io.unobserve(e.target);}});
    }, { threshold: 0.12 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
};

/* ---------- About ---------- */
const About = () =>
<section className="section" id="about" style={{ paddingTop: 0 }}>
    <div className="container">
      <div className="section-head reveal">
        <span className="section-eyebrow">About us</span>
        <h2>Built by people who’ve had <span className="gold-text">no margin for error.</span></h2>
      </div>
      <div className="reveal" style={{
      maxWidth: 820, margin: '0 auto',
      background: 'linear-gradient(180deg, rgba(10,26,62,0.55), rgba(7,17,44,0.35))',
      border: '1px solid var(--line)',
      borderRadius: 18, padding: '32px 36px',
      color: 'var(--ink-dim)', fontSize: 16, lineHeight: 1.75
    }}>
        <p style={{ margin: 0 }}>
          LEKHA is an AI executive assistant built to help normal to high-performance people run their day with less friction. Created by a team with backgrounds in <span style={{ color: 'var(--ink)' }}>aerospace and defense engineering, medicine, and business leadership</span>, we understand the pressure of fast decisions, packed schedules, and constant information flow.
        </p>
        <p style={{ margin: '16px 0 0' }}>
          LEKHA helps manage daily briefings, tasks, reminders, emails, calendar planning, research, document drafting, image analysis, and market insights — all in one chat.
        </p>
        <p style={{ margin: '16px 0 0', color: 'var(--ink)', fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 17 }}>
          Our mission is simple: give busy professionals a reliable AI Chief of Operations that keeps life organised, focused, and moving forward.
        </p>
      </div>
    </div>
  </section>;

/* ---------- Terms ---------- */
const TERMS = [
['1. About LEKHA',
'LEKHA is an AI automated chatbot designed to assist users with daily tasks, including daily briefings, tasks and reminders, calendar support, email drafting, document drafting, image analysis, stock and market analysis, research summaries, and general productivity support.\n\nLEKHA is intended to help users organize information, save time, and improve workflow efficiency. However, LEKHA does not replace human judgment, professional advice, or personal responsibility.'],
['2. User Responsibility',
'You are responsible for how you use LEKHA and for reviewing all outputs before relying on them. AI-generated responses may be inaccurate, incomplete, outdated, or unsuitable for your specific situation.\n\nYou agree to independently verify important information before making decisions, especially in areas involving finance, medicine, law, business, employment, safety, or personal matters.'],
['3. No Professional Advice',
'LEKHA may provide information related to finance, markets, health, business, productivity, or other topics. This information is provided for general informational purposes only.\n\nLEKHA does not provide financial, investment, legal, medical, tax, or other professional advice. You should consult a qualified professional before making decisions in these areas.\n\nStock analysis, market summaries, and investment-related content are not investment recommendations and should not be treated as a guarantee of performance, return, or outcome.'],
['4. Account and Access',
'Some features may require you to create an account, provide contact information, or connect third-party services such as email, calendar, cloud storage, messaging platforms, or payment systems.\n\nYou are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. You agree to notify us immediately if you suspect unauthorized access.'],
['5. Third-Party Integrations',
'LEKHA may connect with third-party services, including but not limited to email providers, calendar platforms, messaging applications, cloud storage providers, payment processors, and market data providers.\n\nYour use of third-party services is also subject to their own terms, privacy policies, and rules. We are not responsible for failures, interruptions, errors, data loss, or policy changes caused by third-party platforms.'],
['6. Email, Calendar, and Task Automation',
'LEKHA may help draft emails, summarize messages, create reminders, manage tasks, or assist with calendar scheduling. You remain responsible for reviewing, approving, sending, editing, deleting, or acting on any communication or scheduled item.\n\nWe are not responsible for missed reminders, incorrect schedules, delayed notifications, wrongly drafted messages, failed delivery, or actions taken based on AI-generated outputs.'],
['7. Image and Document Analysis',
'LEKHA may allow users to upload images, screenshots, receipts, documents, or other files for analysis, summarization, extraction, or organization.\n\nYou confirm that you have the right to upload and process any content you submit. You should not upload confidential, sensitive, illegal, or third-party content unless you have permission to do so.\n\nAI extraction from images or documents may contain errors. You are responsible for verifying all extracted information before using it.'],
['8. User Content',
'You retain ownership of content you submit to LEKHA, including messages, files, images, prompts, documents, and other materials.\n\nBy using LEKHA, you grant Assistantforyou permission to process your content as necessary to provide the service, improve functionality, troubleshoot issues, ensure security, and comply with legal obligations.\n\nYou agree not to submit content that is illegal, harmful, abusive, defamatory, infringing, misleading, or violates the rights of others.'],
['9. Acceptable Use',
'You agree not to use LEKHA to: break any law or regulation; violate another person’s privacy or intellectual property rights; generate spam, fraud, phishing, impersonation, or deceptive content; upload malware, harmful code, or unauthorized data; harass, threaten, abuse, or harm others; make automated decisions that may significantly affect another person without proper human review; or use LEKHA for high-risk activities where failure could cause injury, death, financial loss, or legal harm.\n\nWe reserve the right to suspend or terminate access if we believe you have violated these Terms.'],
['10. Payments and Subscriptions',
'Some LEKHA features may be free, while others may require payment or subscription. Prices, billing cycles, available features, and subscription plans may change over time.\n\nBy purchasing a paid plan, you agree to pay all applicable fees. Unless stated otherwise, subscription fees are billed in advance and may renew automatically.\n\nRefunds, cancellations, and billing disputes will be handled according to our published refund policy or applicable law.'],
['11. Service Availability',
'We aim to provide a reliable service, but we do not guarantee that LEKHA will always be available, uninterrupted, secure, or error-free.\n\nThe service may be temporarily unavailable due to maintenance, updates, technical issues, third-party failures, security events, or circumstances beyond our control.'],
['12. AI Limitations',
'LEKHA uses artificial intelligence and automated systems. AI outputs may be inaccurate, biased, incomplete, outdated, or unsuitable for your intended purpose.\n\nYou agree not to rely solely on LEKHA for critical decisions. Human review is required before using LEKHA outputs for professional, legal, financial, medical, business, or safety-related purposes.'],
['13. Intellectual Property',
'All rights, title, and interest in LEKHA, including the platform, software, design, branding, logo, interface, features, and related materials, belong to Assistantforyou or its licensors.\n\nYou may not copy, modify, reverse engineer, sell, rent, distribute, or create derivative works from LEKHA without our written permission.'],
['14. Privacy',
'Your privacy is important to us. Our collection, use, storage, and protection of personal data are described in our Privacy Policy.\n\nBy using LEKHA, you agree that we may process your data in accordance with our Privacy Policy.'],
['15. Security',
'We take reasonable measures to protect user data and platform security. However, no digital service can be guaranteed to be completely secure.\n\nYou agree not to bypass security systems, access unauthorized accounts, scrape data, overload the system, or interfere with normal platform operation.'],
['16. Termination',
'We may suspend or terminate your access to LEKHA at any time if you violate these Terms, misuse the service, create risk for other users, or if continued service becomes commercially, legally, or technically impractical.\n\nYou may stop using LEKHA at any time. Termination does not remove obligations that arose before termination, including payment obligations or restrictions on misuse of intellectual property.'],
['17. Disclaimer of Warranties',
'LEKHA is provided on an “as is” and “as available” basis. We do not guarantee that the service will meet your expectations, produce accurate outputs, be uninterrupted, or be free from errors.\n\nTo the maximum extent permitted by law, we disclaim all warranties, whether express or implied, including warranties of accuracy, reliability, fitness for a particular purpose, merchantability, and non-infringement.'],
['18. Limitation of Liability',
'To the maximum extent permitted by law, Assistantforyou shall not be liable for any indirect, incidental, consequential, special, punitive, or exemplary damages, including loss of profits, loss of data, missed opportunities, business interruption, financial loss, or reliance on AI-generated outputs.\n\nOur total liability for any claim related to the service shall not exceed the amount you paid to us in the six months before the claim arose.'],
['19. Indemnification',
'You agree to indemnify and hold harmless LEKHA, Assistantforyou, its founders, employees, partners, contractors, and affiliates from any claims, damages, losses, liabilities, costs, or expenses arising from your use of the service, violation of these Terms, misuse of AI outputs, or infringement of third-party rights.'],
['20. Changes to These Terms',
'We may update these Terms from time to time. When we make changes, we will update the “Last updated” date above.\n\nYour continued use of LEKHA after changes are posted means you accept the updated Terms.'],
['21. Governing Law',
'These Terms shall be governed by the laws of Thailand, without regard to conflict of law principles.\n\nAny disputes shall be resolved in the courts or appropriate dispute resolution forum located in Bangkok, Thailand, unless otherwise required by applicable law.'],
['22. Contact Us',
'For questions about these Terms, please contact us at:\n\nAssistantforyou\nEmail: assistantforyou999@gmail.com\nAddress: Bangkok, Thailand']];


const TermsSection = () => {
  const [open, setOpen] = useState(false);
  return (
    <section className="section" id="terms" style={{ paddingTop: 0 }}>
      <div className="container">
        <div className="section-head reveal">
          <span className="section-eyebrow">Legal</span>
          <h2>Terms and Conditions</h2>
          <p className="section-sub">Last updated: 20 May 2026 · By accessing or using LEKHA, you agree to these terms. If you do not agree, please do not use our service.</p>
        </div>
        <div className="reveal" style={{
          maxWidth: 900, margin: '0 auto',
          background: 'linear-gradient(180deg, rgba(10,26,62,0.45), rgba(7,17,44,0.3))',
          border: '1px solid var(--line)', borderRadius: 18,
          padding: '20px 24px'
        }}>
          <p style={{ margin: '0 0 16px', color: 'var(--ink-dim)', fontSize: 14, lineHeight: 1.65 }}>
            Welcome to LEKHA. These Terms and Conditions govern your access to and use of LEKHA, an AI-powered chatbot and executive assistant service operated by Assistantforyou (“LEKHA,” “we,” “us,” or “our”).
          </p>
          <div style={{
            maxHeight: open ? 'none' : 360, overflow: 'hidden', position: 'relative',
            transition: 'max-height 0.3s'
          }}>
            {TERMS.map(([h, body], i) =>
            <div key={i} style={{
              padding: '14px 0',
              borderTop: i === 0 ? 'none' : '1px solid var(--line)'
            }}>
                <h4 style={{
                margin: '0 0 8px', fontFamily: "'Sora', sans-serif",
                fontSize: 14, fontWeight: 700, color: 'var(--gold)',
                letterSpacing: '0.04em', textTransform: 'uppercase'
              }}>{h}</h4>
                <p style={{
                margin: 0, color: 'var(--ink-dim)', fontSize: 13.5, lineHeight: 1.65,
                whiteSpace: 'pre-line'
              }}>{body}</p>
              </div>
            )}
            {!open &&
            <div style={{
              position: 'absolute', inset: 'auto 0 0 0', height: 140,
              background: 'linear-gradient(180deg, transparent, rgba(7,17,44,0.95))',
              pointerEvents: 'none'
            }}></div>
            }
          </div>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button onClick={() => setOpen(!open)} className="btn btn-ghost" style={{ cursor: 'pointer' }}>
              {open ? 'Collapse terms' : 'Read full terms'}
            </button>
          </div>
        </div>
      </div>
    </section>);

};

/* ---------- App ---------- */
const PRICE_TABLE = {
  'Monthly': { THB: 599, USD: 19 },
  'Yearly': { THB: 5990, USD: 189 }
};
const CURRENCY_LABEL = { THB: '฿', USD: '$' };

const App = () => {
  useReveal();
  const [currency, setCurrency] = useState('THB');

  const pricing = BASE_PRICING.map((p) => ({ ...p, price: PRICE_TABLE[p.name as keyof typeof PRICE_TABLE][currency as keyof typeof CURRENCY_LABEL] }));

  return (
    <React.Fragment>
      <div className="aurora"></div>
      <div className="grid-bg"></div>
      <div className="noise"></div>

      <Nav />
      <Hero />

      <GlobeSection />

      <section className="section" id="features">
        <div className="container">
          <div className="section-head reveal">
            <span className="section-eyebrow">What LEKHA does</span>
            <h2>One chat. <span className="gold-text">Endless superpowers.</span></h2>
            <p className="section-sub">Pick a capability. Watch LEKHA work. Every reply below is a real interaction pattern from the product.</p>
          </div>
          <div className="reveal"><FeatureExplorer /></div>
        </div>
      </section>

      <section className="section" id="caps" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head reveal">
            <span className="section-eyebrow">Capabilities</span>
            <h2>Everything an assistant should do, but more.</h2>
          </div>
          <div className="cap-grid">
            {CAPABILITIES.map((c, i) =>
            <div key={i} className="cap reveal">
                <div className="cap-icon">{c.icon}</div>
                <h4>{c.h}</h4>
                <div className="cap-thai thai">{c.thai}</div>
                <p>{c.p}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="container">
          <div className="section-head reveal">
            <span className="section-eyebrow">How it works</span>
            <h2>Set up in <span className="gold-text">three minutes.</span></h2>
            <p className="section-sub">No prompt-crafting. No tutorials. Tell LEKHA what your day looks like... she takes it from there.</p>
          </div>
          <div className="steps">
            {STEPS.map((s, i) =>
            <div key={i} className="step reveal">
                <div className="step-num">{s.n}</div>
                <h4>{s.h}</h4>
                <p>{s.p}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="section" id="use" style={{ paddingTop: 0 }}>
        <div className="container" style={{ opacity: "1" }}>
          <div className="section-head reveal">
            <span className="section-eyebrow">Built for</span>
            <h2>However you run your day, <br />LEKHA adapts.</h2>
          </div>
          <div className="uses">
            {USES.map((u, i) =>
            <div key={i}
            className={`use-card reveal ${u.img ? 'image' : ''}`}
            style={{ ...(u.img ? { backgroundImage: `url(${u.img})`, gridRow: i === 0 ? 'span 1' : 'auto' } : {}), opacity: "1", backgroundPosition: "center top" }}>
              
                <div className="uc-content">
                  <div className="uc-tag">{u.tag}</div>
                  <h4>{u.h}</h4>
                  <p>{u.p}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="section" id="pricing">
        <div className="container">
          <div className="section-head reveal">
            <span className="section-eyebrow">Pricing</span>
            <h2>Simple, honest pricing.</h2>
            <p className="section-sub">Start free. Upgrade when LEKHA has saved you more time than the monthly fee — usually week one.</p>
          </div>
          <div className="price-grid two">
            {pricing.map((p, i) =>
            <div key={i} className={`price-card reveal ${p.featured ? 'featured' : ''}`}>
                {p.featured && p.tag && <div className="price-tag">{p.tag}</div>}
                <div className="price-name">{p.label}</div>
                <div className="price-amount">
                  <span className="currency">{CURRENCY_LABEL[currency]}</span>
                  <span className="number">{p.price.toLocaleString()}</span>
                  <span className="period">{p.period}</span>
                </div>
                <div className="price-desc">{p.desc}</div>
                <ul className="price-features">
                  {p.features.map((f, j) =>
                <li key={j} className={!f.ok ? 'disabled' : ''}>
                      <Ico.check /> {f.t}
                    </li>
                )}
                </ul>
                <Link href={`/signup?plan=${p.name.toLowerCase()}`} className={`btn ${p.primary ? 'btn-gold' : 'btn-ghost'}`}>{p.cta}</Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="section" id="faq" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head reveal">
            <span className="section-eyebrow">FAQ</span>
            <h2>Questions, answered.</h2>
          </div>
          <div className="reveal"><FAQ /></div>
        </div>
      </section>

      <About />

      <section className="container">
        <div className="cta-band reveal">
          <div>
            <span className="pill"><span className="spark"></span> Ready when you are</span>
            <h2 style={{ marginTop: 18 }}>Hand off your day to <span className="gold-text">LEKHA</span>.</h2>
            <p>Free for 7 days. Cancel anytime — she won’t take it personally.</p>
            <div className="cta-actions">
              <Link className="btn btn-gold" href="#start">Start now <Ico.bolt /></Link>
              <Link className="btn btn-ghost" href="#demo"><Ico.chat /> Book a 1-on-1 session with the team</Link>
            </div>
          </div>
          <div className="cta-side">
            <div className="cta-msg bot">Good morning. S&P500 opened green, you have 3 meetings today, and Pim is asking about the Q3 deck. Where do you want to start?</div>
            <div className="cta-msg user">Show me the deck and reschedule my 11am to 2pm.</div>
            <div className="cta-msg bot">On it — moving Andrew to Thursday 2pm. Deck opening now.</div>
          </div>
        </div>
      </section>

      <TermsSection />

      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div>
              <div className="brand" style={{ marginBottom: 16 }}>
                <div className="brand-mark"><LekhaMark /></div>
                <span>LEKHA</span>
              </div>
              <p style={{ color: 'var(--ink-dim)', fontSize: 14, margin: 0, maxWidth: 320 }}>&quot;I have been using Lekha and it has helped me organize my calendars and to-do list very well&quot; -  a Doctor 

              </p>
            </div>
            <div>
              <h5>Product</h5>
              <ul style={{ gap: "4px" }}>
                <li><Link href="#features">Features</Link></li>
                <li><Link href="#pricing">Pricing</Link></li>
                <li><Link href="#caps">Integrations</Link></li>
                <li><Link href="#faq">FAQ</Link></li>
              </ul>
            </div>
            <div>
              <h5>Company</h5>
              <ul style={{ gap: "4px" }}>
                <li><Link href="#about">About</Link></li>
                <li><a href="https://lin.ee/NuCuel7" target="_blank" rel="noopener">Contact</a></li>
                <li><Link href="#use">Use cases</Link></li>
                <li><Link href="#how">How it works</Link></li>
              </ul>
            </div>
            <div>
              <h5>Resources</h5>
              <ul style={{ gap: "4px" }}>
                <li><Link href="#terms">Terms</Link></li>
                <li><Link href="#terms"></Link></li>
                <li><a href="https://lin.ee/NuCuel7" target="_blank" rel="noopener">Help center</a></li>
                <li><Link href="#start"></Link></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 LEKHA · เลขา. All rights reserved.</span>
            <span>Made with care in Bangkok</span>
          </div>
        </div>
      </footer>

      <CurrencyToggle currency={currency} setCurrency={setCurrency} />
    </React.Fragment>);

};

/* ---------- Currency toggle (replaces dev-only TweaksPanel) ---------- */
const CurrencyToggle = ({ currency, setCurrency }: { currency: string; setCurrency: (c: string) => void }) => (
  <div className="currency-toggle" role="group" aria-label="Currency">
    {['THB', 'USD'].map((c) => (
      <button
        key={c}
        type="button"
        className={currency === c ? 'active' : ''}
        onClick={() => setCurrency(c)}
        aria-pressed={currency === c}
      >
        {c}
      </button>
    ))}
  </div>
);

export default App;