import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { UpstashVector } from "@mastra/upstash";
import { agentModel } from "@/lib/llm/provider";
import { env } from "@/lib/env";
import { buildLekhaTools, lekhaRequestContextSchema } from "../tools";
import { getStorage } from "../storage";

function createMemory() {
  // Mastra Memory is disabled for now. The agent runtime uses Redis-backed
  // rolling history (lib/memory/history.ts) loaded into the prompt directly.
  // This avoids a Mastra 1.50 bug where agent.generate returns an empty reply
  // when memory + the full Lekha system prompt are used together.
  return undefined;
}

function buildAgent(tier: "free" | "paid" = "free") {
  return new Agent({
    id: "lekha",
    name: "Lekha",
    instructions:
      "You are Lekha, a personal AI assistant living in LINE. " +
      "You help the user with tasks, reminders, email, calendar, memory, web search, " +
      "weather, finance, news, and documents. Be concise, helpful, and accurate.",
    model: agentModel(tier),
    memory: createMemory(),
    maxRetries: 3,
    requestContextSchema: lekhaRequestContextSchema,
    tools: async ({ requestContext }) => {
      const ctx = requestContext.all;
      return buildLekhaTools(ctx as any);
    },
  });
}

type LekhaAgent = ReturnType<typeof buildAgent>;

const agents: Partial<Record<"free" | "paid", LekhaAgent>> = {};

/** Lazy agent singleton — avoids validating env / instantiating memory at import time. */
export function getLekhaAgent(tier: "free" | "paid" = "free"): LekhaAgent {
  if (!agents[tier]) agents[tier] = buildAgent(tier);
  return agents[tier]!;
}
