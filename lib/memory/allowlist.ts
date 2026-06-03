import { redis } from "./redis";
import { registerUser, unregisterUser } from "./user-registry";

const ALLOW_KEY = "users:allowed";
const PENDING_KEY = "users:pending";
const pendingHashKey = (userId: string) => `pending:${userId}`;
const adminNotifKey = (userId: string) => `pending_notif:${userId}`;

export async function isAllowed(userId: string): Promise<boolean> {
  return (await redis().sismember(ALLOW_KEY, userId)) === 1;
}
export async function addToAllowlist(userId: string): Promise<void> {
  await redis().sadd(ALLOW_KEY, userId);
  await registerUser(userId).catch(() => {});
}
export async function removeFromAllowlist(userId: string): Promise<void> {
  await redis().srem(ALLOW_KEY, userId);
  await unregisterUser(userId).catch(() => {});
}
export async function listAllowed(): Promise<string[]> {
  return redis().smembers(ALLOW_KEY);
}

export type PendingInfo = {
  displayName: string;
  requestedAt: number;
  message?: string;
};

export async function isPending(userId: string): Promise<boolean> {
  return (await redis().sismember(PENDING_KEY, userId)) === 1;
}

export async function addToPending(userId: string, info: PendingInfo): Promise<void> {
  await redis().sadd(PENDING_KEY, userId);
  await redis().hset(pendingHashKey(userId), {
    displayName: info.displayName,
    requestedAt: String(info.requestedAt),
    message: info.message ?? "",
  });
}

export async function removeFromPending(userId: string): Promise<void> {
  await redis().srem(PENDING_KEY, userId);
  await redis().del(pendingHashKey(userId));
}

export async function listPending(): Promise<string[]> {
  return redis().smembers(PENDING_KEY);
}

export async function getPendingInfo(userId: string): Promise<PendingInfo | null> {
  const h = await redis().hgetall<Record<string, string>>(pendingHashKey(userId));
  if (!h || !h.requestedAt) return null;
  return {
    displayName: h.displayName ?? "",
    requestedAt: Number(h.requestedAt),
    message: h.message || undefined,
  };
}

// Returns true if we should notify the admin about this pending user now
// (at most once per minute per requesting user, to avoid notification spam).
export async function shouldNotifyAdminOfPending(userId: string): Promise<boolean> {
  const set = await redis().set(adminNotifKey(userId), 1, { ex: 60, nx: true });
  return set !== null;
}

// Move userId from pending → allowed. Returns true if the user was in pending.
export async function approvePending(userId: string): Promise<boolean> {
  const wasPending = (await redis().srem(PENDING_KEY, userId)) === 1;
  await redis().del(pendingHashKey(userId));
  await redis().sadd(ALLOW_KEY, userId);
  await registerUser(userId).catch(() => {});
  return wasPending;
}

// Remove userId from pending without approving. Returns true if it was there.
export async function denyPending(userId: string): Promise<boolean> {
  const wasPending = (await redis().srem(PENDING_KEY, userId)) === 1;
  await redis().del(pendingHashKey(userId));
  return wasPending;
}
