import { NextResponse } from "next/server";
import { redis } from "@/lib/memory/redis";
import { env, hasGoogleOAuth, hasQStash, hasUpstashVector } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const r = redis();
  const start = Date.now();

  const [
    totalUsers,
    allowedUsers,
    pendingUsers,
    totalFacts,
    totalTasks,
    totalReminders,
    totalLists,
    totalScheduledEmails,
  ] = await Promise.all([
    r.zcard("users:active:window").catch(() => 0),
    r.scard("users:allowed").catch(() => 0),
    r.scard("users:pending").catch(() => 0),
    aggregateFacts(r),
    aggregateTasks(r),
    aggregateReminders(r),
    aggregateLists(r),
    aggregateScheduledEmails(r),
  ]);

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    ms: Date.now() - start,
    users: {
      total: totalUsers,
      allowed: allowedUsers,
      pending: pendingUsers,
      activeToday: await countActiveToday(r),
    },
    content: {
      facts: totalFacts,
      tasks: totalTasks,
      reminders: totalReminders,
      lists: totalLists,
      scheduledEmails: totalScheduledEmails,
    },
    infra: {
      googleOAuth: hasGoogleOAuth(),
      qStash: hasQStash(),
      upstashVector: hasUpstashVector(),
      tavily: Boolean(env().TAVILY_API_KEY),
      stripe: Boolean(env().STRIPE_SECRET_KEY),
    },
  });
}

async function aggregateFacts(r: ReturnType<typeof redis>): Promise<number> {
  try {
    const keys = await r.keys("user:*:facts:h");
    if (keys.length === 0) return 0;
    const counts = await Promise.all(keys.map((k) => r.hlen(k)));
    return counts.reduce((a, b) => a + b, 0);
  } catch {
    return 0;
  }
}

async function aggregateTasks(r: ReturnType<typeof redis>): Promise<number> {
  try {
    const keys = await r.keys("user:*:tasks:h");
    if (keys.length === 0) return 0;
    const counts = await Promise.all(keys.map((k) => r.hlen(k)));
    return counts.reduce((a, b) => a + b, 0);
  } catch {
    return 0;
  }
}

async function aggregateReminders(r: ReturnType<typeof redis>): Promise<number> {
  try {
    const keys = await r.keys("reminder:*:_list");
    if (keys.length === 0) return 0;
    const counts = await Promise.all(keys.map((k) => r.scard(k)));
    return counts.reduce((a, b) => a + b, 0);
  } catch {
    return 0;
  }
}

async function aggregateLists(r: ReturnType<typeof redis>): Promise<number> {
  try {
    const keys = await r.keys("lists:*:_names");
    if (keys.length === 0) return 0;
    const counts = await Promise.all(keys.map((k) => r.scard(k)));
    return counts.reduce((a, b) => a + b, 0);
  } catch {
    return 0;
  }
}

async function aggregateScheduledEmails(r: ReturnType<typeof redis>): Promise<number> {
  try {
    const keys = await r.keys("sched_email:*:_list");
    if (keys.length === 0) return 0;
    const counts = await Promise.all(keys.map((k) => r.scard(k)));
    return counts.reduce((a, b) => a + b, 0);
  } catch {
    return 0;
  }
}

async function countActiveToday(r: ReturnType<typeof redis>): Promise<number> {
  try {
    const keys = await r.keys("active:*");
    if (keys.length === 0) return 0;
    const dayStart = Date.now() - 24 * 60 * 60 * 1000;
    let count = 0;
    for (const k of keys) {
      const ts = await r.get<number>(k);
      if (ts && ts > dayStart) count++;
    }
    return count;
  } catch {
    return 0;
  }
}
