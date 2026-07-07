import { env } from "@/lib/env";
import { span } from "@/lib/timing";

const API = "https://api.line.me/v2/bot";

function authHeaders() {
  return { Authorization: `Bearer ${env().LINE_CHANNEL_ACCESS_TOKEN}` };
}

function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 10000, ...rest } = init;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { ...rest, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

async function safeText(r: Response): Promise<string> {
  try {
    return await r.text();
  } catch {
    return "";
  }
}

export async function getGroupMemberProfile(groupId: string, userId: string): Promise<{ displayName: string } | null> {
  const end = span("line:getGroupMemberProfile");
  const r = await fetchWithTimeout(`${API}/group/${groupId}/member/${userId}`, { headers: authHeaders() });
  end({ ok: r.ok, status: r.status });
  if (!r.ok) {
    console.warn("[line] getGroupMemberProfile failed", r.status, await safeText(r));
    return null;
  }
  return (await r.json()) as { displayName: string };
}

export async function getRoomMemberProfile(roomId: string, userId: string): Promise<{ displayName: string } | null> {
  const end = span("line:getRoomMemberProfile");
  const r = await fetchWithTimeout(`${API}/room/${roomId}/member/${userId}`, { headers: authHeaders() });
  end({ ok: r.ok, status: r.status });
  if (!r.ok) {
    console.warn("[line] getRoomMemberProfile failed", r.status, await safeText(r));
    return null;
  }
  return (await r.json()) as { displayName: string };
}

export async function getConversationMemberProfile(conversationId: string, userId: string): Promise<{ displayName: string } | null> {
  const [kind, id] = conversationId.split(":", 2);
  if (!id) return null;
  if (kind === "group") return getGroupMemberProfile(id, userId);
  if (kind === "room") return getRoomMemberProfile(id, userId);
  return null;
}

export async function leaveGroup(groupId: string): Promise<boolean> {
  const end = span("line:leaveGroup");
  const r = await fetchWithTimeout(`${API}/group/${groupId}/leave`, {
    method: "POST",
    headers: authHeaders(),
  });
  end({ ok: r.ok, status: r.status });
  if (!r.ok) console.warn("[line] leaveGroup failed", r.status, await safeText(r));
  return r.ok;
}

export async function leaveRoom(roomId: string): Promise<boolean> {
  const end = span("line:leaveRoom");
  const r = await fetchWithTimeout(`${API}/room/${roomId}/leave`, {
    method: "POST",
    headers: authHeaders(),
  });
  end({ ok: r.ok, status: r.status });
  if (!r.ok) console.warn("[line] leaveRoom failed", r.status, await safeText(r));
  return r.ok;
}
