"use client";

import { useEffect } from "react";

export default function RootErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[root-error]", error);
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
          Something went wrong.
        </h1>
        <p className="text-sm text-[#9fb3d4] mb-6">
          Please try again. If the problem persists, contact support.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-[#050d1e] transition hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #fde68a 0%, #f5b942 100%)", fontFamily: "Sora, sans-serif" }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
