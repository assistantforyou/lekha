import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { env } from "@/lib/env";
import { addToAllowlist, removeFromAllowlist } from "@/lib/memory/allowlist";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const e = env();
  if (!e.STRIPE_SECRET_KEY || !e.STRIPE_WEBHOOK_SECRET) {
    return new NextResponse("not configured", { status: 503 });
  }

  const stripe = new Stripe(e.STRIPE_SECRET_KEY);
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig!, e.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed", err);
    return new NextResponse("invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const lineUserId = session.metadata?.line_user_id;
    if (lineUserId) {
      await addToAllowlist(lineUserId);
      console.log(`[stripe-webhook] granted access to ${lineUserId} (checkout completed)`);
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
