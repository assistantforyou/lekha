import { z } from "zod";

const Env = z.object({
  // LINE
  LINE_CHANNEL_SECRET: z.string().min(1),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().min(1),

  // LLM
  GEMINI_API_KEY: z.string().optional(),
  AI_GATEWAY_API_KEY: z.string().optional(), // legacy fallback

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),

  // Upstash Redis — Marketplace integration uses KV_REST_API_*, direct Upstash uses UPSTASH_REDIS_REST_*
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().min(1).optional(),

  // QStash
  QSTASH_TOKEN: z.string().optional(),
  QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().optional(),

  // Tavily
  TAVILY_API_KEY: z.string().optional(),

  // Upstash Vector (semantic archive search). Index must be dim 768 to match
  // Gemini text-embedding-004, with cosine similarity.
  UPSTASH_VECTOR_REST_URL: z.string().url().optional(),
  UPSTASH_VECTOR_REST_TOKEN: z.string().min(1).optional(),

  // Crypto
  TOKEN_ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/, "must be 64 hex chars"),
  OAUTH_STATE_SECRET: z.string().min(32),

  // LINE Login (web OAuth — separate from Messaging API)
  LINE_LOGIN_CHANNEL_ID: z.string().optional(),
  LINE_LOGIN_CHANNEL_SECRET: z.string().optional(),

  // Stripe (live)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_MONTHLY_PRICE_ID: z.string().optional(),
  STRIPE_YEARLY_PRICE_ID: z.string().optional(),
  // Stripe test mode — set STRIPE_TEST_MODE=true + the three vars below to use test keys without touching live ones
  STRIPE_TEST_MODE: z.string().optional(),
  STRIPE_TEST_SECRET_KEY: z.string().optional(),
  STRIPE_TEST_MONTHLY_PRICE_ID: z.string().optional(),
  STRIPE_TEST_YEARLY_PRICE_ID: z.string().optional(),

  // App
  APP_BASE_URL: z.string().url(),
  ADMIN_LINE_USER_ID: z.string().optional(),

  // Dev/test
  DEV_CHAT_SECRET: z.string().min(16).optional(),
});

export type EnvShape = z.infer<typeof Env>;

let cached: EnvShape | undefined;

export function env(): EnvShape {
  if (!cached) {
    const parsed = Env.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      throw new Error(`Invalid environment configuration:\n${issues}`);
    }
    cached = parsed.data;
  }
  return cached;
}

/** Resolve Upstash Redis credentials from either Marketplace (KV_*) or direct Upstash (UPSTASH_*) env vars. */
export function redisCreds(): { url: string; token: string } {
  const e = env();
  const url = e.UPSTASH_REDIS_REST_URL ?? e.KV_REST_API_URL;
  const token = e.UPSTASH_REDIS_REST_TOKEN ?? e.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Missing Redis credentials. Set UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN or KV_REST_API_URL/KV_REST_API_TOKEN.",
    );
  }
  return { url, token };
}

export function hasGoogleOAuth(): boolean {
  const e = env();
  return Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET && e.GOOGLE_REDIRECT_URI);
}

export function hasQStash(): boolean {
  const e = env();
  return Boolean(e.QSTASH_TOKEN && e.QSTASH_CURRENT_SIGNING_KEY);
}

export function hasUpstashVector(): boolean {
  const e = env();
  return Boolean(e.UPSTASH_VECTOR_REST_URL && e.UPSTASH_VECTOR_REST_TOKEN);
}
