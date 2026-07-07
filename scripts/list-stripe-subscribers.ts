import Stripe from "stripe";
import { env } from "../lib/env";

async function main() {
  const e = env();
  const testMode = e.STRIPE_TEST_MODE === "true";
  const stripeKey = testMode ? e.STRIPE_TEST_SECRET_KEY : e.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.log("Stripe not configured in this environment.");
    return;
  }
  const stripe = new Stripe(stripeKey);

  const subs = await stripe.subscriptions.list({
    status: "all",
    limit: 100,
    expand: ["data.customer"],
  });

  console.log(`Found ${subs.data.length} subscription(s):`);
  for (const sub of subs.data) {
    const meta = sub.metadata as Record<string, string>;
    const lineUserId = meta?.line_user_id ?? "(none)";
    const status = sub.status;
    const customer = sub.customer as Stripe.Customer | string;
    const email = typeof customer === "object" ? customer.email : "(unknown)";
    const currentPeriodEnd = new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000).toISOString();
    console.log(`- ${lineUserId} | status=${status} | email=${email ?? "(none)"} | current_period_end=${currentPeriodEnd}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
