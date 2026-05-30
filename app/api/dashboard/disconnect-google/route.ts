import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/dashboard-auth";
import { removeAccount, listAccounts } from "@/lib/tools/google-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const email = (body as Record<string, unknown>)?.email;
  if (typeof email !== "string" || !email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  await removeAccount(session.userId, email);
  const accounts = await listAccounts(session.userId);
  return NextResponse.json({ accounts: accounts.accounts, activeEmail: accounts.activeEmail });
}
