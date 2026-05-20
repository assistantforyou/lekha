/**
 * Token cost audit for the Lekha production prompt.
 *
 * Usage:
 *   USER_ID=Uxxxxx npx tsx scripts/measure-prompt.ts
 *   npx tsx scripts/measure-prompt.ts <userId>
 *
 * Reads .env.local automatically. Does NOT bill tokens — countTokens is free.
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

async function countTokens(opts: {
  system?: GSysInstruction;
  tools?: GTool[];
  contents?: GContent[];
}): Promise<number> {
  const body: Record<string, unknown> = {};
  if (opts.system) body.systemInstruction = opts.system;
  if (opts.tools?.length) body.tools = opts.tools;
  body.contents = opts.contents ?? [{ role: "user", parts: [{ text: " " }] }];

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

// ── Tool → Gemini function declaration ───────────────────────────────────

function toFuncDecl(
  name: string,
  tool: { description?: string; inputSchema: unknown },
): GFunctionDecl {
  const schema = asSchema(tool.inputSchema as Parameters<typeof asSchema>[0]);
  // .jsonSchema is a lazy getter — access it synchronously
  const raw = schema.jsonSchema as Record<string, unknown>;
  // Strip JSON Schema meta-fields Gemini doesn't accept
  const { $schema, definitions, additionalProperties, ...parameters } = raw as {
    $schema?: unknown;
    definitions?: unknown;
    additionalProperties?: unknown;
    [k: string]: unknown;
  };
  return {
    name,
    description: tool.description ?? "",
    ...(Object.keys(parameters).length > 0 ? { parameters } : {}),
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
  console.log(`Facts bullets:                     ${facts.bullets.length}`);
  console.log(`History turns in Redis:            ${history.length}`);
  console.log(`Tools registered:                  ${funcDecls.length}`);
  console.log(hr);
}

main().catch((err) => {
  console.error("\nFailed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
