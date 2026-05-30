import { NextResponse } from "next/server";
import { getSession } from "@/lib/dashboard-auth";
import { buildConnectUrl } from "@/lib/tools/google-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const url = await buildConnectUrl(session.userId);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[dashboard] failed to build connect url", err);
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
}
