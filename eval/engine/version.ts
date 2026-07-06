import { CURRENT_VERSION as SETTINGS_VERSION } from "@/lib/memory/settings";

/**
 * Framework-level prompt version bump. Increment this whenever the evaluation
 * framework itself changes scoring/rules, separate from application prompt
 * changes tracked by SETTINGS_VERSION.
 */
const FRAMEWORK_VERSION = 1;

export function getPromptVersion(): string {
  return `${SETTINGS_VERSION}.${FRAMEWORK_VERSION}`;
}

export function getCommitHash(): string {
  try {
    // Avoid shelling out in browser; safe in Node CLI.
    if (typeof process !== "undefined" && process.cwd) {
      // Dynamic require so Next.js doesn't bundle child_process.
      const { execSync } = require("child_process") as typeof import("child_process");
      return execSync("git rev-parse --short HEAD", { cwd: process.cwd(), encoding: "utf8" }).trim();
    }
  } catch {
    // ignore
  }
  return "unknown";
}
