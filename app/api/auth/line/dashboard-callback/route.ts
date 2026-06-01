import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
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

  // Atomically consume state nonce — try dashboard flow first, then signup flow.
  const dashboardStored = await redis().getdel<{ redirectTo?: string }>(`dashboard:state:${state}`);
  const signupStored = dashboardStored
    ? null
    : await redis().getdel<{ plan: "monthly" | "yearly" }>(`signup:state:${state}`);

  if (!dashboardStored && !signupStored) {
    return NextResponse.redirect(`${base}/?error=invalid_state`);
  }

  if (!e.LINE_LOGIN_CHANNEL_ID || !e.LINE_LOGIN_CHANNEL_SECRET) {
    const path = signupStored ? "/signup?error=not_configured" : "/?error=not_configured";
    return NextResponse.redirect(`${base}${path}`);
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
    console.error("[line-callback] token exchange failed", await tokenRes.text());
    const path = signupStored ? "/signup?error=line_token" : "/?error=line_token";
    return NextResponse.redirect(`${base}${path}`);
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string };

  // Get LINE user profile
  const profileRes = await fetch("https://api.line.me/v2/profile", {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!profileRes.ok) {
    const path = signupStored ? "/signup?error=line_profile" : "/?error=line_profile";
    return NextResponse.redirect(`${base}${path}`);
  }

  const { userId, displayName } = (await profileRes.json()) as {
    userId: string;
    displayName: string;
  };

  // ─── Signup flow ──────────────────────────────────────────────────────────
  if (signupStored) {
    const { plan } = signupStored;
    const testMode = e.STRIPE_TEST_MODE === "true";
    const stripeKey = testMode ? e.STRIPE_TEST_SECRET_KEY : e.STRIPE_SECRET_KEY;
    const monthlyPriceId = testMode ? e.STRIPE_TEST_MONTHLY_PRICE_ID : e.STRIPE_MONTHLY_PRICE_ID;
    const yearlyPriceId = testMode ? e.STRIPE_TEST_YEARLY_PRICE_ID : e.STRIPE_YEARLY_PRICE_ID;

    if (!stripeKey || !monthlyPriceId || !yearlyPriceId) {
      return NextResponse.redirect(`${base}/signup?error=stripe_not_configured`);
    }

    const priceId = plan === "yearly" ? yearlyPriceId : monthlyPriceId;
    const stripe = new Stripe(stripeKey);
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

  // ─── Dashboard flow ───────────────────────────────────────────────────────
  const redirectTo = dashboardStored?.redirectTo ?? "/dashboard";
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
