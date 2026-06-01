import { NextResponse } from "next/server";
import { redis } from "@/lib/memory/redis";
import { getSession } from "@/lib/dashboard-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = session;
  const r = redis();
  const start = Date.now();

  const [
    profileRaw,
    settingsRaw,
    factsRaw,
    historyLen,
    turnCount,
    tasks,
    archiveLen,
    sentLen,
    reminders,
    lists,
    googleAccountsRaw,
    receiptsLen,
  ] = await Promise.all([
    r.get<string>(`user:${userId}:profile`).catch(() => null),
    r.get<string>(`user:${userId}:settings`).catch(() => null),
    r.get<string>(`user:${userId}:facts:v2`).catch(() => null),
    r.llen(`user:${userId}:history`).catch(() => 0),
    r.get<number>(`user:${userId}:turn_counter`).catch(() => 0),
    r.lrange<string>(`user:${userId}:tasks`, 0, -1).catch(() => []),
    r.llen(`user:${userId}:archive`).catch(() => 0),
    r.llen(`user:${userId}:sent`).catch(() => 0),
    listReminders(r, userId),
    listLists(r, userId),
    r.get<string>(`google:accounts:${userId}`).catch(() => null),
    r.llen(`receipts:${userId}`).catch(() => 0),
  ]);

  const profile = safeJson<{ displayName?: string; joinedAt?: number }>(profileRaw);
  const settings = safeJson<Record<string, unknown>>(settingsRaw);
  const facts = safeJson<{ facts?: Array<{ category: string; content: string; createdAt: number }> }>(factsRaw);
  const googleAccounts = safeJson<{ accounts?: Array<{ email: string; addedAt: number }> }>(googleAccountsRaw);

  const taskList = tasks
    .map((t) => safeJson<{ id: string; title: string; completed: boolean; createdAt: number }>(t))
    .filter((t): t is { id: string; title: string; completed: boolean; createdAt: number } => t !== null);

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    ms: Date.now() - start,
    user: {
      userId,
      displayName: profile?.displayName ?? session.displayName,
      joinedAt: profile?.joinedAt ?? null,
    },
    activity: {
      totalTurns: turnCount,
      historyMessages: historyLen,
      archiveEntries: archiveLen,
      sentActions: sentLen,
      receiptsScanned: receiptsLen,
    },
    memory: {
      factCount: facts?.facts?.length ?? 0,
      facts: (facts?.facts ?? []).slice(0, 20),
    },
    tasks: {
      total: taskList.length,
      open: taskList.filter((t) => !t.completed).length,
      completed: taskList.filter((t) => t.completed).length,
      recent: taskList.slice(0, 10),
    },
    reminders,
    lists,
    connections: {
      googleAccounts: googleAccounts?.accounts?.map((a) => a.email) ?? [],
      googleAccountCount: googleAccounts?.accounts?.length ?? 0,
    },
    settings: settings
      ? {
          timezone: settings.timezone ?? "—",
          locale: settings.locale ?? "—",
          language: settings.language ?? "—",
          morningBriefingEnabled: settings.morningBriefingEnabled ?? false,
          morningBriefingTime: settings.morningBriefingTime ?? "—",
          eveningSummaryEnabled: settings.eveningSummaryEnabled ?? false,
          eveningSummaryTime: settings.eveningSummaryTime ?? "—",
        }
      : null,
  });
}

async function listReminders(r: ReturnType<typeof redis>, userId: string) {
  try {
    const ids = await r.smembers(`reminder:${userId}:_list`);
    if (ids.length === 0) return { total: 0, upcoming: 0, recent: [] as unknown[] };
    const items = await r.mget<string[]>(...ids.map((id) => `reminder:${userId}:${id}`));
    const parsed = items
      .map((item) => safeJson<{ message?: string; when?: number; recurring?: boolean }>(item))
      .filter((p): p is { message?: string; when?: number; recurring?: boolean } => p !== null);
    const now = Date.now();
    return {
      total: parsed.length,
      upcoming: parsed.filter((p) => (p.when ?? 0) > now).length,
      recent: parsed.slice(0, 10),
    };
  } catch {
    return { total: 0, upcoming: 0, recent: [] };
  }
}

async function listLists(r: ReturnType<typeof redis>, userId: string) {
  try {
    const names = await r.smembers(`lists:${userId}:_names`);
    if (names.length === 0) return { total: 0, items: [] as Array<{ name: string; count: number }> };
    const counts = await Promise.all(
      names.map(async (name) => ({
        name,
        count: await r.llen(`lists:${userId}:${name}`),
      })),
    );
    return { total: names.length, items: counts };
  } catch {
    return { total: 0, items: [] };
  }
}

function safeJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
