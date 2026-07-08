import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

const COOKIE_NAME = "lekha_session";

function secret(): Uint8Array {
  const e = env();
  if (e.DASHBOARD_JWT_SECRET) {
    return new TextEncoder().encode(e.DASHBOARD_JWT_SECRET);
  }
  // Backwards compatibility: existing deploys may only have OAUTH_STATE_SECRET.
  console.warn("[dashboard-auth] DASHBOARD_JWT_SECRET not set; falling back to OAUTH_STATE_SECRET");
  return new TextEncoder().encode(e.OAUTH_STATE_SECRET);
}

export async function signSession(userId: string, displayName: string): Promise<string> {
  return new SignJWT({ userId, displayName })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function verifySession(token: string): Promise<{ userId: string; displayName: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { clockTolerance: 60 });
    if (!payload.userId || typeof payload.userId !== "string") return null;
    return {
      userId: payload.userId,
      displayName: typeof payload.displayName === "string" ? payload.displayName : "User",
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<{ userId: string; displayName: string } | null> {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export function sessionCookieOpts() {
  const e = env();
  const secure = e.APP_BASE_URL.startsWith("https://");
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };
}
