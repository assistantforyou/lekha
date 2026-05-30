import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { redis } from "@/lib/memory/redis";
import { signSession, sessionCookieOpts } from "@/lib/dashboard-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const e = env();
  const base = e.APP_BASE_URL;

  if (error || !code || !state) {
    return NextResponse.redirect(`${base}/?error=line_denied`);
  }

  // Atomically consume state nonce
  const stored = await redis().getdel<{ redirectTo?: string }>(`dashboard:state:${state}`);
  if (!stored) {
    return NextResponse.redirect(`${base}/?error=invalid_state`);
  }
  const redirectTo = stored.redirectTo ?? "/dashboard";

  if (!e.LINE_LOGIN_CHANNEL_ID || !e.LINE_LOGIN_CHANNEL_SECRET) {
    return NextResponse.redirect(`${base}/?error=not_configured`);
  }

  // Exchange auth code for access token
  const redirectUri = `${base}/api/auth/line/dashboard-callback`;
  const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: e.LINE_LOGIN_CHANNEL_ID,
      client_secret: e.LINE_LOGIN_CHANNEL_SECRET,
    }),
  });

  if (!tokenRes.ok) {
    console.error("[dashboard-callback] token exchange failed", await tokenRes.text());
    return NextResponse.redirect(`${base}/?error=line_token`);
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string };

  // Get LINE user profile
  const profileRes = await fetch("https://api.line.me/v2/profile", {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!profileRes.ok) {
    return NextResponse.redirect(`${base}/?error=line_profile`);
  }

  const { userId, displayName } = (await profileRes.json()) as {
    userId: string;
    displayName: string;
  };

  // Create session
  const token = await signSession(userId, displayName);
  const opts = sessionCookieOpts();

  const res = NextResponse.redirect(`${base}${redirectTo}`);
  res.cookies.set(opts.name, token, {
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite,
    path: opts.path,
    maxAge: opts.maxAge,
  });

  return res;
}
