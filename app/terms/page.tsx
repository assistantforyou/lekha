import type { Metadata } from "next";
import Link from "next/link";
import "../marketing.css";

export const metadata: Metadata = {
  title: "Terms of Service — LEKHA",
  description:
    "Terms and conditions governing your access to and use of the LEKHA AI executive assistant.",
};

const LAST_UPDATED = "8 June 2026";

const TERMS = [
  [
    "1. About LEKHA",
    "LEKHA is an AI-automated chatbot designed to assist users with daily tasks, including daily briefings, tasks and reminders, calendar support, email drafting, document drafting, image analysis, stock and market analysis, research summaries, and general productivity support.\n\nLEKHA is intended to help users organise information, save time, and improve workflow efficiency. However, LEKHA does not replace human judgment, professional advice, or personal responsibility.",
  ],
  [
    "2. Acceptance of Terms",
    "By accessing or using LEKHA — through the LINE messaging platform, our website, or any connected integration — you confirm that you are at least 13 years old (16 in the EEA), that you have the legal capacity to enter into a binding agreement, and that you agree to these Terms in their entirety.\n\nIf you are using LEKHA on behalf of a company or organisation, you represent that you have authority to bind that entity to these Terms.",
  ],
  [
    "3. User Responsibility",
    "You are responsible for how you use LEKHA and for reviewing all outputs before relying on them. AI-generated responses may be inaccurate, incomplete, outdated, or unsuitable for your specific situation.\n\nYou agree to independently verify important information before making decisions, especially in areas involving finance, medicine, law, business, employment, safety, or personal matters.",
  ],
  [
    "4. No Professional Advice",
    "LEKHA may provide information related to finance, markets, health, business, productivity, or other topics. This information is provided for general informational purposes only.\n\nLEKHA does not provide financial, investment, legal, medical, tax, or other professional advice. You should consult a qualified professional before making decisions in these areas.\n\nStock analysis, market summaries, and investment-related content are not investment recommendations and should not be treated as a guarantee of performance, return, or outcome.",
  ],
  [
    "5. Account and Access",
    "Some features may require you to create an account, provide contact information, or connect third-party services such as email, calendar, cloud storage, messaging platforms, or payment systems.\n\nYou are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. You agree to notify us immediately if you suspect unauthorised access.",
  ],
  [
    "6. Third-Party Integrations",
    "LEKHA may connect with third-party services, including but not limited to email providers, calendar platforms, messaging applications, cloud storage providers, payment processors, and market data providers.\n\nYour use of third-party services is also subject to their own terms, privacy policies, and rules. We are not responsible for failures, interruptions, errors, data loss, or policy changes caused by third-party platforms.",
  ],
  [
    "7. Email, Calendar, and Task Automation",
    "LEKHA may help draft emails, summarise messages, create reminders, manage tasks, or assist with calendar scheduling. You remain responsible for reviewing, approving, sending, editing, deleting, or acting on any communication or scheduled item.\n\nWe are not responsible for missed reminders, incorrect schedules, delayed notifications, wrongly drafted messages, failed delivery, or actions taken based on AI-generated outputs.",
  ],
  [
    "8. Image and Document Analysis",
    "LEKHA may allow users to upload images, screenshots, receipts, documents, or other files for analysis, summarisation, extraction, or organisation.\n\nYou confirm that you have the right to upload and process any content you submit. You should not upload confidential, sensitive, illegal, or third-party content unless you have permission to do so.\n\nAI extraction from images or documents may contain errors. You are responsible for verifying all extracted information before using it.",
  ],
  [
    "9. User Content",
    "You retain ownership of content you submit to LEKHA, including messages, files, images, prompts, documents, and other materials.\n\nBy using LEKHA, you grant Assistantforyou a limited, non-exclusive, worldwide licence to process your content as necessary to provide the service, improve functionality, troubleshoot issues, ensure security, and comply with legal obligations. This licence does not permit us to sell your content, share it with advertisers, or train AI models on it.\n\nYou agree not to submit content that is illegal, harmful, abusive, defamatory, infringing, misleading, or violates the rights of others.",
  ],
  [
    "10. Acceptable Use",
    "You agree not to use LEKHA to: break any law or regulation; violate another person's privacy or intellectual property rights; generate spam, fraud, phishing, impersonation, or deceptive content; upload malware, harmful code, or unauthorised data; harass, threaten, abuse, or harm others; make automated decisions that may significantly affect another person without proper human review; or use LEKHA for high-risk activities where failure could cause injury, death, financial loss, or legal harm.\n\nWe reserve the right to suspend or terminate access if we believe you have violated these Terms.",
  ],
  [
    "11. Payments and Subscriptions",
    "Some LEKHA features may be free, while others may require payment or subscription. Prices, billing cycles, available features, and subscription plans may change over time.\n\nBy purchasing a paid plan, you agree to pay all applicable fees. Unless stated otherwise, subscription fees are billed in advance and may renew automatically.\n\nRefunds, cancellations, and billing disputes will be handled according to our published refund policy or applicable law.",
  ],
  [
    "12. Service Availability",
    "We aim to provide a reliable service, but we do not guarantee that LEKHA will always be available, uninterrupted, secure, or error-free.\n\nThe service may be temporarily unavailable due to maintenance, updates, technical issues, third-party failures, security events, or circumstances beyond our control.",
  ],
  [
    "13. AI Limitations",
    "LEKHA uses artificial intelligence and automated systems. AI outputs may be inaccurate, biased, incomplete, outdated, or unsuitable for your intended purpose.\n\nYou agree not to rely solely on LEKHA for critical decisions. Human review is required before using LEKHA outputs for professional, legal, financial, medical, business, or safety-related purposes.",
  ],
  [
    "14. Intellectual Property",
    "All rights, title, and interest in LEKHA, including the platform, software, design, branding, logo, interface, features, and related materials, belong to Assistantforyou or its licensors.\n\nYou may not copy, modify, reverse engineer, sell, rent, distribute, or create derivative works from LEKHA without our written permission.",
  ],
  [
    "15. Privacy",
    "Your privacy is important to us. Our collection, use, storage, and protection of personal data are described in our Privacy Policy.\n\nBy using LEKHA, you agree that we may process your data in accordance with our Privacy Policy.",
  ],
  [
    "16. Security",
    "We take reasonable measures to protect user data and platform security. However, no digital service can be guaranteed to be completely secure.\n\nYou agree not to bypass security systems, access unauthorised accounts, scrape data, overload the system, or interfere with normal platform operation.",
  ],
  [
    "17. Termination",
    "We may suspend or terminate your access to LEKHA at any time if you violate these Terms, misuse the service, create risk for other users, or if continued service becomes commercially, legally, or technically impractical.\n\nYou may stop using LEKHA at any time. Termination does not remove obligations that arose before termination, including payment obligations or restrictions on misuse of intellectual property.",
  ],
  [
    "18. Disclaimer of Warranties",
    'LEKHA is provided on an "as is" and "as available" basis. We do not guarantee that the service will meet your expectations, produce accurate outputs, be uninterrupted, or be free from errors.\n\nTo the maximum extent permitted by law, we disclaim all warranties, whether express or implied, including warranties of accuracy, reliability, fitness for a particular purpose, merchantability, and non-infringement.',
  ],
  [
    "19. Limitation of Liability",
    "To the maximum extent permitted by law, Assistantforyou shall not be liable for any indirect, incidental, consequential, special, punitive, or exemplary damages, including loss of profits, loss of data, missed opportunities, business interruption, financial loss, or reliance on AI-generated outputs.\n\nOur total liability for any claim related to the service shall not exceed the amount you paid to us in the six months before the claim arose.",
  ],
  [
    "20. Indemnification",
    "You agree to indemnify and hold harmless LEKHA, Assistantforyou, its founders, employees, partners, contractors, and affiliates from any claims, damages, losses, liabilities, costs, or expenses arising from your use of the service, violation of these Terms, misuse of AI outputs, or infringement of third-party rights.",
  ],
  [
    "21. Changes to These Terms",
    'We may update these Terms from time to time. When we make changes, we will update the "Last updated" date above.\n\nYour continued use of LEKHA after changes are posted means you accept the updated Terms.',
  ],
  [
    "22. Governing Law",
    "These Terms shall be governed by the laws of Thailand, without regard to conflict of law principles.\n\nAny disputes shall be resolved in the courts or appropriate dispute resolution forum located in Bangkok, Thailand, unless otherwise required by applicable law.",
  ],
  [
    "23. Contact Us",
    "For questions about these Terms, please contact us:\n\nAssistantforyou\nEmail: assistantforyou999@gmail.com\nAddress: Bangkok, Thailand",
  ],
] as const;

