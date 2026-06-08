import type { Metadata } from "next";
import Link from "next/link";
import "../marketing.css";

export const metadata: Metadata = {
  title: "Privacy Policy — LEKHA",
  description:
    "How LEKHA collects, uses, stores, and protects your personal data.",
};

const LAST_UPDATED = "8 June 2026";

const SECTIONS = [
  {
    heading: "1. Introduction",
    body: `This Privacy Policy explains how Assistantforyou ("LEKHA," "we," "us," or "our") collects, uses, stores, shares, and protects your personal information when you use the LEKHA AI executive assistant service — including through the LINE messaging platform, our website, and any connected integrations.

By using LEKHA, you agree to the practices described in this Policy. If you do not agree, please stop using the service and contact us to have your data deleted.`,
  },
  {
    heading: "2. Information We Collect",
    body: `**Account & Identity**
When you connect to LEKHA through LINE, we receive your LINE user ID and display name. We do not collect your LINE password, phone number, or payment information stored in LINE.

**Messages & Conversation Content**
We store a rolling window of your recent conversation history (up to 20 messages) and periodic compressed summaries of older conversations to enable continuity across sessions. This includes text messages, file descriptions, and any information you share in the chat.

**Facts You Share**
LEKHA automatically extracts and stores structured personal facts you share (e.g. preferences, work context, key dates, health notes). You can view, edit, and delete these at any time.

**Google Account Data (if you connect)**
If you connect a Google account, we store encrypted OAuth access and refresh tokens to act on your behalf. Depending on the scopes you authorise, we may process: Gmail messages (to draft, send, read, or summarise emails), Google Calendar events (to create, update, or list events), Google Drive files (to search, read, or upload files), Google Contacts (to look up names and email addresses), and Google Docs/Slides content (to create or edit documents on your behalf).

We do not store copies of your email or calendar data beyond what is needed to complete a specific action you requested. We do not train AI models on your Google data.

**Tasks, Reminders & Lists**
We store tasks, reminders, shopping lists, and other structured to-do items you ask LEKHA to create or manage.

**Settings & Preferences**
We store your timezone, language preference, location (city level, if provided), notification preferences, and morning/evening briefing settings.

**Receipts & Financial Summaries**
If you use the receipt scanning feature, we store AI-extracted receipt data (merchant, amount, category, date). We do not store full scanned images beyond the processing request.

**Usage & Technical Data**
We log minimal technical metadata for security and rate-limiting purposes: request timestamps, error events, and a rolling count of requests per user (used solely to enforce rate limits). We do not log full message content in server logs.`,
  },
  {
    heading: "3. How We Use Your Information",
    body: `We use your information exclusively to provide and improve the LEKHA service:

• **Service delivery** — to respond to your messages, execute requested actions (send emails, create calendar events, set reminders), and maintain conversation continuity.
• **Personalisation** — to tailor responses using your stored facts, preferences, and history.
• **Proactive features** — to deliver morning briefings, evening summaries, pre-meeting alerts, and task reminders at the times you configure.
• **Security & abuse prevention** — to detect and block unauthorised access, enforce rate limits, and protect the platform.
• **Service improvement** — anonymised, aggregated patterns (not individual messages) may inform how we tune the AI assistant's capabilities.

We do not sell your data, use it for advertising, or share it with third parties except as described in Section 5.`,
  },
  {
    heading: "4. Data Storage & Retention",
    body: `**Where your data is stored**
Your data is stored in Upstash Redis (in-memory key-value store) and Upstash Vector (semantic memory index), both operated by Upstash, Inc. Upstash stores data in AWS data centres, primarily in the US East region. Vercel Functions process requests on infrastructure in multiple global regions.

**How long we keep it**
• Conversation history: rolling 20-message window; older turns are compressed into summaries (retained up to 90 days from last activity)
• Extracted facts: retained until you delete them or close your account
• Tasks, reminders, lists: retained until completed, cancelled, or you delete them
• Archive summaries: up to 200 compressed chunks per user; oldest are evicted as the limit is reached
• Receipts: up to 200 entries per user, retained up to 1 year
• Sent email log: last 200 entries, retained up to 6 months
• OAuth tokens: retained until you disconnect the Google account or revoke access via Google Account settings

You may request deletion of your data at any time — see Section 7.`,
  },
  {
    heading: "5. Third-Party Services",
    body: `LEKHA integrates with the following third-party services to provide its features. Each has its own privacy policy:

**LINE Corporation** — message delivery and user identity (line.me/en/terms/policy)
**Google LLC** — Gmail, Calendar, Drive, Contacts, Docs (policies.google.com/privacy). Access is granted only with your explicit consent and limited to the scopes you authorise.
**Upstash, Inc.** — Redis and Vector database hosting (upstash.com/privacy)
**Vercel, Inc.** — serverless compute and hosting (vercel.com/legal/privacy-policy)
**Google DeepMind (Gemini API)** — AI model powering responses (ai.google.dev/terms). Your messages are processed by Gemini but we are subject to Google's data processing agreement, which prohibits use of your data to train their models (paid tier).
**Tavily** — web search for research queries (tavily.com/privacy)
**Cloudflare** — DDoS protection and edge delivery (cloudflare.com/privacypolicy)

We do not share your personal data with any other third parties except when legally required (see Section 6).`,
  },
  {
    heading: "6. Legal Disclosures",
    body: `We may disclose your information if required to do so by law or in good-faith belief that such disclosure is necessary to:

• Comply with a legal obligation, court order, or valid governmental request
• Protect the rights, property, or safety of LEKHA, our users, or the public
• Investigate fraud, security incidents, or violations of our Terms of Service
• Respond to an emergency that poses a threat to the physical safety of any person

We will notify you of any such disclosure to the extent permitted by law.`,
  },
  {
    heading: "7. Your Rights & Controls",
    body: `Regardless of your location, you have the following rights over your personal data:

**Access** — Ask LEKHA "export my data" to receive a JSON file of all data we hold about you.
**Correction** — Tell LEKHA to update, correct, or edit any stored fact, task, or preference.
**Deletion** — Tell LEKHA to "clear my facts," "delete all my data," or contact us directly at assistantforyou999@gmail.com to request full account deletion. We will process deletion requests within 30 days.
**Disconnect Google** — You can disconnect your Google account at any time by telling LEKHA "disconnect my Google account." This immediately revokes our stored tokens.
**Revoke Google access** — You can independently revoke LEKHA's Google access at myaccount.google.com/permissions at any time.
**Portability** — Your exported data is provided in machine-readable JSON format.
**Opt-out of proactive messages** — Turn off morning briefings, evening summaries, and pre-meeting alerts through LEKHA settings at any time.

For users in the European Economic Area (EEA), UK, or other jurisdictions with enhanced data rights (GDPR, UK GDPR, PDPA), these rights are supplemented by local law. You also have the right to lodge a complaint with your local data protection authority.`,
  },
  {
    heading: "8. Security",
    body: `We take security seriously and implement the following protections:

• **Encryption at rest** — All OAuth tokens are encrypted using AES-256-GCM with a unique 32-byte key before storage.
• **HMAC verification** — All incoming LINE webhook requests are verified using HMAC-SHA256 against your channel secret before processing.
• **Single-use OAuth state tokens** — Connect-link tokens and OAuth state nonces are atomically consumed (GETDEL) to prevent replay attacks.
• **Rate limiting** — Requests are limited to 500 per hour per user to prevent abuse.
• **HTTPS only** — All traffic between your device, LINE, and our servers is encrypted in transit via TLS 1.2+.
• **No plaintext secrets** — API keys and credentials are stored in Vercel's encrypted environment variable store, never in source code.

No digital service is perfectly secure. In the event of a data breach affecting your personal information, we will notify you promptly in accordance with applicable law.`,
  },
  {
    heading: "9. Children's Privacy",
    body: `LEKHA is not directed at children under the age of 13 (or under 16 in the EEA). We do not knowingly collect personal information from children. If you believe a child has provided us with their personal data, please contact us immediately and we will delete it.`,
  },
  {
    heading: "10. International Data Transfers",
    body: `LEKHA is operated from Bangkok, Thailand. Your data may be processed by our infrastructure partners (Upstash, Vercel, Google) in data centres located in the United States and other countries. These transfers are subject to appropriate safeguards, including data processing agreements with our sub-processors that include standard contractual clauses or equivalent mechanisms where required.`,
  },
  {
    heading: "11. Changes to This Policy",
    body: `We may update this Privacy Policy from time to time. When we make material changes, we will update the "Last updated" date at the top of this page and, where feasible, notify you through the LEKHA chat interface.

Your continued use of LEKHA after changes are posted constitutes acceptance of the updated Policy.`,
  },
  {
    heading: "12. Contact Us",
    body: `If you have questions, concerns, or requests related to this Privacy Policy or your personal data, please contact us:

Assistantforyou
Email: assistantforyou999@gmail.com
Address: Bangkok, Thailand

We aim to respond to all privacy inquiries within 14 business days.`,
  },
];

