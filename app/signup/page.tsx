"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

const PLANS = {
  monthly: {
    label: "Monthly",
    price: "฿599",
    priceUSD: "$19",
    period: "/month",
    note: "Cancel anytime",
  },
  yearly: {
    label: "Yearly",
    price: "฿5,990",
    priceUSD: "$189",
    period: "/year",
    note: "Save 17% · 2 months free",
    featured: true,
  },
};

const ERROR_MESSAGES: Record<string, string> = {
  line_denied: "LINE sign-in was cancelled. Please try again.",
  invalid_state: "Sign-in session expired. Please try again.",
  line_token: "Could not sign in with LINE. Please try again.",
  line_profile: "Could not fetch your LINE profile. Please try again.",
  stripe_not_configured: "Payments are not configured yet. Contact support.",
  not_configured: "Service not configured. Contact support.",
};

function LekhaMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 5v10a4 4 0 0 0 4 4h6" />
      <circle cx="17" cy="7" r="2.2" fill="white" stroke="none" />
    </svg>
  );
}

function LineIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
      <path d="M19.952 11.369C19.952 7.13 15.666 4 12 4 8.334 4 4.048 7.13 4.048 11.369c0 3.799 3.373 6.988 7.926 7.583.309.067.729.203.835.467.096.241.063.619.031.861l-.135.813c-.041.241-.19.944.827.515 1.017-.43 5.49-3.233 7.49-5.534h.002C19.408 14.424 19.952 12.95 19.952 11.369z" />
    </svg>
  );
}

function SignupInner() {
  const params = useSearchParams();
  const planParam = params.get("plan");
  const errorParam = params.get("error");
  const plan: "monthly" | "yearly" = planParam === "yearly" ? "yearly" : "monthly";
  const p = PLANS[plan];
  const errorMsg = errorParam ? (ERROR_MESSAGES[errorParam] ?? "Something went wrong. Please try again.") : null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #050d1e 0%, #071124 60%, #060f1e 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      fontFamily: "Inter, system-ui, sans-serif",
    }}>
      <div style={{ maxWidth: 420, width: "100%" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: "linear-gradient(135deg, #1a7fe0, #0f4fa8)",
              display: "grid", placeItems: "center",
            }}>
              <LekhaMark />
            </div>
            <span style={{ fontFamily: "Sora, sans-serif", fontWeight: 700, fontSize: 20, color: "white", letterSpacing: "0.06em" }}>
              LEKHA
            </span>
          </Link>
        </div>

        {/* Card */}
        <div style={{
          background: "linear-gradient(180deg, rgba(10,26,62,0.7) 0%, rgba(7,17,44,0.5) 100%)",
          border: "1px solid rgba(96,165,250,0.18)",
          borderRadius: 20,
          padding: "36px 32px",
        }}>
          <h1 style={{
            fontFamily: "Sora, sans-serif", fontSize: 24, fontWeight: 700,
            color: "white", margin: "0 0 6px", textAlign: "center",
          }}>
            Start your free trial
          </h1>
          <p style={{ color: "rgba(200,215,240,0.6)", fontSize: 14, margin: "0 0 28px", textAlign: "center" }}>
            7 days free · then {p.price}{p.period}
          </p>

          {/* Error */}
          {errorMsg && (
            <div style={{
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: 10, padding: "12px 16px", marginBottom: 20,
              color: "#fca5a5", fontSize: 13, lineHeight: 1.5,
            }}>
              {errorMsg}
            </div>
          )}

          {/* Plan summary */}
          <div style={{
            background: "rgba(96,165,250,0.06)",
            border: "1px solid rgba(96,165,250,0.18)",
            borderRadius: 12, padding: "16px 20px", marginBottom: 24,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: "Sora, sans-serif", fontWeight: 600, color: "white", fontSize: 15 }}>
                  {p.label}
                </div>
                <div style={{ fontSize: 12, color: "rgba(200,215,240,0.55)", marginTop: 3 }}>
                  {p.note}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "Sora, sans-serif", fontWeight: 700, fontSize: 22, color: "white" }}>
                  {p.price}
                </div>
                <div style={{ fontSize: 12, color: "rgba(200,215,240,0.45)" }}>
                  {p.period}
                </div>
              </div>
            </div>
          </div>

          {/* LINE login button */}
          <Link
            href={`/api/auth/line/start?plan=${plan}`}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              width: "100%", padding: "14px 20px", background: "#06c755",
              borderRadius: 12, fontFamily: "Sora, sans-serif", fontWeight: 600,
              fontSize: 15, color: "white", textDecoration: "none",
              boxSizing: "border-box",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            <LineIcon />
            Continue with LINE
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 18 }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="rgba(200,215,240,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span style={{ fontSize: 12, color: "rgba(200,215,240,0.35)", lineHeight: 1.5 }}>
              No charge during trial · Secured by Stripe · Cancel anytime
            </span>
          </div>
        </div>

        {/* Switch plan */}
        <p style={{ textAlign: "center", fontSize: 13, color: "rgba(200,215,240,0.4)", marginTop: 16 }}>
          {plan === "monthly" ? (
            <>Want to save 17%?{" "}
              <Link href="/signup?plan=yearly" style={{ color: "rgba(96,165,250,0.75)", textDecoration: "none" }}>
                Switch to yearly
              </Link>
            </>
          ) : (
            <>Prefer monthly?{" "}
              <Link href="/signup?plan=monthly" style={{ color: "rgba(96,165,250,0.75)", textDecoration: "none" }}>
                Switch to monthly
              </Link>
            </>
          )}
        </p>
        <p style={{ textAlign: "center", fontSize: 13, color: "rgba(200,215,240,0.3)", marginTop: 8 }}>
          <Link href="/" style={{ color: "rgba(200,215,240,0.3)", textDecoration: "none" }}>← Back to home</Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupInner />
    </Suspense>
  );
}
