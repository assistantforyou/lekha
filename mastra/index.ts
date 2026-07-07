import { Mastra } from "@mastra/core";
import { UpstashStore } from "@mastra/upstash";
import { redisCreds } from "@/lib/env";
import { lekhaAgent } from "./agents/lekha-agent";

function createStorage() {
  try {
    const { url, token } = redisCreds();
    return new UpstashStore({
      id: "lekha-storage",
      url,
      token,
    });
  } catch {
    return undefined;
  }
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
