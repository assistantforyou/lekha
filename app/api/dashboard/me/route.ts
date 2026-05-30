import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/dashboard-auth";
import { getSettings } from "@/lib/memory/settings";
import { getOrCreateProfile } from "@/lib/memory/profile";
import { listAccounts } from "@/lib/tools/google-auth";
import { loadFacts } from "@/lib/memory/facts";
import { isAllowed } from "@/lib/memory/allowlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [profile, settings, accounts, facts, allowed] = await Promise.all([
    getOrCreateProfile(session.userId),
    getSettings(session.userId),
    listAccounts(session.userId),
    loadFacts(session.userId),
    isAllowed(session.userId),
  ]);

  return NextResponse.json({
    userId: session.userId,
    displayName: profile.displayName,
    joinedAt: profile.joinedAt,
    settings,
    googleAccounts: accounts.accounts,
    activeGoogleEmail: accounts.activeEmail,
    facts: facts.facts,
    subscriptionActive: allowed,
  });
}
