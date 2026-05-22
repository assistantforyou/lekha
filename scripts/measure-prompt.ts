/**
 * Token cost audit for the Lekha production prompt.
 *
 * Minimum env vars required (set in environment or .env.local):
 *   GEMINI_API_KEY          — Gemini API key (countTokens is free, no billing)
 *   UPSTASH_REDIS_REST_URL  — Upstash Redis REST URL
 *   UPSTASH_REDIS_REST_TOKEN — Upstash Redis REST token
 *   USER_ID                 — LINE userId to load real data for
 *
 * Usage:
 *   USER_ID=Uxxxxx npx tsx scripts/measure-prompt.ts
 *   npx tsx scripts/measure-prompt.ts <userId>
 *
 * Reads .env.local if present, then falls back to process.env.
 * lib/env.ts requires several fields the script doesn't use — safe dummy
 * values are set for those so the Zod validation passes.
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local BEFORE calling any production function.
// All production modules are lazily initialized (env(), redis(), etc.),
// so setting process.env here is safe — imports only define functions.
const envFile = resolve(process.cwd(), ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    const key = m[1] as string;
    const rawVal = (m[2] as string).trim();
    if (!process.env[key]) {
      process.env[key] = rawVal.replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

// lib/env.ts validates several fields this script doesn't actually use.
// Set safe dummy values so Zod passes without requiring the caller to supply them.
const DUMMY_HEX64 = "0".repeat(64);
process.env.LINE_CHANNEL_SECRET ??= "dummy-secret";
process.env.LINE_CHANNEL_ACCESS_TOKEN ??= "dummy-token";
process.env.TOKEN_ENCRYPTION_KEY ??= DUMMY_HEX64;
process.env.OAUTH_STATE_SECRET ??= "dummy-oauth-state-secret-at-least-32-chars";
process.env.APP_BASE_URL ??= "https://dummy.example.com";

// Production imports — these only define functions, nothing executes yet.
import { buildSystemPrompt, BASE_PERSONALITY } from "@/lib/llm/prompts";
import { toolsForUser } from "@/lib/tools";
import { loadFacts, factsToPromptBlock } from "@/lib/memory/facts";
import { getOrCreateProfile } from "@/lib/memory/profile";
import { loadHistory } from "@/lib/memory/history";
import { listAccounts } from "@/lib/tools/google-auth";
import { listRecentMedia } from "@/lib/memory/recent-media";
import { getSettings } from "@/lib/memory/settings";
import { asSchema } from "@ai-sdk/provider-utils";

// ── Config ────────────────────────────────────────────────────────────────

const rawUserId = process.argv[2] ?? process.env.USER_ID;
if (!rawUserId) {
  console.error(
    "Usage: USER_ID=Uxxxxx npx tsx scripts/measure-prompt.ts\n" +
      "       npx tsx scripts/measure-prompt.ts <userId>",
  );
  process.exit(1);
}
// Explicit string type so TypeScript carries the narrowing into main().
const userId: string = rawUserId;

const apiKey = process.env.GEMINI_API_KEY ?? process.env.AI_GATEWAY_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY not found in environment or .env.local");
  process.exit(1);
}

const MODEL = "gemini-2.5-flash-lite";
const COUNT_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:countTokens` +
  `?key=${apiKey}`;

// ── Gemini REST types ─────────────────────────────────────────────────────

type GPart = { text: string };
type GContent = { role: "user" | "model"; parts: GPart[] };
type GFunctionDecl = {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
};
type GTool = { functionDeclarations: GFunctionDecl[] };
type GSysInstruction = { parts: GPart[] };

// ── countTokens REST call ─────────────────────────────────────────────────
// systemInstruction and tools must live inside generateContentRequest —
// the top-level countTokens body only accepts contents or generateContentRequest.

async function countTokens(opts: {
  system?: GSysInstruction;
  tools?: GTool[];
  contents?: GContent[];
}): Promise<number> {
  const contents = opts.contents ?? [{ role: "user" as const, parts: [{ text: " " }] }];

  // If we have system or tools we must use the generateContentRequest wrapper.
  const body: Record<string, unknown> =
    opts.system || opts.tools?.length
      ? {
          generateContentRequest: {
            model: `models/${MODEL}`,
            ...(opts.system ? { systemInstruction: opts.system } : {}),
            ...(opts.tools?.length ? { tools: opts.tools } : {}),
            contents,
          },
        }
      : { contents };

  const res = await fetch(COUNT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini countTokens HTTP ${res.status}: ${err.slice(0, 400)}`);
  }

  const data = (await res.json()) as { totalTokens?: number };
  return data.totalTokens ?? 0;
}

// ── JSON Schema → Gemini OpenAPI schema ──────────────────────────────────
// Gemini function declarations accept a limited OpenAPI subset — not raw JSON Schema 7.
// This mirrors the conversion logic in @ai-sdk/google (not exported from that package).

type GSchema = Record<string, unknown>;

function toGeminiSchema(s: GSchema, isRoot = true): GSchema | undefined {
  if (s == null) return undefined;
  if (typeof s === "boolean") return { type: "boolean", properties: {} };

  // Empty object at root = no parameters (Gemini wants undefined, not {})
  if (isRoot && Object.keys(s).length === 0) return undefined;

  const {
    type,
    description,
    required,
    properties,
    items,
    anyOf,
    format,
    const: constValue,
    minLength,
    enum: enumValues,
  } = s as {
    type?: string | string[];
    description?: string;
    required?: string[];
    properties?: Record<string, GSchema>;
    items?: GSchema;
    anyOf?: GSchema[];
    format?: string;
    const?: unknown;
    minLength?: number;
    enum?: unknown[];
  };

  const out: GSchema = {};
  if (description) out.description = description;
  if (required) out.required = required;
  if (format) out.format = format;
  if (constValue !== undefined) out.enum = [constValue];
  if (enumValues !== undefined) out.enum = enumValues;
  if (minLength !== undefined) out.minLength = minLength;

  if (type !== undefined) {
    if (Array.isArray(type)) {
      const hasNull = type.includes("null");
      const nonNull = type.filter((t) => t !== "null");
      if (nonNull.length === 0) {
        out.type = "null";
      } else if (nonNull.length === 1) {
        out.type = nonNull[0];
        if (hasNull) out.nullable = true;
      } else {
        out.anyOf = nonNull.map((t) => ({ type: t }));
        if (hasNull) out.nullable = true;
      }
    } else {
      out.type = type;
    }
  }

  if (properties) {
    out.properties = Object.fromEntries(
      Object.entries(properties).map(([k, v]) => [k, toGeminiSchema(v, false)]),
    );
  }
  if (items) out.items = toGeminiSchema(items, false);

  if (anyOf) {
    const hasNull = anyOf.some((a) => (a as GSchema).type === "null");
    const nonNull = anyOf.filter((a) => (a as GSchema).type !== "null");
    if (hasNull && nonNull.length === 1 && nonNull[0]) {
      return { ...toGeminiSchema(nonNull[0], false), nullable: true };
    }
    out.anyOf = anyOf.map((a) => toGeminiSchema(a, false));
  }

  return out;
}

// ── Tool → Gemini function declaration ───────────────────────────────────

function toFuncDecl(
  name: string,
  tool: { description?: string; inputSchema: unknown },
): GFunctionDecl {
  const schema = asSchema(tool.inputSchema as Parameters<typeof asSchema>[0]);
  const raw = schema.jsonSchema as GSchema;
  const parameters = toGeminiSchema(raw, true);
  return {
    name,
    description: tool.description ?? "",
    ...(parameters ? { parameters } : {}),
  };
}

// ── History → Gemini contents ─────────────────────────────────────────────

function histToContents(hist: Array<{ role: string; content: string }>): GContent[] {
  return hist.map((t) => ({
    role: (t.role === "user" ? "user" : "model") as "user" | "model",
    parts: [{ text: t.content || " " }],
  }));
}

// ── Helpers ────────────────────────────────────────────────────────────────

const DUMMY: GContent[] = [{ role: "user", parts: [{ text: " " }] }];
const MIN_SYS: GSysInstruction = { parts: [{ text: " " }] };

function pad(s: string, n: number) {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}
function rpad(n: number, w: number) {
  return n.toString().padStart(w);
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nLoading user data for ${userId}…`);

  const [facts, profile, history, accounts, staged, settings] = await Promise.all([
    loadFacts(userId),
    getOrCreateProfile(userId).catch(() => ({ displayName: "friend", joinedAt: Date.now() })),
    loadHistory(userId),
    listAccounts(userId),
    listRecentMedia(userId),
    getSettings(userId),
  ]);

  // Build system prompt — exact replica of runAgent logic
  const accountsBlock = accounts.accounts.length
    ? `\n\nConnected Google accounts: ${accounts.accounts
        .map((a) => `${a.email}${a.email === accounts.activeEmail ? " (active)" : ""}`)
        .join(", ")}.`
    : "";
  const recentBlock = staged.length
    ? `\n\nLINE files staged for attachment (1-indexed, oldest first):\n${staged
        .map((m, i) => {
          const ago = Math.round((Date.now() - m.ts) / 60_000);
          const parts = [
            `${i + 1}. ${m.kind}`,
            m.fileName ? `"${m.fileName}"` : null,
            `(${m.contentType}`,
            m.sizeBytes ? `, ${(m.sizeBytes / 1024).toFixed(0)} KB` : "",
            `)`,
            `— ${ago}m ago`,
          ];
          return parts.filter(Boolean).join(" ");
        })
        .join("\n")}\nUse \`attach_recent_media: true\` to attach all of them, or \`attach_recent_media_indexes: [n,…]\` to pick specific ones.`
    : "";

  const systemPrompt =
    buildSystemPrompt(factsToPromptBlock(facts), profile, settings) +
    accountsBlock +
    recentBlock;

  // Get all tools and convert to Gemini format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawTools = toolsForUser(userId) as Record<string, any>;
  const funcDecls: GFunctionDecl[] = Object.entries(rawTools).map(([name, tool]) =>
    toFuncDecl(name, tool),
  );

  const allTools: GTool[] = [{ functionDeclarations: funcDecls }];
  const sysInstruction: GSysInstruction = { parts: [{ text: systemPrompt }] };

  // Build full contents: history + trailing user turn
  const histContents = histToContents(history);
  const lastRole = histContents[histContents.length - 1]?.role;
  const fullContents: GContent[] =
    histContents.length === 0 || lastRole !== "user"
      ? [...histContents, { role: "user", parts: [{ text: " " }] }]
      : histContents;

  console.log(
    `Counting tokens: ${funcDecls.length} tools, ${history.length} history turns…`,
  );
  console.log("Making API calls (sequential, ~50ms delay each)…\n");

  // Baseline: one dummy user content, no system, no tools
  const baseline = await countTokens({ contents: DUMMY });

  // (a) System prompt alone: add system instruction to baseline, subtract baseline
  const sysBaseline = await countTokens({ system: sysInstruction, contents: DUMMY });
  const systemTokens = sysBaseline - baseline;

  // (b) All tools combined
  const allToolsBaseline = await countTokens({ tools: allTools, contents: DUMMY });
  const toolTokensAll = allToolsBaseline - baseline;

  // (c) Per tool — sequential with small delay
  const perTool: { name: string; tokens: number }[] = [];
  for (const decl of funcDecls) {
    const t = await countTokens({
      tools: [{ functionDeclarations: [decl] }],
      contents: DUMMY,
    });
    perTool.push({ name: decl.name, tokens: t - baseline });
    await new Promise((r) => setTimeout(r, 50));
  }
  perTool.sort((a, b) => b.tokens - a.tokens);

  // (d) History: count full history contents with minimal system
  //    subtract the same minimal-system baseline so system chars don't inflate history
  const histMinSysBaseline = await countTokens({ system: MIN_SYS, contents: DUMMY });
  const histWithMinSys = await countTokens({
    system: MIN_SYS,
    contents: fullContents,
  });
  const historyTokens = histWithMinSys - histMinSysBaseline;

  // (e) Full request
  const fullTokens = await countTokens({
    system: sysInstruction,
    tools: allTools,
    contents: fullContents,
  });

  // ── Output ─────────────────────────────────────────────────────────────

  const hr = "─".repeat(58);

  console.log(hr);
  console.log(`TOKEN AUDIT   userId=${userId}   model=${MODEL}`);
  console.log(hr);
  console.log("");

  // Summary table
  const sumRows: [string, number][] = [
    [`a) System prompt`, systemTokens],
    [`b) Tool defs (combined)`, toolTokensAll],
    [`d) History (${history.length} turns)`, historyTokens],
    [`e) FULL REQUEST`, fullTokens],
  ];
  console.log("COMPONENT SUMMARY");
  console.log(`${pad("Section", 32)} ${rpad(0, 8).replace(/0/, "Tokens")}`);
  console.log("─".repeat(42));
  for (const [label, n] of sumRows) {
    console.log(`${pad(label, 32)} ${rpad(n, 8)}`);
  }

  console.log("");
  console.log("c) PER-TOOL BREAKDOWN (sorted descending)");
  const nameW = Math.max(16, ...perTool.map((t) => t.name.length)) + 2;
  console.log(`${pad("Tool name", nameW)} ${rpad(0, 8).replace(/0/, "Tokens")}`);
  console.log("─".repeat(nameW + 10));
  for (const { name, tokens } of perTool) {
    console.log(`${pad(name, nameW)} ${rpad(tokens, 8)}`);
  }

  // Metadata
  console.log("");
  console.log(hr);
  console.log(`Baseline (empty content):          ${baseline} tokens`);
  console.log(`System prompt chars:               ${systemPrompt.length.toLocaleString()}`);
  console.log(`BASE_PERSONALITY chars:            ${BASE_PERSONALITY.length.toLocaleString()}`);
  console.log(`Facts count:                       ${facts.facts.length}`);
  console.log(`History turns in Redis:            ${history.length}`);
  console.log(`Tools registered:                  ${funcDecls.length}`);
  console.log(hr);
}

main().catch((err) => {
  console.error("\nFailed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
