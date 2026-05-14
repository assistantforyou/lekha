import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email : "";
  console.log("[subscribe] email captured:", email);
  return NextResponse.json({ ok: true });
}
