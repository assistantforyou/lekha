import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { UpstashStore, UpstashVector } from "@mastra/upstash";
import { googleClient } from "@/lib/llm/provider";
import { env, redisCreds } from "@/lib/env";
import { buildLekhaTools, lekhaRequestContextSchema } from "../tools";

function createMemory() {
  const e = env();

  let storage;
  try {
    const creds = redisCreds();
    storage = new UpstashStore({
      id: "lekha-memory",
      url: creds.url,
      token: creds.token,
    });
  } catch {
    return undefined;
  }

  if (!e.UPSTASH_VECTOR_REST_URL || !e.UPSTASH_VECTOR_REST_TOKEN) {
    return undefined;
  }

  return new Memory({
    storage,
    vector: new UpstashVector({
      id: "lekha-vector",
      url: e.UPSTASH_VECTOR_REST_URL,
      token: e.UPSTASH_VECTOR_REST_TOKEN,
    }),
    embedder: googleClient().textEmbeddingModel("gemini-embedding-001"),
    embedderOptions: { providerOptions: { google: { outputDimensionality: 768 } } },
    options: {
      lastMessages: 35,
      semanticRecall: {
        topK: 3,
        messageRange: 2,
        scope: "thread",
      },
      workingMemory: { enabled: true, scope: "resource" },
    },
  });
}

function buildAgent() {
  return new Agent({
    id: "lekha",
    name: "Lekha",
    instructions:
      "You are Lekha, a personal AI assistant living in LINE. " +
      "You help the user with tasks, reminders, email, calendar, memory, web search, " +
      "weather, finance, news, and documents. Be concise, helpful, and accurate.",
    model: googleClient()("gemini-2.5-flash"),
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

let agent: LekhaAgent | undefined;

/** Lazy agent singleton — avoids validating env / instantiating memory at import time. */
export function getLekhaAgent(): LekhaAgent {
  if (!agent) agent = buildAgent();
  return agent;
}
