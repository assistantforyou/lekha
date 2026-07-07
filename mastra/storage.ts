import { PostgresStore } from "@mastra/pg";
import { UpstashStore } from "@mastra/upstash";
import { redisCreds } from "@/lib/env";

/**
 * Resolve the Mastra storage backend.
 *
 * Priority:
 * 1. `DATABASE_URL` — managed Postgres from the Mastra Platform.
 * 2. Upstash Redis credentials (legacy / self-hosted).
 *
 * Returns undefined if no storage is configured.
 */
export function getStorage() {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    return new PostgresStore({ id: "lekha-pg", connectionString: databaseUrl });
  }

  try {
    const { url, token } = redisCreds();
    return new UpstashStore({ id: "lekha-storage", url, token });
  } catch {
    return undefined;
  }
}
