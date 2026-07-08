import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050d1e] px-6 py-24">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(96,165,250,0.1)] border border-[rgba(96,165,250,0.2)]">
          <span className="text-2xl font-bold text-[#60a5fa]" style={{ fontFamily: "Sora, sans-serif" }}>
            404
          </span>
        </div>
        <h1 className="text-xl font-semibold text-white mb-2" style={{ fontFamily: "Sora, sans-serif" }}>
          Page not found
        </h1>
        <p className="text-sm text-[#9fb3d4] mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-[#050d1e] transition hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #fde68a 0%, #f5b942 100%)", fontFamily: "Sora, sans-serif" }}
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
