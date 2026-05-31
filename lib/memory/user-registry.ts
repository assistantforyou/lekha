import { redis } from "./redis";
import { syncAllProactiveSchedules } from "@/lib/proactive-schedules";

const REGISTRY_KEY = "users:active";

/**
 * Track every LINE userId we've seen at least once. Creates per-user QStash
 * schedules for proactive fixed-time events (morning briefing, evening summary,
 * task check-in) if the user has them enabled.
 */
export async function registerUser(userId: string): Promise<void> {
  await redis().sadd(REGISTRY_KEY, userId);
  try {
    await syncAllProactiveSchedules(userId);
  } catch (e) {
    console.error("[registry] failed to sync schedules for", userId, e);
  }
}

export async function listAllUsers(): Promise<string[]> {
  return await redis().smembers(REGISTRY_KEY);
}

export async function unregisterUser(userId: string): Promise<void> {
  await redis().srem(REGISTRY_KEY, userId);
}