export default function PrivacyPage() {
  return (
    <>
      <div className="aurora" />
      <div className="grid-bg" />
      <div className="noise" />

      {/* Nav */}
      <nav className="nav">
        <div className="container nav-inner">
          <Link href="/" className="brand" style={{ textDecoration: "none" }}>
            <div className="brand-mark">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 5v10a4 4 0 0 0 4 4h6" />
                <circle cx="17" cy="7" r="2.2" fill="white" stroke="none" />
              </svg>
            </div>
            <span>LEKHA</span>
          </Link>
          <div className="nav-cta">
            <Link className="btn btn-ghost" href="/">← Back to home</Link>
          </div>
        </div>
      </nav>

      <main style={{ paddingTop: 120, paddingBottom: 80 }}>
        <div className="container" style={{ maxWidth: 860 }}>

          {/* Header */}
          <div style={{ marginBottom: 48 }}>
            <span className="section-eyebrow">Legal</span>
            <h1 style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 800,
              fontSize: "clamp(32px, 5vw, 52px)",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              margin: "16px 0 20px",
            }}>
              Privacy Policy
            </h1>
            <p style={{ color: "var(--ink-dim)", fontSize: 15, margin: 0 }}>
              Last updated: {LAST_UPDATED} · Effective immediately upon use of the LEKHA service.
            </p>
          </div>

          {/* Intro card */}
          <div style={{
            background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(10,26,62,0.4))",
            border: "1px solid var(--line-strong)",
            borderRadius: 16,
            padding: "24px 28px",
            marginBottom: 32,
          }}>
            <p style={{ margin: 0, color: "var(--ink-dim)", fontSize: 15, lineHeight: 1.7 }}>
              LEKHA is a personal AI assistant. We collect only what we need to deliver the service and store your data with strong encryption. We do not sell your data, and we never train AI models on your personal conversations. This document explains exactly what data we handle and why.
            </p>
          </div>

          {/* Sections */}
          <div style={{
            background: "linear-gradient(180deg, rgba(10,26,62,0.45), rgba(7,17,44,0.3))",
            border: "1px solid var(--line)",
            borderRadius: 18,
            padding: "8px 28px 28px",
          }}>
            {SECTIONS.map(({ heading, body }, i) => (
              <div key={i} style={{
                padding: "24px 0",
                borderTop: i === 0 ? "none" : "1px solid var(--line)",
              }}>
                <h2 style={{
                  margin: "0 0 12px",
                  fontFamily: "'Sora', sans-serif",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--gold)",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}>
                  {heading}
                </h2>
                <div style={{ color: "var(--ink-dim)", fontSize: 14.5, lineHeight: 1.75 }}>
                  {body.split("\n\n").map((para, j) => (
                    para.startsWith("**") && para.includes("**\n") ? (
                      <div key={j} style={{ marginBottom: 16 }}>
                        <p style={{
                          margin: "0 0 6px",
                          color: "var(--ink)",
                          fontFamily: "'Sora', sans-serif",
                          fontWeight: 700,
                          fontSize: 13.5,
                        }}>
                          {para.slice(2, para.indexOf("**\n"))}
                        </p>
                        <p style={{ margin: 0, whiteSpace: "pre-line" }}>
                          {para.slice(para.indexOf("**\n") + 3)}
                        </p>
                      </div>
                    ) : (
                      <p key={j} style={{ margin: "0 0 14px", whiteSpace: "pre-line" }}>
                        {para}
                      </p>
                    )
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer links */}
          <div style={{
            marginTop: 40,
            paddingTop: 28,
            borderTop: "1px solid var(--line)",
            display: "flex",
            gap: 24,
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <span style={{ color: "var(--ink-mute)", fontSize: 13 }}>
              © 2026 LEKHA · เลขา. All rights reserved.
            </span>
            <div style={{ display: "flex", gap: 20 }}>
              <Link href="/terms" style={{ color: "var(--ink-dim)", fontSize: 13, textDecoration: "none" }}>
                Terms of Service
              </Link>
              <Link href="/" style={{ color: "var(--ink-dim)", fontSize: 13, textDecoration: "none" }}>
                Home
              </Link>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
