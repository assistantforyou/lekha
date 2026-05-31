import { headers } from "next/headers";
import { startOAuth, verifyConnectToken } from "@/lib/tools/google-auth";

export const dynamic = "force-dynamic";

function isEmbeddedWebview(ua: string): boolean {
  const lower = ua.toLowerCase();
  return (
    lower.includes("line") ||
    lower.includes("instagram") ||
    lower.includes("fbav") ||
    lower.includes("fban") ||
    lower.includes("snapchat") ||
    lower.includes("tiktok") ||
    lower.includes("wechat") ||
    lower.includes("whatsapp") ||
    lower.includes("webview") ||
    lower.includes("(inapp;")
  );
}

export default async function ConnectPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let userId: string;
  try {
    userId = await verifyConnectToken(token);
  } catch {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <section className="glass-panel w-full max-w-lg rounded-2xl p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#e7c88d]">
            Google Connect
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-white">
            Link expired
          </h1>
          <p className="mt-3 text-base leading-7 text-[#bdb6ad]">
            Ask Lekha to send a fresh connect link, then tap it within 10 minutes.
          </p>
        </section>
      </main>
    );
  }

  const consentUrl = await startOAuth(userId);
  const userAgent = (await headers()).get("user-agent") ?? "";

  // If the user is in an embedded webview (LINE, Instagram, etc.), Google will
  // block the OAuth flow with "Use secure browsers". Show an intermediate page
  // that instructs them to open the link in Chrome/Safari.
  if (isEmbeddedWebview(userAgent)) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <section className="glass-panel w-full max-w-lg rounded-2xl p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#e7c88d]">
            Google Connect
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-white">
            Open in your browser
          </h1>
          <p className="mt-3 text-base leading-7 text-[#bdb6ad]">
            Google requires signing in with Chrome or Safari. The app you&apos;re using
            right now can&apos;t complete this step.
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-base leading-7 text-[#bdb6ad]">
            <li>Tap and hold the link below</li>
            <li>Choose <strong className="text-white">Open in Chrome / Safari</strong></li>
            <li>Sign in with Google</li>
          </ol>
          <a
            href={consentUrl}
            className="mt-6 block w-full rounded-xl bg-[#e7c88d] px-5 py-3.5 text-center text-base font-semibold text-[#1a1a1a] transition hover:bg-[#d4b67a] active:scale-[0.98]"
          >
            Continue to Google
          </a>
          <p className="mt-4 break-all text-xs text-[#7a756e]">{consentUrl}</p>
        </section>
      </main>
    );
  }

  // Normal browser — redirect immediately.
  const { redirect } = await import("next/navigation");
  redirect(consentUrl);
}
