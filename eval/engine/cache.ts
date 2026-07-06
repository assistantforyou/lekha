import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { Scenario, RunRecord } from "./types";

const CACHE_DIR = join(process.cwd(), "eval", "results", "cache");

function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
}

function cacheKey(scenario: Scenario, promptVersion: string, model: string): string {
  const payload = JSON.stringify({
    id: scenario.id,
    userText: scenario.userText,
    history: scenario.history,
    state: scenario.state?.toString(),
    promptVersion,
    model,
  });
  return createHash("sha256").update(payload).digest("hex");
}

export function cachedResultExists(scenario: Scenario, promptVersion: string, model: string): boolean {
  ensureCacheDir();
  const key = cacheKey(scenario, promptVersion, model);
  return existsSync(join(CACHE_DIR, `${key}.json`));
}

export function readCachedResult(scenario: Scenario, promptVersion: string, model: string): RunRecord | null {
  ensureCacheDir();
  const key = cacheKey(scenario, promptVersion, model);
  const path = join(CACHE_DIR, `${key}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as RunRecord;
  } catch {
    return null;
  }
}

export function writeCachedResult(
  scenario: Scenario,
  promptVersion: string,
  model: string,
  record: RunRecord,
): void {
  ensureCacheDir();
  const key = cacheKey(scenario, promptVersion, model);
  writeFileSync(join(CACHE_DIR, `${key}.json`), JSON.stringify(record, null, 2));
}

export function clearCache(): void {
  ensureCacheDir();
  // No-op for safety; implement if needed.
}
