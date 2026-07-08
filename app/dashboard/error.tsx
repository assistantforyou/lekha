"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DashboardErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard-error]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050d1e] px-6 py-24">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#fca5a5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M15 9l-6 6M9 9l6 6" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-white mb-2" style={{ fontFamily: "Sora, sans-serif" }}>
          Dashboard unavailable
        </h1>
        <p className="text-sm text-[#9fb3d4] mb-6">
          We couldn&apos;t load your dashboard. Try again or return home.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-[#050d1e] transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #fde68a 0%, #f5b942 100%)", fontFamily: "Sora, sans-serif" }}
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white border border-[rgba(96,165,250,0.25)] transition hover:bg-[rgba(96,165,250,0.08)]"
            style={{ fontFamily: "Sora, sans-serif" }}
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
