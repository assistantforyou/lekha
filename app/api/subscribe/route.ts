import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const Body = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
  }
  console.log("[subscribe] email captured");
  return NextResponse.json({ ok: true });
}
