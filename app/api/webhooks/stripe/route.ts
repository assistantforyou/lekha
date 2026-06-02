import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { env } from "@/lib/env";
import { addToAllowlist, removeFromAllowlist } from "@/lib/memory/allowlist";
import { push, text as textMsg, getProfile } from "@/lib/line/client";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const e = env();
  const testMode = e.STRIPE_TEST_MODE === "true";
  const stripeKey = testMode ? e.STRIPE_TEST_SECRET_KEY : e.STRIPE_SECRET_KEY;
  const webhookSecret = testMode ? e.STRIPE_TEST_WEBHOOK_SECRET : e.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return new NextResponse("not configured", { status: 503 });
  }

  const stripe = new Stripe(stripeKey);
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig!, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed", err);
    return new NextResponse("invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const lineUserId = session.metadata?.line_user_id;
    const customerEmail = session.customer_details?.email;
    if (lineUserId) {
      await addToAllowlist(lineUserId);
      console.log(`[stripe-webhook] granted access to ${lineUserId} (checkout completed)`);
      const profile = await getProfile(lineUserId);
      const name = profile?.displayName ? ` ${profile.displayName}` : "";
      await push(lineUserId, [
        textMsg(
          `You're in! 🎉 Welcome to Lekha${name}!\n\nI'm your personal AI assistant. I can set reminders, search the web, check weather and stocks, read photos, and much more.\n\nType "help" to see everything I can do, or "connect google" to link Gmail, Calendar, and Drive.`,
        ),
      ]);
    }
    if (customerEmail) {
      const adminIds = (e.ADMIN_LINE_USER_ID ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const adminId of adminIds) {
        await push(adminId, [
          textMsg(
            `💳 New subscriber: ${customerEmail}\n\nAdd to Google OAuth test users:\nhttps://console.cloud.google.com/apis/credentials/consent`,
          ),
        ]).catch(() => {});
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const lineUserId = (subscription.metadata as Record<string, string>)?.line_user_id;
    if (lineUserId) {
      await removeFromAllowlist(lineUserId);
      console.log(`[stripe-webhook] revoked access for ${lineUserId} (subscription deleted)`);
    }
  }

  return NextResponse.json({ ok: true });
}
