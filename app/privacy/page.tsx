import type { Metadata } from "next";
import Link from "next/link";
import "../marketing.css";

export const metadata: Metadata = {
  title: "Privacy Policy — LEKHA",
  description:
    "How LEKHA collects, uses, stores, and protects your personal data. Full disclosure under PDPA (Thailand) and GDPR.",
};

const EFFECTIVE = "8 June 2026";

type Section = { heading: string; body: string };

const SECTIONS: Section[] = [
  {
    heading: "1. Definitions",
    body: `In this Privacy Policy the following terms have the meanings given below:

"Controller" means Assistantforyou, the entity that determines the purposes and means of processing your Personal Data.

"Personal Data" means any information relating to an identified or identifiable natural person, including but not limited to name, LINE user identifier, email address, message content, location data, and any other data you provide or that is inferred through your use of the Service.

"Processing" means any operation or set of operations performed on Personal Data, including collection, recording, storage, use, disclosure, erasure, or destruction.

"Service" means the LEKHA AI executive assistant platform, including the LINE-integrated chatbot, website at lekha-iota.vercel.app, and any connected integrations.

"Sub-processor" means a third party engaged by us to process Personal Data on our behalf.

"PDPA" means the Personal Data Protection Act B.E. 2562 (2019) of Thailand and its subordinate regulations.

"GDPR" means the General Data Protection Regulation (EU) 2016/679.

"Data Subject" means the natural person to whom Personal Data relates — that is, you.`,
  },
  {
    heading: "2. Who We Are",
    body: `The Controller of your Personal Data is:

Assistantforyou
Operating as: LEKHA
Location: Bangkok, Thailand
Email: assistantforyou999@gmail.com

For all privacy enquiries, data subject requests, or concerns about this Policy, please contact us at the email address above. We designate the above contact as the point of contact for privacy matters. We will respond to all enquiries within 14 business days.`,
  },
  {
    heading: "3. Scope and Applicability",
    body: `This Policy applies to all Personal Data processed by us in connection with your use of the Service. It covers:

(a) Data collected directly from you through your interactions with LEKHA via LINE or our website;
(b) Data received from third-party services you authorise to connect with LEKHA (e.g. Google);
(c) Data inferred or derived from your interactions with the Service (e.g. extracted facts, preferences).

This Policy does not apply to the practices of third-party services that you access through LEKHA. Their own privacy policies govern their data practices.

If you are located in Thailand, your data is processed in accordance with the PDPA. If you are located in the European Economic Area ("EEA"), United Kingdom, or Switzerland, additional protections under the GDPR or equivalent legislation also apply where relevant.`,
  },
  {
    heading: "4. Personal Data We Collect",
    body: `We collect only Personal Data that is necessary to provide and operate the Service.

4.1 Identity and Account Data
Your LINE user identifier and display name are received from LINE when you first interact with the bot. We do not receive your LINE password, phone number linked to LINE, or payment instruments stored in LINE.

4.2 Message and Conversation Content
We retain a rolling window of your most recent 20 conversation turns and generate periodic compressed summaries of older turns to maintain context across sessions. This includes the full text of messages you send to LEKHA and the assistant's replies.

4.3 Extracted Facts and Structured Memory
The Service automatically identifies and stores factual statements you share — such as personal preferences, occupational context, recurring schedule patterns, health notes, and key relationships — as structured records. These are tagged by category and confidence score.

4.4 Google Account Data (if connected)
If you choose to connect a Google account, we receive and store encrypted OAuth 2.0 access and refresh tokens. Depending on the permission scopes you authorise, we may access and transiently process the following on your behalf:
  • Gmail: message metadata, message body, thread identifiers (to draft, send, read, or summarise emails at your direction)
  • Google Calendar: event titles, dates, times, attendees, descriptions (to create, update, or list events at your direction)
  • Google Drive: file names, MIME types, file content where necessary for upload or read operations directed by you
  • Google Contacts: contact names and email addresses (to look up recipients at your direction)
  • Google Docs and Slides: document content (to create or edit documents at your direction)

We do not copy or permanently store the body of your emails, calendar event descriptions, or document contents beyond the immediate transient processing required to complete your requested action. We do not use your Google data to train AI models.

4.5 Tasks, Reminders, and Lists
We store the tasks, reminders, shopping lists, and other structured items you ask the Service to create or manage, along with associated metadata (due dates, priority, completion status).

4.6 Settings and Preferences
We store your timezone, preferred language, city-level location (if you provide it), and notification preferences including morning briefing time, evening summary preference, and pre-meeting reminder intervals.

4.7 Receipt and Financial Summaries
If you use the receipt scanning feature, we store AI-extracted receipt data fields (merchant name, total amount, date, currency, category). We process the image submitted only for the duration of the extraction request and do not retain a copy of the image itself.

4.8 Subscription and Billing Data
If you subscribe to a paid plan, billing and payment processing is handled by our payment processor. We do not store your full card number, CVV, or bank account details. We retain transaction identifiers, plan type, and billing dates for accounting and support purposes.

4.9 Analytics and Technical Data
We use Vercel Analytics and Vercel Speed Insights to collect aggregated, anonymised performance metrics about page load times and usage patterns. These tools may collect your approximate geographic region, device type, browser type, and referrer URL. This data is not linked to your LINE identity. See Section 8 for more detail.

4.10 Security and Rate-Limit Logs
We retain minimal security logs including request timestamps, error codes, and a rolling per-user request counter. These are used solely to enforce rate limits, detect abuse, and diagnose technical issues. We do not log the full content of your messages in infrastructure access logs.`,
  },
  {
    heading: "5. Legal Basis for Processing",
    body: `We process your Personal Data only where we have a lawful basis to do so. Under the PDPA and, where applicable, the GDPR, our legal bases are as follows:

Performance of a Contract (PDPA §24(3) / GDPR Art. 6(1)(b))
We process identity data, conversation history, extracted facts, Google account tokens, tasks, reminders, settings, and receipt data as necessary to perform the Service you have engaged us to provide. Without this processing we cannot deliver the assistant's core functionality.

Legitimate Interests (PDPA §24(5) / GDPR Art. 6(1)(f))
We process minimal technical and security log data to detect and prevent fraud, abuse, and unauthorised access, and to maintain the security and integrity of the Service. We have assessed that our legitimate interest in security is not overridden by your interests or fundamental rights.

Legal Obligation (PDPA §24(1) / GDPR Art. 6(1)(c))
We may process or retain Personal Data where required to comply with applicable law, including tax, accounting, or judicial obligations.

Consent (PDPA §19 / GDPR Art. 6(1)(a))
Where required by applicable law for processing that falls outside the above bases (for example, processing of sensitive Personal Data such as health-related notes that you voluntarily share), we rely on your explicit consent. You may withdraw consent at any time by contacting us or using the in-app deletion tools without affecting the lawfulness of processing prior to withdrawal.

Processing of Special Categories of Data
LEKHA may store health-related information you voluntarily share (e.g. dietary preferences, medical appointments). This constitutes sensitive Personal Data under the PDPA and special category data under the GDPR. We process it solely on the basis of your explicit consent and use it exclusively to personalise the Service as you have directed. You can delete any such data at any time using the in-app fact-management commands.`,
  },
  {
    heading: "6. Cookies and Analytics",
    body: `Our website at lekha-iota.vercel.app uses a limited number of technologies that may process or store information on your device.

Strictly Necessary
Vercel deploys infrastructure-level headers (e.g. for load balancing and DDoS protection via Cloudflare) that do not require consent. No persistent session cookies are set for unauthenticated visitors.

Analytics and Performance
We use Vercel Analytics and Vercel Speed Insights. These tools collect anonymised, aggregated data about page performance and visitor patterns (device type, browser, approximate region, Core Web Vitals). Vercel does not use cookies for analytics and does not fingerprint individual visitors. The data is not linked to any LINE identity or personal account.

No Advertising or Tracking Cookies
We do not use advertising cookies, third-party tracking pixels, remarketing tags, or social media tracking scripts.

If you wish to limit analytics data collection you may use a browser that blocks analytics scripts, or install a content blocker such as uBlock Origin. This will not affect your ability to use the Service.`,
  },
  {
    heading: "7. Automated Decision-Making and Profiling",
    body: `The Service uses artificial intelligence to generate personalised responses, extract facts from your conversations, and make proactive recommendations (e.g. morning briefings, pre-meeting alerts). This constitutes a form of automated processing.

No automated processing we perform produces decisions that have a legal effect on you or similarly significantly affects you without a human in the loop. All actions that interact with external systems (sending emails, creating calendar events, scheduling reminders) are either explicitly requested by you in each interaction or are executed based on settings you have explicitly configured.

If you are in the EEA or UK, you have the right under GDPR Art. 22 not to be subject to decisions based solely on automated processing that produce legal or similarly significant effects. As noted above, no such decisions are made by the Service.

You may review and delete extracted facts at any time by asking LEKHA to "list my facts" or "clear my facts," or by contacting us directly.`,
  },
  {
    heading: "8. How We Use Your Personal Data",
    body: `We use your Personal Data solely for the following purposes:

(a) Service delivery — to respond to your messages, execute actions you request (send emails, manage calendar events, set reminders), and maintain conversation continuity across sessions.

(b) Personalisation — to tailor the assistant's responses and proactive outputs (briefings, summaries) using your stored facts, preferences, timezone, and history.

(c) Proactive features — to deliver morning briefings, evening summaries, pre-meeting alerts, and task reminders at the times and conditions you configure.

(d) Security and integrity — to authenticate requests, enforce rate limits, detect and block unauthorised access, and protect the platform and other users.

(e) Service improvement — anonymised and aggregated interaction patterns (never individual message content) may inform how we develop and refine the assistant's capabilities.

(f) Legal compliance — to comply with applicable law, respond to lawful government requests, and exercise or defend legal claims.

We do not:
  • Sell your Personal Data to any third party
  • Use your Personal Data for advertising or marketing to you without your explicit consent
  • Share your Personal Data with third parties except as described in Section 9
  • Train AI models on your personal message content or Google data`,
  },
  {
    heading: "9. Sub-Processors and Third-Party Sharing",
    body: `We share your Personal Data only with the sub-processors listed below, each subject to a data processing agreement that requires them to protect your data to standards at least equivalent to ours. We do not share your data with any other third party except as required by law (Section 10).

LINE Corporation (Japan / Global)
Role: Message delivery, user identity provisioning
Data shared: LINE user ID, message routing metadata
Privacy policy: line.me/en/terms/policy

Google LLC (USA)
Role: AI inference (Gemini API), Gmail/Calendar/Drive/Docs/Contacts API access where you connect your Google account
Data shared: Message content for AI inference; Google account tokens and API responses where you have connected an account
Privacy policy: policies.google.com/privacy
Note: We use the Gemini paid API tier, which is subject to Google's enterprise data processing addendum prohibiting use of API inputs to train Google's models.

Upstash, Inc. (USA — AWS infrastructure)
Role: Primary data store (Redis) and semantic memory index (Vector)
Data shared: All data described in Section 4 — conversation history, facts, tasks, settings, tokens, archive summaries
Privacy policy: upstash.com/privacy

Vercel, Inc. (USA)
Role: Serverless compute, hosting, analytics
Data shared: Request metadata, anonymised analytics (see Section 6)
Privacy policy: vercel.com/legal/privacy-policy

Cloudflare, Inc. (USA)
Role: DDoS protection, CDN
Data shared: IP addresses and request metadata (not linked to LINE identity)
Privacy policy: cloudflare.com/privacypolicy

Tavily (USA)
Role: Web search for user-directed research queries
Data shared: The search query text you provide; no account-linked data
Privacy policy: tavily.com/privacy

Payment Processor (applicable on paid plans)
Role: Billing and payment processing
Data shared: Name, email, billing address, payment instrument details — directly with the processor; we do not receive or store full card data
Details provided at the time of subscription.`,
  },
  {
    heading: "10. Legal Disclosures",
    body: `We may disclose your Personal Data to government authorities, courts, or law enforcement agencies where we are required to do so by:

(a) Applicable law, regulation, or legally binding order;
(b) Legal process (e.g. subpoena, court order, or equivalent);
(c) Enforcement of our Terms of Service;
(d) Protection of the rights, property, or safety of LEKHA, our users, or the public where we have a lawful basis to act.

Where permitted by law, we will notify you of any such disclosure request before complying. We will not disclose more data than is strictly required by the applicable legal obligation.`,
  },
  {
    heading: "11. Data Storage and Retention",
    body: `Geographic location of storage
Your data is stored in Upstash Redis and Upstash Vector, which are hosted on Amazon Web Services infrastructure, primarily in the US East (N. Virginia) region. Compute processing occurs on Vercel's global edge network. Both providers have committed to standard contractual clauses or equivalent transfer mechanisms for data originating in the EEA or UK.

Retention periods
The following retention schedule applies unless you request deletion earlier:

Conversation history (rolling window): retained for the duration of your active use of the Service, with a 90-day inactivity expiry from last interaction.
Compressed archive summaries: up to 200 entries per user; oldest entries are automatically evicted as the limit is reached. Each entry expires 90 days after the last interaction.
Extracted facts: retained indefinitely until you delete them or request account deletion.
Tasks, reminders, and lists: retained until marked complete, cancelled, manually deleted, or your account is deleted.
OAuth tokens (Google): retained until you disconnect your Google account, revoke access at myaccount.google.com/permissions, or request deletion.
Receipt records: up to 200 entries per user, retained for up to 12 months from the date of entry.
Sent email audit log: last 200 entries, retained for up to 6 months.
Security and rate-limit logs: retained for up to 30 days on a rolling basis.
Billing records: retained for the period required by applicable tax and accounting law (typically 5–7 years depending on jurisdiction).

Data minimisation
We review retained data periodically and delete any data that is no longer necessary for the purposes for which it was collected.`,
  },
  {
    heading: "12. Security",
    body: `We implement the following technical and organisational measures to protect your Personal Data:

Encryption at rest: All Google OAuth tokens are encrypted using AES-256-GCM with a unique 96-bit random nonce per encryption operation before storage. The encryption key is stored separately in Vercel's encrypted environment variable store.

Encryption in transit: All communications between your device, LINE, and our servers use TLS 1.2 or higher.

HMAC verification: All incoming LINE webhook requests are authenticated using HMAC-SHA256 against your channel secret before any processing occurs.

Single-use nonces: Connect-link tokens and OAuth state parameters are atomically consumed (via a Redis GETDEL operation) upon first use, preventing replay attacks.

Rate limiting: Requests are subject to a sliding-window rate limit of 500 requests per hour per user to prevent abuse.

No secrets in source code: All API keys, secrets, and credentials are stored in Vercel's encrypted environment variable store, never committed to source code or logs.

Access control: Production infrastructure access is restricted to authorised personnel only. No third-party has broad access to the production data store.

No system is perfectly secure. In the event that we become aware of a security incident that is likely to result in a risk to your rights and freedoms, we will notify you without undue delay and in any event within 72 hours of becoming aware of the breach, in accordance with our obligations under applicable law. We will also notify the relevant supervisory authority (e.g. the PDPC in Thailand, or the relevant EEA supervisory authority) where legally required.`,
  },
  {
    heading: "13. Your Rights",
    body: `Subject to applicable law, you have the following rights in respect of your Personal Data. Under the PDPA (Thailand) and GDPR (where applicable), these include:

Right of Access: You may request confirmation of whether we process your Personal Data and, if so, a copy of that data. Send LEKHA the command "export my data" for an immediate JSON export, or contact us by email.

Right to Rectification: If any Personal Data we hold is inaccurate or incomplete, you may ask us to correct it. Use the in-app fact-management commands or contact us by email.

Right to Erasure ("Right to Be Forgotten"): You may request that we delete your Personal Data. Use the in-app command "delete all my data" or contact us by email. We will process deletion requests within 30 days and confirm completion. Note that some data may be retained where we have a legal obligation to do so (e.g. billing records).

Right to Restriction of Processing: You may request that we restrict processing of your Personal Data in certain circumstances (e.g. while accuracy is contested).

Right to Data Portability: You may request your Personal Data in a structured, commonly used, machine-readable format (JSON). Use "export my data" in-app or contact us.

Right to Object: You may object to processing based on legitimate interests. We will cease such processing unless we demonstrate compelling legitimate grounds that override your interests.

Right to Withdraw Consent: Where processing is based on your consent, you may withdraw it at any time without affecting the lawfulness of prior processing. In-app: delete the relevant data. For Google-scope consent: disconnect your Google account or revoke access at myaccount.google.com/permissions.

Right Not to Be Subject to Automated Decision-Making: As described in Section 7, we do not make legally significant automated decisions about you.

Right to Lodge a Complaint: If you believe we have processed your Personal Data unlawfully, you have the right to lodge a complaint with:
  • In Thailand: the Personal Data Protection Committee (PDPC), pdpc.or.th
  • In the EEA: the data protection authority in your country of residence
  • In the UK: the Information Commissioner's Office (ICO), ico.org.uk

We ask that you contact us first so we have the opportunity to address your concern directly.

How to exercise your rights
Email: assistantforyou999@gmail.com with the subject line "Data Subject Request — [type of request]." We will respond within 14 business days and process requests within 30 days (extendable by a further 30 days for complex requests, with prior notice to you).`,
  },
  {
    heading: "14. International Data Transfers",
    body: `LEKHA is operated from Bangkok, Thailand. Your Personal Data is transferred to and processed by our sub-processors in the United States (Upstash, Vercel, Google, Tavily, Cloudflare) and, for LINE delivery, in Japan and other countries in which LINE operates.

For transfers from the EEA or UK, we rely on the following transfer mechanisms:
(a) Standard Contractual Clauses (SCCs) approved by the European Commission and, where applicable, the UK International Data Transfer Addendum, incorporated into our data processing agreements with relevant sub-processors;
(b) The adequacy decision of the European Commission where applicable.

If you would like further information about the safeguards we have put in place, or a copy of the relevant SCCs, please contact us.`,
  },
  {
    heading: "15. Children's Privacy",
    body: `The Service is not directed to, and we do not knowingly collect Personal Data from, children under the age of 13, or under 16 in the EEA. If we become aware that we have collected Personal Data from a child below the applicable age threshold without verifiable parental consent, we will take steps to delete that data as quickly as possible.

If you are a parent or guardian and believe your child has provided us with Personal Data, please contact us immediately at assistantforyou999@gmail.com.`,
  },
  {
    heading: "16. Links to Third-Party Sites",
    body: `The Service or our website may contain links to third-party websites or services. This Privacy Policy does not apply to those sites. We encourage you to review the privacy policy of any third-party site you visit. We are not responsible for the privacy practices or content of third-party sites.`,
  },
  {
    heading: "17. Changes to This Policy",
    body: `We may update this Privacy Policy from time to time to reflect changes in our data practices, legal requirements, or the features of the Service. When we make material changes, we will:

(a) Update the "Last updated / Effective" date at the top of this page;
(b) Where feasible, notify you via a message through the LEKHA chat interface.

If the changes are significant and require a new legal basis for processing, we will seek fresh consent where required.

Your continued use of the Service after the effective date of any updated Policy constitutes your acknowledgement of the changes. If you do not agree to the updated Policy, you should stop using the Service and may request deletion of your data as described in Section 13.`,
  },
  {
    heading: "18. Contact Us",
    body: `For any questions, concerns, or requests relating to this Privacy Policy or the processing of your Personal Data:

Assistantforyou (operating as LEKHA)
Email: assistantforyou999@gmail.com
Address: Bangkok, Thailand

We aim to respond to all enquiries within 14 business days.`,
  },
];

