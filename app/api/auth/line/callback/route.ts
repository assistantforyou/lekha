import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { env } from "@/lib/env";
import { redis } from "@/lib/memory/redis";

export const runtime = "nodejs";


export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const e = env();
  const base = e.APP_BASE_URL;

  if (error || !code || !state) {
    return NextResponse.redirect(`${base}/signup?error=line_denied`);
  }

  // Atomically consume state nonce (prevents replay)
  const stored = await redis().getdel<{ plan: "monthly" | "yearly" }>(`signup:state:${state}`);
  if (!stored) {
    return NextResponse.redirect(`${base}/signup?error=invalid_state`);
  }
  const { plan } = stored;

  if (!e.LINE_LOGIN_CHANNEL_ID || !e.LINE_LOGIN_CHANNEL_SECRET) {
    return NextResponse.redirect(`${base}/signup?error=not_configured`);
  }

  // Exchange auth code for access token
  const redirectUri = `${base}/api/auth/line/callback`;
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
    console.error("[line-callback] token exchange failed", await tokenRes.text());
    return NextResponse.redirect(`${base}/signup?error=line_token`);
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string };

  // Get LINE user profile
  const profileRes = await fetch("https://api.line.me/v2/profile", {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!profileRes.ok) {
    return NextResponse.redirect(`${base}/signup?error=line_profile`);
  }

  const { userId, displayName } = (await profileRes.json()) as {
    userId: string;
    displayName: string;
  };

  if (!e.STRIPE_SECRET_KEY || !e.STRIPE_MONTHLY_PRICE_ID || !e.STRIPE_YEARLY_PRICE_ID) {
    return NextResponse.redirect(`${base}/signup?error=stripe_not_configured`);
  }

  const priceId = plan === "yearly" ? e.STRIPE_YEARLY_PRICE_ID : e.STRIPE_MONTHLY_PRICE_ID;

  // Create Stripe Checkout Session with 7-day trial
  const stripe = new Stripe(e.STRIPE_SECRET_KEY);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 7,
      metadata: { line_user_id: userId, line_display_name: displayName },
    },
    metadata: { line_user_id: userId, line_display_name: displayName, plan },
    success_url: `${base}/signup/success`,
    cancel_url: `${base}/signup?plan=${plan}`,
  });

  return NextResponse.redirect(session.url!);
}
