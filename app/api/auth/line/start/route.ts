import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { env } from "@/lib/env";
import { redis } from "@/lib/memory/redis";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const plan = req.nextUrl.searchParams.get("plan");
  if (plan !== "monthly" && plan !== "yearly") {
    return new NextResponse("invalid plan", { status: 400 });
  }

  const e = env();
  if (!e.LINE_LOGIN_CHANNEL_ID) {
    return new NextResponse("LINE Login not configured", { status: 503 });
  }

  const nonce = randomBytes(16).toString("hex");
  await redis().set(`signup:state:${nonce}`, JSON.stringify({ plan }), { ex: 900 });

  const redirectUri = `${e.APP_BASE_URL}/api/auth/line/dashboard-callback`;
  const authUrl = new URL("https://access.line.me/oauth2/v2.1/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", e.LINE_LOGIN_CHANNEL_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", nonce);
  authUrl.searchParams.set("scope", "profile openid");

  return NextResponse.redirect(authUrl.toString());
}