export default function PrivacyPage() {
  return (
    <>
      <div className="aurora" />
      <div className="grid-bg" />
      <div className="noise" />

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
              Effective date: {EFFECTIVE} · This Policy applies to all users of the LEKHA service.
            </p>
          </div>

          <div style={{
            background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(10,26,62,0.4))",
            border: "1px solid var(--line-strong)",
            borderRadius: 16,
            padding: "24px 28px",
            marginBottom: 32,
          }}>
            <p style={{ margin: "0 0 12px", color: "var(--ink)", fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 14 }}>
              Summary (not a substitute for reading the full policy)
            </p>
            <ul style={{ margin: 0, padding: "0 0 0 18px", color: "var(--ink-dim)", fontSize: 14, lineHeight: 1.8 }}>
              <li>We collect only what we need to run the Service — your LINE ID, messages, facts you share, and (optionally) Google account access.</li>
              <li>We never sell your data or use it for advertising.</li>
              <li>We do not train AI models on your personal conversations or Google data.</li>
              <li>Google OAuth tokens are encrypted at rest using AES-256-GCM.</li>
              <li>You can export, correct, or delete all your data at any time — in-app or by emailing us.</li>
              <li>We comply with Thailand&apos;s PDPA and respect GDPR rights for EEA users.</li>
            </ul>
          </div>

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
                  margin: "0 0 14px",
                  fontFamily: "'Sora', sans-serif",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--gold)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}>
                  {heading}
                </h2>
                <p style={{
                  margin: 0,
                  color: "var(--ink-dim)",
                  fontSize: 14,
                  lineHeight: 1.8,
                  whiteSpace: "pre-line",
                }}>
                  {body}
                </p>
              </div>
            ))}
          </div>

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
