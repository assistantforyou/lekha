import { redis } from "@/lib/memory/redis";
import { registerUser } from "@/lib/memory/user-registry";
import { replyOrPush, text as textMsg } from "@/lib/line/client";
import { startOnboarding } from "@/lib/onboarding";
import { TRIAL_DAILY_LIMIT } from "@/lib/trial-constants";

export { TRIAL_DAILY_LIMIT };
const TRIAL_SET_KEY = "users:trial";

export async function isOnTrial(userId: string): Promise<boolean> {
  return (await redis().sismember(TRIAL_SET_KEY, userId)) === 1;
}

export async function addToTrial(userId: string): Promise<void> {
  await redis().sadd(TRIAL_SET_KEY, userId);
  await registerUser(userId).catch(() => {});
}

export async function removeFromTrial(userId: string): Promise<void> {
  await redis().srem(TRIAL_SET_KEY, userId);
}

function parseOffset(parts: Intl.DateTimeFormatPart[]): number {
  const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  const m = tzName.match(/([+-])(\d{2}):(\d{2})/);
  if (!m) return 0;
  const sign = m[1] === "+" ? 1 : -1;
  const hours = Number(m[2]) || 0;
  const mins = Number(m[3]) || 0;
  return sign * (hours * 60 + mins) * 60 * 1000;
}

function localDateParts(timezone: string, ts = Date.now()) {
  const d = new Date(ts);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "longOffset",
  });
  const parts = fmt.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    offsetMs: parseOffset(parts),
  };
}

function localDateString(timezone: string, ts = Date.now()): string {
  const { year, month, day } = localDateParts(timezone, ts);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function nextMidnightLocalMs(timezone: string, ts = Date.now()): number {
  const { year, month, day, offsetMs } = localDateParts(timezone, ts);
  let candidate = Date.UTC(year, month - 1, day, 0, 0, 0) - offsetMs;
  if (candidate > ts) candidate -= 24 * 60 * 60 * 1000;
  return candidate + 24 * 60 * 60 * 1000;
}

export async function checkTrialDailyQuota(
  userId: string,
  timezone = "Asia/Bangkok",
): Promise<{ ok: boolean; used: number; remaining: number; resetsAt: Date }> {
  const dateStr = localDateString(timezone);
  const key = `trial:quota:${userId}:${dateStr}`;
  const used = await redis().incr(key);
  if (used === 1) {
    await redis().expire(key, 60 * 60 * 50);
  }
  const remaining = Math.max(0, TRIAL_DAILY_LIMIT - used);
  const resetsAt = new Date(nextMidnightLocalMs(timezone));
  return { ok: used <= TRIAL_DAILY_LIMIT, used, remaining, resetsAt };
}

export function trialQuotaMessage(lang: "en" | "th" | null, resetsAt: Date): string {
  const timeStr = resetsAt.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  });
  if (lang === "th") {
    return `คุณใช้ข้อความทดลองใช้ฟรีครบ ${TRIAL_DAILY_LIMIT} ข้อความแล้วในวันนี้ ส่งข้อความเพิ่มได้อีกครั้งพรุ่งนี้ (00:00 UTC / 07:00 น. เวลาไทย)`;
  }
  if (lang === "en") {
    return `You've used your ${TRIAL_DAILY_LIMIT} free trial messages for today. You can send more messages tomorrow at ${timeStr} UTC.`;
  }
  return `You've used your ${TRIAL_DAILY_LIMIT} free trial messages for today. You can send more messages tomorrow at ${timeStr} UTC.\n\nคุณใช้ข้อความทดลองใช้ฟรีครบ ${TRIAL_DAILY_LIMIT} ข้อความแล้วในวันนี้ ส่งข้อความเพิ่มได้อีกครั้งพรุ่งนี้`;
}

export async function startTrial(
  userId: string,
  replyToken: string,
  displayName = "",
): Promise<void> {
  await addToTrial(userId);
  const name = displayName ? ` ${displayName}` : "";
  await replyOrPush(userId, replyToken, [
    textMsg(
      `Free trial started! 🎉 Welcome to Lekha${name}!\n\nLet's get you set up in 30 seconds.\n\nทดลองใช้ฟรีเริ่มต้นแล้ว! 🎉 ยินดีต้อนรับสู่ Lekha${name}!\n\nมาตั้งค่าบัญชีของคุณใน 30 วินาทีกัน`,
    ),
  ]);
  await startOnboarding(userId, replyToken, displayName, true);
}
