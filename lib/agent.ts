import { generateText, stepCountIs, type ModelMessage } from "ai";
import type { LanguageModel } from "ai";
import { getGeminiApiKeys, geminiWithKey, fallbackChatModels, openRouterFallbackModels } from "@/lib/llm/provider";
import { markKeyDown, isKeyDown } from "@/lib/llm/health";
import { buildSystemPrompt } from "@/lib/llm/prompts";
import { factsToPromptBlock, loadFacts } from "@/lib/memory/facts";
import { toolsForUser, coreToolsForUser } from "@/lib/tools";
import { GoogleAuthRequired, NeedsConfirmation, RateLimited } from "@/lib/errors";
import { buildConnectUrl, listAccounts } from "@/lib/tools/google-auth";
import { renderDraftsBlock } from "@/lib/llm/render-drafts";
import { listRecentMedia } from "@/lib/memory/recent-media";
import { getSettings } from "@/lib/memory/settings";

// ─── Utilities ────────────────────────────────────────────────────────────────

export class AgentTimeoutError extends Error {
  constructor(public readonly seconds: number) {
    super(`Agent call exceeded ${seconds}s`);
    this.name = "AgentTimeoutError";
  }
}

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new AgentTimeoutError(Math.round(ms / 1000))), ms),
    ),
  ]);
}