export default function TermsPage() {
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
              Terms of Service
            </h1>
            <p style={{ color: "var(--ink-dim)", fontSize: 15, margin: 0 }}>
              Last updated: {LAST_UPDATED} · By accessing or using LEKHA, you agree to these terms. If you do not agree, please do not use our service.
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
              Welcome to LEKHA. These Terms of Service ("Terms") govern your access to and use of LEKHA, an AI-powered chatbot and executive assistant service operated by Assistantforyou ("LEKHA," "we," "us," or "our"). Please read these Terms carefully before using the service.
            </p>
          </div>

          {/* Sections */}
          <div style={{
            background: "linear-gradient(180deg, rgba(10,26,62,0.45), rgba(7,17,44,0.3))",
            border: "1px solid var(--line)",
            borderRadius: 18,
            padding: "8px 28px 28px",
          }}>
            {TERMS.map(([heading, body], i) => (
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
                <p style={{
                  margin: 0,
                  color: "var(--ink-dim)",
                  fontSize: 14.5,
                  lineHeight: 1.75,
                  whiteSpace: "pre-line",
                }}>
                  {body}
                </p>
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
              <Link href="/privacy" style={{ color: "var(--ink-dim)", fontSize: 13, textDecoration: "none" }}>
                Privacy Policy
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
