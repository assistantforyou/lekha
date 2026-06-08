import type { Metadata } from "next";
import Link from "next/link";
import "../marketing.css";

export const metadata: Metadata = {
  title: "Terms of Service — LEKHA",
  description:
    "Terms and conditions governing your access to and use of the LEKHA AI executive assistant service.",
};

const EFFECTIVE = "8 June 2026";

type Section = { heading: string; body: string };

const SECTIONS: Section[] = [
  {
    heading: "1. Definitions",
    body: `In these Terms of Service the following terms have the meanings given below:

"Agreement" means these Terms of Service together with the Privacy Policy, any order form, and any other documents expressly incorporated by reference.

"Content" means all text, files, images, data, and other materials you submit to or through the Service.

"Feedback" means any ideas, suggestions, enhancement requests, recommendations, corrections, or other feedback you provide regarding the Service.

"Intellectual Property Rights" means all patents, copyrights, trademarks, trade secrets, database rights, moral rights, and all other intellectual and industrial property rights of whatever nature, whether registered or unregistered.

"Service" means the LEKHA AI executive assistant platform, including the LINE-integrated chatbot, website at lekha-iota.vercel.app, connected integrations, APIs, and any related software.

"Subscription" means your paid plan entitling you to access premium features of the Service during a defined billing period.

"Trial Period" means the initial free-access period (currently seven calendar days) during which you may use the Service without charge.

"User," "you," or "your" means the individual accessing or using the Service, or the company or organisation on whose behalf that individual is acting.

"We," "us," "our," or "LEKHA" means Assistantforyou, the operator of the Service.`,
  },
  {
    heading: "2. Acceptance of Terms",
    body: `By accessing or using the Service — including through the LINE messaging platform, our website, or any API or integration — you represent and warrant that:

(a) You are at least 13 years of age (or 16 in the European Economic Area);
(b) If you are using the Service on behalf of a company, organisation, or other legal entity, you have the authority to bind that entity to this Agreement, and "you" refers to that entity;
(c) You have read, understood, and agree to be bound by this Agreement in its entirety;
(d) Your use of the Service does not violate any applicable law or regulation in your jurisdiction.

If you do not agree to these Terms, you must immediately stop using the Service.`,
  },
  {
    heading: "3. Description of Service",
    body: `LEKHA is an AI-powered personal executive assistant that operates primarily through the LINE messaging platform. The Service provides, among other features: AI-generated responses and conversational assistance; daily briefings, morning summaries, and evening recaps; task and reminder management; calendar event creation and management; email drafting and sending; document drafting and management; image and document analysis; web research; stock, market, and financial data summaries; and integration with third-party services including Google Workspace.

The Service uses large language models to generate responses. AI-generated outputs are probabilistic and may be inaccurate, incomplete, outdated, or unsuitable for your circumstances. LEKHA is a productivity tool and does not replace human judgment or professional advice.

We reserve the right to add, modify, suspend, or discontinue any feature of the Service at any time, with reasonable notice where practicable. We are not liable for any modification, suspension, or discontinuation of any feature.`,
  },
  {
    heading: "4. Accounts and Access",
    body: `4.1 Account creation
Access to the Service is granted through your LINE account identity. You do not create a separate password-based account. You are responsible for all activity that occurs under your LINE identity in connection with the Service.

4.2 Third-party integrations
You may optionally connect third-party accounts (e.g. Google) to the Service. By doing so, you authorise us to access and act on data within those accounts on your behalf, subject to the permissions you grant. You are responsible for ensuring that your use of connected third-party services complies with their own terms of service.

4.3 Access restrictions
Access to the Service is currently by invitation or approved request only. We reserve the right to grant or deny access at our discretion. Approved users may be subject to a waitlist process.

4.4 Account security
You are solely responsible for maintaining the confidentiality of your connected accounts and for any activity conducted through the Service on your behalf. You must notify us immediately at assistantforyou999@gmail.com if you become aware of any unauthorised access to or use of your account.`,
  },
  {
    heading: "5. Trial Period",
    body: `New users may access the Service free of charge during the Trial Period (currently seven calendar days from the date of first access). Trial access is subject to all terms of this Agreement.

At the end of the Trial Period, continued access to premium features requires a paid Subscription. If you do not subscribe, access to premium features will be suspended.

We reserve the right to modify, shorten, or discontinue the Trial Period at any time without prior notice to prospective users. The Trial Period is available once per user and once per organisation and may not be restarted by creating a new account.`,
  },
  {
    heading: "6. Subscriptions, Billing, and Payment",
    body: `6.1 Subscription plans
Subscription plans, pricing, billing frequency, and included features are as described at the time of purchase and on our website. Prices are subject to change with at least 30 days' advance notice.

6.2 Billing and auto-renewal
Subscription fees are billed in advance for each billing period (monthly or annual, as selected). Subscriptions renew automatically at the end of each billing period unless you cancel before the renewal date. By subscribing, you authorise us (or our payment processor) to charge your payment method on a recurring basis.

6.3 Price changes
If we change the price of your current subscription plan, we will give you at least 30 days' advance notice. Your continued use of the Service after the price change takes effect constitutes your acceptance of the new price. If you do not accept the new price, you must cancel before the renewal date.

6.4 Cancellation
You may cancel your Subscription at any time through the in-app settings or by contacting us. Cancellation takes effect at the end of the current billing period; you will not be charged for the next period. We do not provide prorated refunds for partial billing periods upon cancellation, except where required by applicable law.

6.5 Refunds
Except as required by applicable law or our express refund policy communicated at the time of purchase, all fees are non-refundable. If you believe you have been charged in error, please contact us at assistantforyou999@gmail.com within 30 days of the charge.

6.6 Taxes
All fees are exclusive of any applicable taxes, levies, duties, or charges imposed by governmental authorities. You are responsible for paying all such taxes associated with your use of the Service.

6.7 Failed payments
If a payment fails, we may suspend your access to premium features until the outstanding balance is settled. We will attempt to notify you of payment failures.`,
  },
  {
    heading: "7. User Responsibilities and Acceptable Use",
    body: `7.1 General responsibility
You are responsible for all Content you submit to the Service and for all actions taken through the Service on your behalf. You agree to use the Service only for lawful purposes and in compliance with this Agreement and all applicable laws and regulations.

7.2 Prohibited conduct
You agree not to use the Service to:

(a) Violate any applicable local, national, or international law or regulation;
(b) Infringe any third party's Intellectual Property Rights, privacy rights, or other legal rights;
(c) Generate, distribute, or facilitate spam, phishing, fraud, impersonation, or deceptive content;
(d) Upload, transmit, or distribute malware, harmful code, or any software intended to damage or interfere with any system;
(e) Harass, threaten, abuse, or harm any person;
(f) Make automated decisions that may significantly affect another person without appropriate human review;
(g) Engage in high-risk activities where AI-generated errors could cause death, personal injury, financial loss, or serious harm;
(h) Reverse-engineer, decompile, disassemble, or otherwise attempt to derive the source code of the Service;
(i) Access the Service through automated means (bots, scrapers) except as expressly permitted in writing;
(j) Circumvent or attempt to circumvent any rate limits, security controls, or access controls;
(k) Use the Service for any purpose that competes with us or to develop a competing product;
(l) Violate any export control law or use the Service in any jurisdiction subject to a comprehensive embargo or sanctions regime.

7.3 Monitoring
We reserve the right (but are not obligated) to monitor use of the Service to ensure compliance with this Agreement, investigate suspected violations, and comply with legal obligations. Such monitoring does not obligate us to take any action.`,
  },
  {
    heading: "8. User Content",
    body: `8.1 Ownership
You retain ownership of all Content you submit to the Service.

8.2 Licence grant to us
By submitting Content to the Service, you grant us a limited, non-exclusive, royalty-free, worldwide licence to process, store, reproduce, and transmit your Content as necessary to provide the Service, ensure security, troubleshoot issues, comply with legal obligations, and improve the Service. This licence does not permit us to sell your Content, use it for advertising, or share it with third parties except as described in our Privacy Policy.

8.3 Feedback
If you provide Feedback, you grant us an irrevocable, perpetual, worldwide, royalty-free licence to use, reproduce, modify, distribute, and exploit that Feedback for any purpose, including incorporating it into the Service, without any obligation of confidentiality or compensation to you. Feedback does not include your personal Content or Personal Data.

8.4 Content standards
You represent and warrant that: (a) you own or have the necessary rights to submit the Content; (b) the Content does not violate any third-party rights or applicable law; and (c) the Content complies with Section 7.2 (Prohibited conduct).

8.5 Content removal
We may remove or disable access to any Content that violates this Agreement or applicable law, without prior notice and without liability to you.`,
  },
  {
    heading: "9. Third-Party Services and Integrations",
    body: `The Service may integrate with third-party services including but not limited to Google Workspace, LINE, Tavily, and financial data providers. Your use of those services is governed by their own terms of service and privacy policies. We are not a party to your agreements with third-party services and are not responsible for their performance, availability, accuracy, or data practices.

We do not guarantee that any particular third-party integration will remain available. Third-party providers may change their APIs, terms, or pricing, which may affect the features of the Service. We will notify you of material changes to integrations where practicable.`,
  },
  {
    heading: "10. No Professional Advice",
    body: `Nothing in the Service or its outputs constitutes financial, investment, legal, medical, tax, psychological, or other professional advice. All AI-generated content is for general informational and productivity purposes only.

Financial and market data, stock summaries, and investment-related outputs are not investment recommendations and should not be relied upon to make investment decisions. Past performance is not indicative of future results.

You should consult a qualified and licensed professional before making any decision that could have significant financial, legal, medical, or personal consequences. We expressly disclaim liability for any loss arising from reliance on AI-generated content without independent professional verification.`,
  },
  {
    heading: "11. AI Limitations and Accuracy",
    body: `The Service uses generative AI models that produce probabilistic outputs. AI outputs may be inaccurate, biased, incomplete, outdated, offensive, or otherwise unsuitable for your intended purpose. LEKHA does not guarantee the accuracy, completeness, or fitness for purpose of any AI-generated response.

You agree that:
(a) You will review all AI-generated outputs before relying on them;
(b) You will not use AI outputs for critical decisions without independent verification;
(c) Human oversight is required for any output used in professional, legal, financial, medical, or safety-critical contexts;
(d) We are not responsible for errors or omissions in AI-generated outputs.`,
  },
  {
    heading: "12. Email, Calendar, and Automation",
    body: `LEKHA may assist with drafting emails, summarising messages, creating reminders, managing tasks, and scheduling calendar events. You remain solely responsible for reviewing, approving, editing, deleting, or acting on any communication, event, or action taken on your behalf.

We are not responsible for: missed or incorrectly timed reminders; events created with incorrect details; emails drafted with errors; failed message delivery; actions taken based on AI-generated outputs; or any consequence of relying on automated outputs without human review.

By directing LEKHA to send an email or create a calendar event on your behalf, you confirm that you have reviewed and approved the action.`,
  },
  {
    heading: "13. Intellectual Property",
    body: `13.1 Our rights
All rights, title, and interest in the Service — including the platform, software, algorithms, design, branding, trademarks, trade names, logos, interface, documentation, and all related Intellectual Property Rights — are owned by or licensed to Assistantforyou. Nothing in this Agreement transfers any such rights to you.

13.2 Licence to use
Subject to your compliance with this Agreement and payment of applicable fees, we grant you a limited, non-exclusive, non-transferable, non-sublicensable, revocable licence to access and use the Service solely for your personal or internal business productivity purposes.

13.3 Restrictions
You may not copy, modify, create derivative works from, distribute, sell, sublicense, rent, lease, transfer, publicly display, publicly perform, reverse engineer, decompile, or disassemble any portion of the Service without our prior written consent.

13.4 AI-generated outputs
We make no claims of ownership over AI-generated outputs produced solely from your prompts. To the extent any copyright subsists in such outputs, you are responsible for compliance with any applicable laws governing AI-generated content in your jurisdiction.`,
  },
  {
    heading: "14. Privacy",
    body: `Our collection, use, storage, sharing, and protection of your Personal Data is governed by our Privacy Policy, available at lekha-iota.vercel.app/privacy, which is incorporated into this Agreement by reference. By using the Service, you agree to the Privacy Policy.`,
  },
  {
    heading: "15. Confidentiality",
    body: `We will treat your Content and account information with the same degree of care we use to protect our own confidential information, and in any event no less than reasonable care. We will not disclose your Content to third parties except as permitted by this Agreement or our Privacy Policy.

You acknowledge that the Service, its underlying architecture, pricing, and non-public features constitute our confidential information. You agree not to disclose such information to any third party without our prior written consent.`,
  },
  {
    heading: "16. Service Availability and Modifications",
    body: `We aim to maintain high availability but do not guarantee that the Service will be available at any particular time or that it will be uninterrupted, error-free, or free from security vulnerabilities.

The Service may be temporarily unavailable due to: scheduled maintenance (for which we will provide advance notice where practicable); emergency maintenance; technical failures; third-party service outages; security incidents; or circumstances beyond our reasonable control.

We may modify, update, suspend, or discontinue any feature or the entire Service at any time. Where a modification materially reduces the features available under your Subscription, we will provide at least 30 days' notice, and if you cancel within that notice period we will provide a prorated refund for the unused portion of your current billing period.`,
  },
  {
    heading: "17. Suspension and Termination",
    body: `17.1 Termination by you
You may stop using the Service at any time. If you have a paid Subscription, cancellation takes effect at the end of the current billing period. You may request deletion of your data as described in our Privacy Policy.

17.2 Suspension or termination by us
We may, without prior notice, suspend or terminate your access to the Service if: you violate this Agreement; your use creates legal, regulatory, security, or reputational risk for us or other users; we receive a valid court order or regulatory direction; or continued service becomes commercially, legally, or technically impractical.

Where circumstances allow, we will notify you of the grounds for suspension and provide a reasonable opportunity to remedy the breach before terminating.

17.3 Effect of termination
Upon termination: your licence to use the Service ceases immediately; we may delete your data in accordance with our Privacy Policy retention schedule; any accrued payment obligations remain due; and provisions that by their nature survive termination (including Sections 8, 10, 13, 18, 19, 20, 21, 22, and 23) will continue to apply.`,
  },
  {
    heading: "18. Disclaimer of Warranties",
    body: `TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTY OF ANY KIND.

WE EXPRESSLY DISCLAIM ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE, INCLUDING WITHOUT LIMITATION: ANY IMPLIED WARRANTY OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, ACCURACY, RELIABILITY, QUIET ENJOYMENT, OR NON-INFRINGEMENT; ANY WARRANTY THAT THE SERVICE WILL MEET YOUR REQUIREMENTS, BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE; AND ANY WARRANTY REGARDING THE ACCURACY OR RELIABILITY OF AI-GENERATED OUTPUTS.

Some jurisdictions do not allow the exclusion of certain implied warranties. To the extent such warranties cannot be excluded by law, they are limited to the minimum scope and duration permitted.`,
  },
  {
    heading: "19. Limitation of Liability",
    body: `TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:

(a) IN NO EVENT SHALL ASSISTANTFORYOU, ITS DIRECTORS, OFFICERS, EMPLOYEES, PARTNERS, AGENTS, SUPPLIERS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING WITHOUT LIMITATION LOSS OF PROFITS, LOSS OF REVENUE, LOSS OF DATA, LOSS OF GOODWILL, BUSINESS INTERRUPTION, FINANCIAL LOSS, OR COST OF SUBSTITUTE SERVICES, ARISING OUT OF OR RELATED TO YOUR USE OF OR INABILITY TO USE THE SERVICE OR ANY AI-GENERATED OUTPUT, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

(b) OUR TOTAL AGGREGATE LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATED TO THIS AGREEMENT OR THE SERVICE SHALL NOT EXCEED THE GREATER OF: (i) THE TOTAL FEES PAID BY YOU TO US IN THE TWELVE MONTHS IMMEDIATELY PRECEDING THE CLAIM; OR (ii) ONE HUNDRED UNITED STATES DOLLARS (USD $100).

Nothing in this Agreement limits or excludes liability for: death or personal injury caused by our negligence; fraud or fraudulent misrepresentation; any liability that cannot be excluded or limited by applicable law.

These limitations reflect an agreed allocation of risk between the parties. You acknowledge that we would not have provided the Service on the terms herein without these limitations.`,
  },
  {
    heading: "20. Indemnification",
    body: `You agree to defend, indemnify, and hold harmless Assistantforyou and its directors, officers, employees, contractors, partners, and affiliates from and against any claims, liabilities, damages, judgments, awards, losses, costs, and expenses (including reasonable legal fees) arising out of or relating to:

(a) Your use of the Service in violation of this Agreement;
(b) Your Content or Feedback;
(c) Your violation of any applicable law or regulation;
(d) Your infringement of any third-party Intellectual Property Rights or other rights;
(e) Any reliance on AI-generated outputs without appropriate independent review.

We reserve the right to assume exclusive control of the defence of any matter subject to indemnification by you, at your expense. You agree to cooperate with our defence of such claims.`,
  },
  {
    heading: "21. Dispute Resolution",
    body: `21.1 Informal resolution
Before initiating any formal legal proceeding, you agree to contact us at assistantforyou999@gmail.com to describe the dispute and give us 30 days to attempt to resolve it informally. This obligation does not apply to requests for injunctive or other equitable relief.

21.2 Governing law
This Agreement and any dispute or claim arising out of or in connection with it (including non-contractual disputes) shall be governed by and construed in accordance with the laws of Thailand, without regard to its conflict of law principles.

21.3 Jurisdiction
Subject to Section 21.1, any dispute that cannot be resolved informally shall be submitted to the exclusive jurisdiction of the courts located in Bangkok, Thailand, unless applicable consumer protection laws in your jurisdiction require otherwise.

21.4 Class action waiver
To the extent permitted by applicable law, you and we each agree that any dispute resolution proceeding will be conducted only on an individual basis and not as part of a class, consolidated, or representative action. If a court finds this waiver unenforceable, the class action shall be severed and resolved in a forum of competent jurisdiction; the remaining individual claim shall proceed as provided above.

21.5 Time limitation
Any claim arising out of or relating to this Agreement must be brought within one year of the date the cause of action accrued, except where a shorter or longer period is required by applicable mandatory law.`,
  },
  {
    heading: "22. Force Majeure",
    body: `Neither party shall be in breach of this Agreement or liable for any delay in performing, or failure to perform, any of its obligations under this Agreement if such delay or failure results from events, circumstances, or causes beyond its reasonable control, including without limitation: acts of God; natural disasters; pandemic or epidemic; war, terrorism, or civil unrest; government action or regulation; failure of third-party infrastructure or services (including cloud providers, telecommunications networks, or LINE's platform); power outages; or cyberattacks.

The affected party shall notify the other as soon as reasonably practicable and take reasonable steps to minimise the effects of and resume performance.`,
  },
  {
    heading: "23. General Provisions",
    body: `23.1 Entire Agreement
This Agreement (including the Privacy Policy and any documents incorporated by reference) constitutes the entire agreement between you and us with respect to the Service and supersedes all prior negotiations, representations, warranties, arrangements, and understandings.

23.2 Severability
If any provision of this Agreement is found to be invalid, illegal, or unenforceable by a court of competent jurisdiction, that provision shall be modified to the minimum extent necessary to make it enforceable, or severed if modification is not possible. The remaining provisions shall continue in full force and effect.

23.3 Waiver
No failure or delay by either party in exercising any right or remedy under this Agreement shall constitute a waiver of that right or remedy. A waiver of any breach does not constitute a waiver of any subsequent breach.

23.4 Assignment
You may not assign, transfer, delegate, or sublicense any of your rights or obligations under this Agreement without our prior written consent. We may freely assign this Agreement in connection with a merger, acquisition, corporate restructuring, or sale of all or substantially all of our assets, with notice to you. Any purported assignment in violation of this provision is void.

23.5 No third-party beneficiaries
This Agreement does not create any third-party beneficiary rights. No person or entity other than the parties to this Agreement (and permitted successors and assigns) shall have any right to enforce any provision hereof.

23.6 Relationship of parties
The parties are independent contractors. Nothing in this Agreement creates a partnership, joint venture, agency, franchise, employment, or fiduciary relationship between the parties.

23.7 Notices
Any notice required or permitted under this Agreement shall be in writing and sent to us by email at assistantforyou999@gmail.com. Legal notices to you may be sent to your email address on file or delivered via the LEKHA chat interface. Notices are effective on the date of confirmed delivery.

23.8 Headings
Section headings are for convenience only and shall not affect the interpretation of this Agreement.

23.9 Language
This Agreement is written in English. Where a translation exists, the English version controls in the event of any conflict.

23.10 Export compliance
You agree to comply with all applicable export control laws and regulations. You represent that you are not located in, or a national or resident of, any country subject to a comprehensive embargo or sanctions regime, and that you are not on any restricted-party list maintained by any government authority.

23.11 Changes to the Terms
We may update these Terms from time to time. Material changes will be communicated via the LEKHA chat interface or by updating the effective date above. Your continued use of the Service after the effective date of any update constitutes acceptance of the revised Terms. If you do not agree to the changes, you must stop using the Service before the effective date.`,
  },
  {
    heading: "24. Contact Us",
    body: `For questions about these Terms, billing enquiries, legal notices, or complaints:

Assistantforyou (operating as LEKHA)
Email: assistantforyou999@gmail.com
Address: Bangkok, Thailand

We aim to respond to all enquiries within 14 business days.`,
  },
];

export default function TermsPage() {
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
              Terms of Service
            </h1>
            <p style={{ color: "var(--ink-dim)", fontSize: 15, margin: 0 }}>
              Effective date: {EFFECTIVE} · By accessing or using LEKHA, you agree to these Terms. Please read them carefully.
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
              Key points (not a substitute for reading the full Terms)
            </p>
            <ul style={{ margin: 0, padding: "0 0 0 18px", color: "var(--ink-dim)", fontSize: 14, lineHeight: 1.8 }}>
              <li>LEKHA is an AI productivity tool. AI outputs may be inaccurate — do not rely on them for legal, medical, or financial decisions without professional verification.</li>
              <li>Subscriptions auto-renew. Cancel before your renewal date to avoid the next charge.</li>
              <li>You own your Content. We do not sell it or use it for advertising.</li>
              <li>Governing law is Thailand. Disputes are resolved in Bangkok courts.</li>
              <li>Our liability is capped at fees paid in the prior 12 months or USD $100, whichever is greater.</li>
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