/** Full error chain dump for server logs — never shown to users. */
export function verboseError(err: unknown): string {
  const lines: string[] = [];
  const seen = new Set<unknown>();
  let cur: unknown = err;
  let depth = 0;
  while (cur && typeof cur === "object" && !seen.has(cur) && depth < 4) {
    seen.add(cur);
    const e = cur as {
      name?: string;
      message?: string;
      statusCode?: number;
      responseBody?: string;
      url?: string;
      cause?: unknown;
    };
    const part = [
      `${depth === 0 ? "" : "↳ "}${e.name ?? "Error"}: ${e.message ?? "(no message)"}`,
      e.statusCode ? `  status: ${e.statusCode}` : null,
      e.url ? `  url: ${e.url}` : null,
      e.responseBody ? `  body: ${String(e.responseBody).slice(0, 400)}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    lines.push(part);
    cur = e.cause;
    depth++;
  }
  const out = lines.join("\n\n");
  return out.length > 1500 ? `${out.slice(0, 1500)}\n…(truncated)` : out;
}

export function parseQuotaError(err: unknown): { retryAfterSec: number } | null {
  const text = (() => {
    if (err instanceof Error) {
      const cause = (err as { cause?: unknown }).cause;
      const causeMsg = cause instanceof Error ? cause.message : "";
      return `${err.name} ${err.message} ${causeMsg}`;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  })();
  if (
    !/quota|rate.?limit|RESOURCE_EXHAUSTED|429|UNAVAILABLE|overloaded|503|500|502|504|INTERNAL|timeout|temporarily|AI_APICallError|AI_RetryError|fetch failed|ECONN|ENOTFOUND/i.test(
      text,
    )
  ) {
    return null;
  }
  const m = text.match(/retry in (\d+(?:\.\d+)?)s/i);
  const retryAfterSec = m ? Math.ceil(parseFloat(m[1]!)) : 30;
  return { retryAfterSec };
}

/** Extract the actual value from an AI SDK tool result output. */
export function extractToolValue(output: unknown): unknown {
  if (output && typeof output === "object") {
    const o = output as { type?: string; value?: unknown };
    if (o.type === "json" && "value" in o) return o.value;
    return output;
  }
  return output;
}

export function unwrap(err: unknown): unknown {
  const seen = new Set<unknown>();
  let cur: unknown = err;
  while (cur && typeof cur === "object" && !seen.has(cur)) {
    seen.add(cur);
    if (cur instanceof GoogleAuthRequired) return cur;
    if (cur instanceof NeedsConfirmation) return cur;
    if (cur instanceof RateLimited) return cur;
    const next = (cur as { cause?: unknown; originalError?: unknown }).cause
      ?? (cur as { originalError?: unknown }).originalError;
    if (!next) break;
    cur = next;
  }
  return err;
}

// ─── Cascade ──────────────────────────────────────────────────────────────────

type CompletedStep = {
  text: string;
  toolCalls: Array<{ type: "tool-call"; toolCallId: string; toolName: string; input: unknown }>;
  toolResults: Array<{ type: "tool-result"; toolCallId: string; toolName: string; output: unknown }>;
};

function buildMessagesWithSteps(base: ModelMessage[], steps: CompletedStep[]): ModelMessage[] {
  if (steps.length === 0) return base;
  return [
    ...base,
    ...steps.flatMap((step): ModelMessage[] => {
      const assistantContent: Array<
        { type: "text"; text: string } | { type: "tool-call"; toolCallId: string; toolName: string; input: unknown }
      > = [];
      if (step.text) assistantContent.push({ type: "text", text: step.text });
      for (const tc of step.toolCalls) assistantContent.push(tc);
      const msgs: ModelMessage[] = [];
      if (assistantContent.length > 0) msgs.push({ role: "assistant", content: assistantContent as never });
      if (step.toolResults.length > 0) msgs.push({ role: "tool", content: step.toolResults as never });
      return msgs;
    }),
  ];
}

function modelLabel(m: unknown): string {
  return (
    (m as { modelId?: string }).modelId ??
    (m as { provider?: string }).provider ??
    "unknown"
  );
}


/**
 * Multi-provider cascade:
 *   1. Gemini key pool (per-key cooldowns, shuffled order)
 *   2. Groq: maverick → scout → gpt-oss-120b
 *   3. OpenRouter free: gemini-2.0-flash-exp → llama-4-maverick → gemini-flash-1.5-8b
 *
 * Per-key Gemini cooldowns mean one exhausted key never blocks the others.
 * Groq and OpenRouter are independent rate-limit pools — exhausting one
 * doesn't affect the other. Together the probability of ALL failing on a
 * personal bot is essentially zero.
 */
export async function runWithCascade<T extends ReturnType<typeof toolsForUser>>(opts: {
  hasMultimodal: boolean;
  system: string;
  messages: ModelMessage[];
  tools: T;
  slimSystem?: string;
  slimTools?: ReturnType<typeof coreToolsForUser>;
}) {
  const tStart = Date.now();
  const slimSystem = opts.slimSystem ?? opts.system;
  const slimTools = opts.slimTools ?? opts.tools;

  // ── Phase 1: Gemini key pool ────────────────────────────────────────────────
  const keys = getGeminiApiKeys();
  // Shuffle so load distributes across keys rather than always hammering key[0].
  const order = keys.map((_, i) => i).sort(() => Math.random() - 0.5);

  let geminiCompletedSteps: CompletedStep[] = [];

  for (const idx of order) {
    if (await isKeyDown(idx)) {
      console.log(`[agent] skipping gemini key ${idx} (cooldown)`);
      continue;
    }

    const thisKeySteps: CompletedStep[] = [];
    let thisKeyRanToolCalls = false;

    try {
      const r = await withTimeout(
        generateText({
          model: geminiWithKey(keys[idx]!),
          system: opts.system,
          messages: opts.messages,
          tools: opts.tools,
          temperature: 0.4,
          stopWhen: stepCountIs(3),
          maxRetries: 0,
          onStepFinish: (step) => {
            if (step.toolCalls.length > 0) {
              thisKeyRanToolCalls = true;
              thisKeySteps.push({
                text: step.text,
                toolCalls: step.toolCalls.map((tc) => ({
                  type: "tool-call" as const,
                  toolCallId: tc.toolCallId,
                  toolName: tc.toolName as string,
                  input: tc.input,
                })),
                toolResults: step.toolResults.map((tr) => ({
                  type: "tool-result" as const,
                  toolCallId: tr.toolCallId,
                  toolName: tr.toolName as string,
                  output: (tr as { output?: unknown }).output ?? null,
                })),
              });
            }
            console.log(`[agent] gemini[${idx}] step`, {
              ms: Date.now() - tStart,
              toolCalls: step.toolCalls.map((c) => c?.toolName),
              finish: step.finishReason,
            });
          },
          providerOptions: {
            google: {
              safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
              ],
            },
          },
        }),
        20_000,
      );
      console.log(`[agent] gemini[${idx}] done`, { ms: Date.now() - tStart, steps: r.steps.length });
      return r;
    } catch (err) {
      const isTimeout = err instanceof AgentTimeoutError;
      const quota = parseQuotaError(err);
      if (!isTimeout && !quota) throw err;

      await markKeyDown(idx, 60).catch(() => {});
      console.warn(`[agent] gemini[${idx}] failed (${isTimeout ? "timeout" : `quota ~${quota?.retryAfterSec}s`})`);

      if (isTimeout && thisKeyRanToolCalls) {
        // Gemini started tool work but timed out — hand partial results to
        // the text-only fallback so tools aren't re-executed.
        geminiCompletedSteps = thisKeySteps;
        break;
      }
      // quota error (no partial work) → try next key immediately
    }
  }

  // ── Phase 2 + 3: text-only fallbacks (Groq + OpenRouter) ───────────────────
  if (opts.hasMultimodal) {
    const e = new Error("All Gemini keys exhausted and no text-only fallback for multimodal turns");
    e.name = "AllProvidersFailed";
    throw e;
  }

  const fallbackMessages = buildMessagesWithSteps(opts.messages, geminiCompletedSteps);
  const allFallbacks = [...fallbackChatModels(), ...openRouterFallbackModels()];
  const fallbackErrors: { model: string; error: unknown }[] = [];

  for (const m of allFallbacks) {
    const label = modelLabel(m);
    const tFallback = Date.now();
    try {
      const r = await withTimeout(
        generateText({
          model: m as LanguageModel,
          system: slimSystem,
          messages: fallbackMessages,
          tools: slimTools,
          temperature: 0.4,
          stopWhen: stepCountIs(3),
          maxRetries: 0,
          onStepFinish: (step) => {
            console.log(`[agent] fallback step`, {
              model: label,
              ms: Date.now() - tFallback,
              toolCalls: step.toolCalls.map((c) => c?.toolName),
              finish: step.finishReason,
            });
          },
        }),
        45_000,
      );
      console.log(`[agent] fallback done`, { model: label, ms: Date.now() - tStart, steps: r.steps.length });
      return r;
    } catch (err) {
      console.warn(`[agent] fallback failed`, { model: label, err: err instanceof Error ? `${err.name}: ${err.message}` : err });
      fallbackErrors.push({ model: label, error: err });
    }
  }

  const geminiSummary = keys.length
    ? `${keys.length} key(s) tried — all hit quota or timeout`
    : "no Gemini keys configured";
  const wrapped = new Error(
    `All providers failed.\n\nGEMINI: ${geminiSummary}\n\nFALLBACKS:\n${fallbackErrors
      .map((f) => `--- ${f.model} ---\n${verboseError(f.error)}`)
      .join("\n\n")}`,
  );
  wrapped.name = "AllProvidersFailed";
  throw wrapped;
}

// ─── Main agent ───────────────────────────────────────────────────────────────

export async function runAgent(
  userId: string,
  profile: { displayName: string },
  facts: Awaited<ReturnType<typeof loadFacts>>,
  messages: ModelMessage[],
): Promise<string> {
  const [accounts, staged, settings] = await Promise.all([
    listAccounts(userId),
    listRecentMedia(userId),
    getSettings(userId),
  ]);
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
  const system =
    buildSystemPrompt(factsToPromptBlock(facts), profile, settings) +
    accountsBlock +
    recentBlock;

  const hasMultimodal = messages.some(
    (m) =>
      Array.isArray(m.content) &&
      m.content.some((p) => {
        if (typeof p !== "object" || !p) return false;
        const t = (p as { type?: string }).type;
        return t === "image" || t === "file";
      }),
  );

  const slimLocationHint = settings?.location ? `\nUser's location: ${settings.location}.` : "";
  const slimSystem = `You are Lekha (เลขา), ${profile.displayName}'s personal secretary on LINE. You are a lady — in Thai always use ค่ะ, never ครับ. Warm but professional, concise (1-3 sentences). Match the user's language. Never reveal the underlying AI model or provider; if asked, say you're Lekha, a personal assistant, and leave it at that. Current time: ${new Date().toISOString()} (UTC).${slimLocationHint}

You have these tools available right now — use them whenever the user's request matches. NEVER reply 'I don't have access to X' if a matching tool exists below; CALL the tool:

- stock_price(ticker)         — current stock price.
- stock_history(ticker, range) — historical movement: 1mo / 3mo / 6mo / 1y / 2y / 5y / ytd / max. USE for "1-year movement of X" / "YTD performance".
- crypto_price(coin)          — current crypto price (bitcoin, ethereum, btc, eth, …). USE THIS for any crypto question.
- fx_rate(from, to, amount)   — currency conversion. USE THIS for any FX question.
- weather(location)           — current weather + 3-day forecast. USE THIS for any weather question. If no location is known, ASK the user before calling.
- news_search(query, days?)   — recent news headlines + sources. USE THIS for any news question.
- web_search(query)           — general web search for everything else (articles, who-is-X). NOT for stocks/crypto/weather/news.
- set_reminder(when, message) — schedule a reminder push.
- list_reminders / list_tasks / list_memories — show stored items.
- add_task(title, dueAt?)     — add a persistent task.
- complete_task(id)           — mark a task done.
- remember(fact)              — save a durable fact about the user.
- contacts_search(query)      — find an email/phone in the user's Google Contacts.
- add_to_list(list_name, item)     — add item to a named list (grocery list, packing list, etc.).
- list_items(list_name)            — show all items in a named list.
- remove_from_list(list_name, item) — remove an item from a named list.
- show_all_lists()                 — list all named lists + item counts.
- create_google_doc(title, body)   — create a Google Doc and return the link.
- draft_email({to, subject, body, …})       — compose an email (queues for YES confirm). If the user sent a file in LINE (staged below), pass attach_recent_media: true or attach_recent_media_indexes: [n] — do NOT use drive_search for files the user just uploaded in chat.
- draft_calendar_event({summary, startISO, endISO, attendees?, …}) — compose a calendar event.
- calendar_today / calendar_week — see today's or this week's events.
- ocr_image / transcribe_audio — extract text from a recently-sent image / voice memo.
- show_help                   — list all capabilities to the user.

If none of these tools fit the question, answer briefly from your own knowledge. Don't make up tool capabilities that aren't listed.

CRITICAL: when a tool returns { ok: false, error: "..." }, RELAY THE EXACT ERROR to the user (one short sentence). Never say "I'm having a technical hiccup" or "let me get that sorted" — those are useless evasions. Tell the user what actually broke so they can react.

SOURCE RULE: when presenting live data (prices, rates, weather), always cite the source at the end in this exact format: "35.06 THB (source: Frankfurter)" or "28°C (source: wttr.in)".` + recentBlock;

  try {
    const result = await runWithCascade({
      hasMultimodal,
      system,
      messages,
      tools: toolsForUser(userId),
      slimSystem,
      slimTools: coreToolsForUser(userId),
    });

    const allCalls: { toolName: string; input: unknown }[] = [];
    let authNeeded: { connectUrl: string; reason: string } | null = null;
    let apiDisabled: { api: string; enableUrl: string | null; message: string } | null = null;
    let googleErr: { status: number | null; message: string } | null = null;
    for (const step of result.steps) {
      for (const c of step.toolCalls) {
        if (!c) continue;
        allCalls.push({ toolName: c.toolName, input: c.input });
      }
      for (const tr of step.toolResults) {
        if (!tr) continue;
        const value = extractToolValue((tr as { output?: unknown }).output);
        if (!value || typeof value !== "object") continue;
        const v = value as Record<string, unknown>;
        if (v.need_google_auth && typeof v.connect_url === "string") {
          authNeeded = { connectUrl: v.connect_url, reason: typeof v.reason === "string" ? v.reason : "" };
        } else if (v.google_api_disabled) {
          apiDisabled = {
            api: typeof v.api === "string" ? v.api : "Google API",
            enableUrl: typeof v.enable_url === "string" ? v.enable_url : null,
            message: typeof v.message === "string" ? v.message : "",
          };
        } else if (v.google_error) {
          googleErr = {
            status: typeof v.status === "number" ? v.status : null,
            message: typeof v.message === "string" ? v.message : "",
          };
        }
      }
    }

    if (authNeeded) {
      const isReauth = authNeeded.reason.includes("scopes");
      const intro = isReauth
        ? "Your Google account needs a quick permission update to access calendar and Gmail features."
        : "I need access to your Google account to do that.";
      return `${intro}\n\nType "connect google" to reconnect — it only takes a few seconds and you'll only need to do this once.\n\n${authNeeded.connectUrl}`;
    }
    if (apiDisabled) {
      const enableHint = apiDisabled.enableUrl
        ? `\n\nEnable it here:\n${apiDisabled.enableUrl}`
        : `\n\nEnable it in Google Cloud Console → APIs & Services → Library.`;
      return `Google says the ${apiDisabled.api} isn't enabled in your Cloud project.${enableHint}\n\nGive it ~1 min to propagate after enabling, then try again.`;
    }
    if (googleErr) {
      const status = googleErr.status ? ` (HTTP ${googleErr.status})` : "";
      return `Google API error${status}: ${googleErr.message}`;
    }

    const toolErrors: string[] = [];
    for (const step of result.steps) {
      for (const tr of step.toolResults) {
        const value = extractToolValue((tr as { output?: unknown }).output);
        if (value && typeof value === "object") {
          const v = value as Record<string, unknown>;
          if (v.ok === false && typeof v.error === "string") {
            const toolName = (tr as { toolName?: string }).toolName ?? "tool";
            toolErrors.push(`${toolName}: ${v.error}`);
          }
        }
      }
    }

    const draftBlock = renderDraftsBlock(allCalls, accounts.activeEmail);
    const modelText = result.text?.trim() ?? "";

    if (toolErrors.length > 0 && !draftBlock) {
      const allErrorsPresent = toolErrors.every((e) => modelText.includes(e.split(": ").slice(1).join(": ")));
      if (!allErrorsPresent) {
        console.warn("[agent] model soft-apologized — overriding with real tool errors", toolErrors);
        return toolErrors.join("\n");
      }
    }

    if (draftBlock) {
      const intro = modelText.length > 0 && modelText.length < 240 ? `${modelText}\n\n` : "";
      return `${intro}${draftBlock}`;
    }
    return modelText.length > 0 ? modelText : "(…)";
  } catch (err) {
    const inner = unwrap(err);
    if (inner instanceof GoogleAuthRequired) {
      const url = await buildConnectUrl(userId);
      return `To do that I need access to your Google account. Connect here (link expires in 10 min):\n${url}`;
    }
    if (inner instanceof NeedsConfirmation) {
      return inner.message;
    }
    if (inner instanceof RateLimited) {
      return `I'm being rate-limited. Try again in ~${inner.retryAfterSec}s.`;
    }
    if (err instanceof AgentTimeoutError) {
      console.warn("[agent] timeout", { seconds: err.seconds, detail: verboseError(err) });
      return "Sorry, I took too long to respond. Please try again in a moment.";
    }
    if (err instanceof Error && err.name === "AllProvidersFailed") {
      console.error("[agent] all providers failed", err.message);
      return "I'm temporarily overloaded — please try again in a few seconds.";
    }
    const quota = parseQuotaError(err);
    if (quota) {
      console.warn("[agent] quota/overload (no fallback)", { retryAfter: quota.retryAfterSec, detail: verboseError(err) });
      return `I'm at capacity for a moment. Try again in ~${quota.retryAfterSec}s.`;
    }
    console.error("[agent] unhandled", err);
    return "Something went wrong on my end. Please try again.";
  }
}
