import { redis } from "@/lib/memory/redis";
import { push, text as textMsg } from "@/lib/line/client";
import { listTasks } from "@/lib/memory/tasks";
import { taskCheckinFlex } from "@/lib/line/flex";

const ACTIVE_WINDOW_MS = 10 * 60 * 1000; // 10 min

/** Mark user as recently active (called from webhook on every inbound message). */
export async function markUserActive(userId: string): Promise<void> {
  await redis().set(`active:${userId}`, Date.now(), { ex: Math.ceil(ACTIVE_WINDOW_MS / 1000) });
}

/** Returns true if the user messaged the bot within the last 10 minutes. */
export async function isUserRecentlyActive(userId: string): Promise<boolean> {
  const val = await redis().get(`active:${userId}`);
  if (!val) return false;
  const ts = typeof val === "number" ? val : Number(val);
  return Date.now() - ts < ACTIVE_WINDOW_MS;
}

async function pushText(userId: string, text: string) {
  await push(userId, [textMsg(text)]);
}

export async function sweepTaskCheckIn(
  userId: string,
  _timezone: string,
  stats: { taskCheckIns: number },
): Promise<void> {
  try {
    const open = await listTasks(userId, "open");
    if (open.length === 0) return;
    const rows = open.slice(0, 10).map((t) => ({ id: t.id, title: t.title }));
    await push(userId, [taskCheckinFlex(rows)]);
    stats.taskCheckIns++;
  } catch (err) {
    console.warn("[sweep] task check-in failed", userId, err);
  }
}
