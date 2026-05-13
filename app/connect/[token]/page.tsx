import { redirect } from "next/navigation";
import { startOAuth, verifyConnectToken } from "@/lib/tools/google-auth";

export const dynamic = "force-dynamic";

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
  redirect(consentUrl);
}
