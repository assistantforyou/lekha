import { vi } from "vitest";

export const TEST_ENV = {
  TOKEN_ENCRYPTION_KEY: "a".repeat(64),
  OAUTH_STATE_SECRET: "b".repeat(32),
  DEV_CHAT_SECRET: "dev-secret",
  GEMINI_API_KEY: "test-gemini-key",
  // No QStash → proactive scheduling becomes a no-op.
  QSTASH_TOKEN: undefined,
  QSTASH_CURRENT_SIGNING_KEY: undefined,
  QSTASH_NEXT_SIGNING_KEY: undefined,
  APP_BASE_URL: "https://lekha-iota.vercel.app",
  ADMIN_LINE_USER_ID: "U_admin",
};

export function createEnvMock() {
  return {
    env: vi.fn(() => TEST_ENV as unknown as Record<string, string | undefined>),
    hasGoogleOAuth: vi.fn(() => false),
    hasQStash: vi.fn(() => false),
    hasUpstashVector: vi.fn(() => false),
    hasBlobStorage: vi.fn(() => false),
    redisCreds: vi.fn(() => ({
      url: "http://localhost:6379",
      token: "test-token",
    })),
  };
}
