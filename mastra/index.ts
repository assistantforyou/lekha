import { Mastra } from "@mastra/core";
import { UpstashStore } from "@mastra/upstash";
import { env } from "@/lib/env";
import { lekhaAgent } from "./agents/lekha-agent";

function createStorage() {
  const e = env();
  if (!e.UPSTASH_REDIS_REST_URL || !e.UPSTASH_REDIS_REST_TOKEN) {
    return undefined;
  }
  return new UpstashStore({
    id: "lekha-storage",
    url: e.UPSTASH_REDIS_REST_URL,
    token: e.UPSTASH_REDIS_REST_TOKEN,
  });
}

/**
 * Mastra singleton for Lekha.
 *
 * Registers the main chat agent with Upstash-backed storage and memory.
 * Workflows will be added in later phases of the rewrite.
 */
export const mastra = new Mastra({
  storage: createStorage(),
  agents: { lekha: lekhaAgent },
});
