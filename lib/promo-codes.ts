import { redis } from "@/lib/memory/redis";
import { addToAllowlist } from "@/lib/memory/allowlist";
import { addToTeam } from "@/lib/group-access";
import { replyOrPush, text as textMsg } from "@/lib/line/client";

export type PromoGrant = "allowed" | "team";

export type PromoCode = {
  code: string;
  grant: PromoGrant;
  usesLeft: number;
  expiresAt: number;
  createdBy: string;
};

const CODE_PREFIX = "promo:code:";
const USED_PREFIX = "promo:used:";

function key(code: string) {
  return `${CODE_PREFIX}${code.toUpperCase()}`;
}

export async function createPromoCode(
  code: string,
  grant: PromoGrant,
  uses: number,
  expiresAt: number,
  createdBy: string,
): Promise<PromoCode> {
  const upper = code.toUpperCase();
  const data: PromoCode = { code: upper, grant, usesLeft: uses, expiresAt, createdBy };
  await redis().set(key(upper), data);
  return data;
}

export async function getPromoCode(code: string): Promise<PromoCode | null> {
  return redis().get<PromoCode>(key(code));
}

export async function listPromoCodes(): Promise<PromoCode[]> {
  const keys: string[] = [];
  let cursor = 0;
  do {
    const res = await redis().scan(cursor, { match: `${CODE_PREFIX}*`, count: 100 });
    cursor = Number(res[0]);
    keys.push(...(res[1] as string[]));
  } while (cursor !== 0);
  const codes: PromoCode[] = [];
  for (const k of keys) {
    const code = await redis().get<PromoCode>(k);
    if (code) codes.push(code);
  }
  return codes.sort((a, b) => b.expiresAt - a.expiresAt);
}

export async function deletePromoCode(code: string): Promise<void> {
  await redis().del(key(code));
}

export type RedeemResult =
  | { ok: true; grant: PromoGrant; message: string }
  | { ok: false; error: string };

export async function redeemPromoCode(userId: string, code: string): Promise<RedeemResult> {
  const upper = code.toUpperCase();
  const promo = await getPromoCode(upper);
  if (!promo) return { ok: false, error: "That code doesn't exist." };
  if (promo.expiresAt > 0 && promo.expiresAt < Date.now()) {
    return { ok: false, error: "That code has expired." };
  }
  if (promo.usesLeft === 0) return { ok: false, error: "That code has already been used up." };

  const usedKey = `${USED_PREFIX}${userId}`;
  const alreadyUsed = (await redis().sismember(usedKey, upper)) === 1;
  if (alreadyUsed) return { ok: false, error: "You already used that code." };

  if (promo.grant === "allowed") {
    await addToAllowlist(userId);
  } else {
    await addToTeam(userId);
  }

  await redis().sadd(usedKey, upper);
  if (promo.usesLeft > 0) {
    promo.usesLeft -= 1;
    await redis().set(key(upper), promo);
  }

  const label = promo.grant === "allowed" ? "personal access" : "Team access";
  return { ok: true, grant: promo.grant, message: `Redeemed! You now have ${label}.` };
}

const PROMO_RE = /^\/promo\s+(\S+)$/i;

export async function handlePromoCommand(userId: string, userText: string, replyToken: string): Promise<boolean> {
  const match = userText.match(PROMO_RE);
  if (!match) return false;
  const code = match[1]!;
  const result = await redeemPromoCode(userId, code);
  console.warn("[promo] redeem attempt", { userId, code, ok: result.ok, detail: result.ok ? result.grant : result.error });
  await replyOrPush(userId, replyToken, [textMsg(result.ok ? result.message : `❌ ${result.error}`)]);
  return true;
}
