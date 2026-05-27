import Link from "next/link";

export default function SuccessPage() {
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
      <div style={{ maxWidth: 440, width: "100%" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: "linear-gradient(135deg, #1a7fe0, #0f4fa8)",
              display: "grid", placeItems: "center",
            }}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 5v10a4 4 0 0 0 4 4h6" />
                <circle cx="17" cy="7" r="2.2" fill="white" stroke="none" />
              </svg>
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
          padding: "40px 32px",
          textAlign: "center",
        }}>
          {/* Success icon */}
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "rgba(6,199,85,0.12)",
            border: "1px solid rgba(6,199,85,0.3)",
            display: "grid", placeItems: "center",
            margin: "0 auto 24px",
          }}>
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#06c755" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>

          <h1 style={{
            fontFamily: "Sora, sans-serif", fontSize: 26, fontWeight: 700,
            color: "white", margin: "0 0 10px",
          }}>
            You&apos;re in!
          </h1>
          <p style={{ color: "rgba(200,215,240,0.65)", fontSize: 15, margin: "0 0 32px", lineHeight: 1.6 }}>
            Your 7-day free trial has started. Add LEKHA on LINE to begin chatting.
          </p>

          {/* Add on LINE button */}
          <a
            href="https://lin.ee/NuCuel7"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              width: "100%", padding: "14px 20px", background: "#06c755",
              borderRadius: 12, fontFamily: "Sora, sans-serif", fontWeight: 600,
              fontSize: 15, color: "white", textDecoration: "none",
              boxSizing: "border-box", marginBottom: 16,
            }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
              <path d="M19.952 11.369C19.952 7.13 15.666 4 12 4 8.334 4 4.048 7.13 4.048 11.369c0 3.799 3.373 6.988 7.926 7.583.309.067.729.203.835.467.096.241.063.619.031.861l-.135.813c-.041.241-.19.944.827.515 1.017-.43 5.49-3.233 7.49-5.534h.002C19.408 14.424 19.952 12.95 19.952 11.369z" />
            </svg>
            Add LEKHA on LINE
          </a>

          <p style={{ fontSize: 13, color: "rgba(200,215,240,0.35)", lineHeight: 1.5, margin: 0 }}>
            Already added LEKHA? Just send a message to start.
            <br />
            Your card won&apos;t be charged until after your 7-day trial.
          </p>
        </div>

        <p style={{ textAlign: "center", fontSize: 13, color: "rgba(200,215,240,0.3)", marginTop: 20 }}>
          <Link href="/" style={{ color: "rgba(200,215,240,0.3)", textDecoration: "none" }}>← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
