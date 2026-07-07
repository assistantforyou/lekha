import { Mastra } from "@mastra/core";
import { getLekhaAgent } from "./agents/lekha-agent";
import { getStorage } from "./storage";

/**
 * Mastra instance exported for the Mastra Platform deployer.
 *
 * The Platform's build statically analyzes `mastra/index.ts` and expects a
 * top-level `export const mastra = new Mastra({...})` entry point.
 */
export const mastra = new Mastra({
  storage: getStorage(),
  agents: { lekha: getLekhaAgent() },
});

/** Lazy accessor used by Next.js routes (returns the same singleton). */
export function getMastra(): Mastra {
  return mastra;
}
