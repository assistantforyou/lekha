import { env } from "@/lib/env";
import { redis } from "@/lib/memory/redis";
import type { Gate } from "@/lib/gate";

const TEAM_KEY = "users:team";
const ALLOWED_GROUPS_KEY = "groups:allowed";
const DISCOVERED_GROUPS_KEY = "groups:discovered";

export async function isTeamMember(userId: string): Promise<boolean> {
  return (await redis().sismember(TEAM_KEY, userId)) === 1;
}

export async function addToTeam(userId: string): Promise<void> {
  await redis().sadd(TEAM_KEY, userId);
}

export async function removeFromTeam(userId: string): Promise<void> {
  await redis().srem(TEAM_KEY, userId);
}

export async function listTeamMembers(): Promise<string[]> {
  return redis().smembers(TEAM_KEY);
}

export async function isGroupAllowed(groupId: string): Promise<boolean> {
  if (getAdminGroupIds().has(groupId)) return true;
  return (await redis().sismember(ALLOWED_GROUPS_KEY, groupId)) === 1;
}

export async function addAllowedGroup(groupId: string): Promise<void> {
  await redis().sadd(ALLOWED_GROUPS_KEY, groupId);
}

export async function removeAllowedGroup(groupId: string): Promise<void> {
  await redis().srem(ALLOWED_GROUPS_KEY, groupId);
}

export async function listAllowedGroups(): Promise<string[]> {
  return redis().smembers(ALLOWED_GROUPS_KEY);
}

export async function registerDiscoveredGroup(groupId: string): Promise<void> {
  await redis().sadd(DISCOVERED_GROUPS_KEY, groupId);
}

export async function listDiscoveredGroups(): Promise<string[]> {
  return redis().smembers(DISCOVERED_GROUPS_KEY);
}

export async function removeDiscoveredGroup(groupId: string): Promise<void> {
  await redis().srem(DISCOVERED_GROUPS_KEY, groupId);
}

export function getAdminGroupIds(): Set<string> {
  return new Set(
    (env().ADMIN_GROUP_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function getAdminUserIds(): string[] {
  return (env().ADMIN_LINE_USER_ID ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export type GroupAccessCheck = {
  userId: string;
  groupId: string;
  gate: Gate;
};

export async function hasGroupAccess({ userId, groupId, gate }: GroupAccessCheck): Promise<boolean> {
  if (gate.isAdmin(userId)) return true;
  if (await isGroupAllowed(groupId)) return true;
  if (await isTeamMember(userId)) return true;
  return false;
}
