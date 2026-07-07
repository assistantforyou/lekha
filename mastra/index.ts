import { Mastra } from "@mastra/core";
import { UpstashStore } from "@mastra/upstash";
import { redisCreds } from "@/lib/env";
import { getLekhaAgent } from "./agents/lekha-agent";

let mastra: Mastra | undefined;

function createStorage() {
  try {
    const { url, token } = redisCreds();
    return new UpstashStore({ id: "lekha-storage", url, token });
  } catch {
    return undefined;
  }
}

function buildMastra(): Mastra {
  return new Mastra({
    storage: createStorage(),
    agents: { lekha: getLekhaAgent() },
  });
}

/** Lazy Mastra singleton — avoids env validation and heavy instantiation at import time. */
export function getMastra(): Mastra {
  if (!mastra) mastra = buildMastra();
  return mastra;
}
