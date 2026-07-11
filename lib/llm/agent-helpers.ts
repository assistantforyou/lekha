import { performance } from "perf_hooks";
import { generateText, stepCountIs, type ModelMessage } from "ai";
import { chatModelForTier, hasFreeKey, hasPaidKey, AGENT_TIMEOUT_MS, GEMINI_PROVIDER_OPTIONS } from "@/lib/llm/provider";
import { buildSystemPrompt, buildTimeContext } from "@/lib/llm/prompts";
import { factsToPromptBlock, loadFacts, displayOrder } from "@/lib/memory/facts";
import { listTasks } from "@/lib/memory/tasks";
import { listReminders } from "@/lib/tools/reminders";
import { renderDraftsBlock } from "@/lib/llm/render-drafts";
import { buildConnectUrl } from "@/lib/tools/google-auth";
import { GoogleAuthRequired, NeedsConfirmation, RateLimited, unwrapCause, unwrapAuthRequired } from "@/lib/errors";
import type { LineMessage } from "@/lib/line/client";
import { buildFlexFromToolResults, buildFollowUps, buildSimpleCardFlex, buildDraftFlexCards } from "@/lib/llm/agent-flex";
import { taskListFlex, newsFlex, factsListFlex, type FactsListItem, reminderListFlex } from "@/lib/line/flex";
import { buildWeatherFlex, type WeatherResult } from "@/lib/line/weather-flex";
import { span, tick, withTimeout, AgentTimeoutError } from "@/lib/timing";
import { stripMarkdown } from "@/lib/format";
import { ACTION_LABELS } from "@/lib/llm/action-labels";
import { t } from "@/lib/i18n";
import { buildMediaAiTools } from "@/lib/tools/media-ai";
import { buildWeatherTools } from "@/lib/tools/weather";
import { buildNewsTools } from "@/lib/tools/news";
import { buildFinanceTools } from "@/lib/tools/finance";
import { buildWebSearchTool } from "@/lib/tools/web-search";
import { buildCryptoFlex, buildStockFlex, type CryptoResult, type StockResult } from "@/lib/line/finance-flex";
import { HELP_TEXT } from "@/lib/tools/help";
import type { AuditToolCall } from "@/lib/memory/audit-log";

/**
 * Map a fastClassify hint to a facts-injection limit.
 * Stateless queries (weather, finance, news) need almost no user facts;
 * memory/email/calendar queries benefit from fuller context.
 * undefined hint (ambiguous/multi-topic) gets a moderate default.
 */
export function factLimitForHint(hint: string | undefined): number {
  if (!hint) return 20;
  switch (hint) {
    // Stateless lookups — only inject location/context facts (top 5)
    case "weather":
    case "finance":
    case "news":
      return 5;
    // Tool-focused queries — moderate context. Media needs extra room because
    // upload-derived priority facts (documents, voice memos) compete for slots.
    case "reminder":
    case "task":
    case "lists":
    case "settings":
    case "receipts":
      return 12;
    case "media":
      return 20;
    // Relational queries — need people, context, preferences
    case "email":
    case "calendar":
    case "search":
      return 20;
    // Memory queries — full context (user asked about what we remember)
    case "memory":
    case "briefing":
      return 30;
    default:
      return 20;
  }
}

/**
 * Dynamic maxSteps for the agentic turn. Higher for media/multi-step,
 * lower for open-ended turns to cap cost/latency. Clamped to [4, 12].
 */
export function computeMaxSteps(
  hint: string | undefined,
  hasStagedMedia: boolean,
  isMultiStepHint: boolean,
): number {
  let steps: number;
  if (hint === "media" || hasStagedMedia) {
    steps = 10;
  } else if (isMultiStepHint) {
    steps = 10;
  } else if (
    hint === "recent" ||
    hint === "email" ||
    hint === "reminder" ||
    hint === "task" ||
    hint === "weather"
  ) {
    steps = 8;
  } else {
    steps = 6;
  }
  return Math.max(4, Math.min(12, steps));
}

/** Cheap token heuristic: total characters / 4. */
export function estimatePromptTokens(system: string, messages: ModelMessage[]): number {
  let chars = system.length;
  for (const m of messages) {
    const content = m.content;
    if (typeof content === "string") {
      chars += content.length;
    } else if (Array.isArray(content)) {
      for (const part of content) {
        if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
          chars += part.text.length;
        }
      }
    }
  }
  return Math.ceil(chars / 4);
}

export function extractToolValue(output: unknown): unknown {
  if (output && typeof output === "object") {
    const o = output as { type?: string; value?: unknown };
    if (o.type === "json" && "value" in o) return o.value;
    return output;
  }
  return output;
}

/** Full tool call + result pairs (name/input/output/ok) for the compliance audit log. */
export function flattenToolCallsForAudit(steps: {
  toolCalls: { toolName: string; input: unknown }[];
  toolResults: { output?: unknown }[];
}[]): AuditToolCall[] {
  const out: AuditToolCall[] = [];
  for (const step of steps) {
    for (let i = 0; i < step.toolCalls.length; i++) {
      const c = step.toolCalls[i];
      if (!c) continue;
      const tr = step.toolResults[i];
      const output = tr ? extractToolValue(tr.output) : undefined;
      const ok = !(output && typeof output === "object" && (output as Record<string, unknown>).ok === false);
      out.push({ toolName: c.toolName, input: c.input, output, ok });
    }
  }
  return out;
}

export function classifyResultType(val: unknown): string {
  if (val && typeof val === "object") {
    const v = val as Record<string, unknown>;
    if (v.ok === false) return "error";
    if (v.need_google_auth) return "auth";
    if (v.google_api_disabled) return "disabled";
    if (v.google_error) return "api-err";
  }
  return "ok";
}

/** Tracks step timing, tool calls, and successful tool results across agent steps. */
export function createStepTracker(traceId: string | undefined) {
  const stepTimes: number[] = [];
  const allCalls: { toolName: string; input: unknown }[] = [];
  const successfulCalls: { toolName: string; input: unknown }[] = [];
  const succeededTools: string[] = [];
  let lastStepTime = performance.now();

  function isSuccess(tr: { toolName?: string; output?: unknown }): boolean {
    const val = extractToolValue(tr.output);
    if (val && typeof val === "object") {
      const v = val as Record<string, unknown>;
      return v.ok !== false && !v.need_google_auth && !v.google_api_disabled && !v.google_error;
    }
    // Non-object results (e.g. plain strings from successful tools) count as success.
    return true;
  }

  return {
    record(step: { toolCalls: { toolName: string; input: unknown }[]; toolResults: { toolName?: string; output?: unknown }[]; text?: string; finishReason?: string }) {
      const now = performance.now();
      const stepMs = Math.round(now - lastStepTime);
      stepTimes.push(stepMs);
      lastStepTime = now;

      for (const c of step.toolCalls) {
        if (c) allCalls.push({ toolName: c.toolName, input: c.input });
      }
      // Match toolCalls to toolResults by index within this step.
      for (let i = 0; i < step.toolCalls.length; i++) {
        const c = step.toolCalls[i];
        const tr = step.toolResults[i];
        if (c && tr && isSuccess(tr)) {
          successfulCalls.push({ toolName: c.toolName, input: c.input });
          succeededTools.push(c.toolName);
        }
      }

      const toolNames = step.toolCalls.map((c) => c?.toolName).filter(Boolean);
      const resultTypes = step.toolResults.map((r) => classifyResultType((r as { output?: unknown }).output));

      tick("agent:step", traceId, {
        stepMs,
        stepIndex: stepTimes.length,
        toolCalls: toolNames,
        resultTypes,
        textLength: step.text?.length ?? 0,
        finishReason: step.finishReason,
      });
    },
    get stepTimes() { return stepTimes; },
    get allCalls() { return allCalls; },
    get successfulCalls() { return successfulCalls; },
    get succeededTools() { return succeededTools; },
  };
}

type ProcessedResult = {
  reply: string;
  authNeeded: { connectUrl: string; reason: string } | null;
  apiDisabled: { api: string; enableUrl: string | null; message: string } | null;
  googleErr: { status: number | null; message: string } | null;
  /**
   * Set when a real tool error was detected and the model didn't already
   * relay it (decision #17). A Flex card from some OTHER successful tool call
   * in the same turn must never suppress this — otherwise a failure like
   * "delete_receipt: not found" silently vanishes behind an unrelated
   * list_receipts card, and the user has no idea the action didn't happen.
   */
  hadUnrelayedToolError: boolean;
};

type AgentStep = {
  toolResults: { toolName?: string; output?: unknown }[];
};

type ProcessResultInput = {
  text?: string;
  steps: AgentStep[];
};

function toolNameOf(tr: { toolName?: string } | undefined): string {
  return tr?.toolName ?? "";
}

function looksLikeSoftApology(text: string): boolean {
  return /sorry|apolog|unable|couldn't|can't|won't|didn't|doesn't/i.test(text);
}

export function processResult(
  result: ProcessResultInput,
  activeEmail: string | null,
  allCalls: { toolName: string; input: unknown }[],
  timezone?: string,
  language?: string | null,
): ProcessedResult {
  let authNeeded: { connectUrl: string; reason: string } | null = null;
  let apiDisabled: { api: string; enableUrl: string | null; message: string } | null = null;
  let googleErr: { status: number | null; message: string } | null = null;
  const toolErrors: string[] = [];

  // Single pass: scan all tool results for auth/errors/tool-errors
  for (const step of result.steps) {
    for (const tr of step.toolResults) {
      if (!tr) continue;
      const value = extractToolValue(tr.output);
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
      } else if (v.ok === false && typeof v.error === "string") {
        const toolName = tr.toolName ?? "tool";
        toolErrors.push(`${toolName}: ${v.error}`);
      }
    }
  }

  if (authNeeded) return { reply: "", authNeeded, apiDisabled: null, googleErr: null, hadUnrelayedToolError: false };
  if (apiDisabled) return { reply: "", authNeeded: null, apiDisabled, googleErr: null, hadUnrelayedToolError: false };
  if (googleErr) return { reply: "", authNeeded: null, apiDisabled: null, googleErr, hadUnrelayedToolError: false };

  const draftBlock = renderDraftsBlock(allCalls, activeEmail, timezone);
  const modelText = result.text?.trim() ?? "";

  if (toolErrors.length > 0 && !draftBlock) {
    const strippedErrors = toolErrors.map((e) => e.split(": ").slice(1).join(": "));
    const allErrorsPresent = strippedErrors.every((msg) => modelText.includes(msg));
    const shouldOverride =
      modelText.length === 0 ||
      modelText.length < 60 ||
      looksLikeSoftApology(modelText) ||
      !allErrorsPresent;
    if (shouldOverride) {
      console.warn("[agent] model soft-apologized — overriding with real tool errors", toolErrors);
      return { reply: strippedErrors.join("\n"), authNeeded: null, apiDisabled: null, googleErr: null, hadUnrelayedToolError: true };
    }
  }

  if (draftBlock) {
    const intro = modelText.length > 0 && modelText.length < 240 ? `${modelText}\n\n` : "";
    return { reply: `${intro}${draftBlock}`, authNeeded: null, apiDisabled: null, googleErr: null, hadUnrelayedToolError: false };
  }

  if (modelText.length > 0) return { reply: modelText, authNeeded: null, apiDisabled: null, googleErr: null, hadUnrelayedToolError: false };
  if (allCalls.length > 0) {
    for (const step of result.steps) {
      for (const tr of step.toolResults) {
        const toolName = toolNameOf(tr);
        if (toolName === "get_morning_briefing" || toolName === "get_evening_summary") {
          return { reply: "", authNeeded: null, apiDisabled: null, googleErr: null, hadUnrelayedToolError: false };
        }
      }
    }
    const labels = allCalls.map((c) => ACTION_LABELS[c.toolName]).filter((l): l is string => l != null);
    const unique = [...new Set(labels)];
    return { reply: unique.length ? unique.join(" • ") + " ✓" : "Done.", authNeeded: null, apiDisabled: null, googleErr: null, hadUnrelayedToolError: false };
  }
  return { reply: t(language, "fallbackNoCatch"), authNeeded: null, apiDisabled: null, googleErr: null, hadUnrelayedToolError: false };
}


export function formatProcessed(processed: ProcessedResult, language?: string | null): string {
  if (processed.authNeeded) {
    const isReauth = processed.authNeeded.reason.includes("scopes") || processed.authNeeded.reason.includes("reconnect") || processed.authNeeded.reason.includes("no longer valid");
    const intro = isReauth ? t(language, "connectGoogleReauth") : t(language, "connectGoogleNeeded");
    // Don't paste the raw connect URL into text — it's dead, unselectable
    // text inside a Flex bubble. Tapping "Connect Google" below (added via
    // hints.needsGoogleConnect in enrichReply) sends "connect google", which
    // replies with a real tappable button.
    return `${intro}\n\n${t(language, "connectGoogleHint")}`;
  }
  if (processed.apiDisabled) {
    const enableHint = processed.apiDisabled.enableUrl
      ? `\n\n${t(language, "googleApiEnableUrl")}\n${processed.apiDisabled.enableUrl}`
      : `\n\n${t(language, "googleApiEnableConsole")}`;
    return `${t(language, "googleApiDisabled", { api: processed.apiDisabled.api })}${enableHint}\n\n${t(language, "googleApiWait")}`;
  }
  if (processed.googleErr) {
    const status = processed.googleErr.status ? ` (HTTP ${processed.googleErr.status})` : "";
    return t(language, "googleErr", { status, message: processed.googleErr.message });
  }
  return stripMarkdown(processed.reply);
}

/**
 * Structured UI hints surfaced by runAgent. Replaces fragile model-text regex
 * in the webhook's enrichReply. Hints are derived from tool calls / structured
 * tool returns — they survive model rewording.
 */
export type AgentHints = {
  /** A draft was rendered — show YES/No quick replies. */
  confirmDraft: boolean;
  /** A Flex card with YES/NO postback buttons was built for the draft — skip old text confirm bubble. */
  hasDraftFlex: boolean;
  /** Multi-account ambiguity — show account picker. */
  pickAccount: boolean;
  /** No Google account connected and the user asked for something that needs one. */
  needsGoogleConnect: boolean;
  /** Extra Flex bubbles/carousels to send alongside the text reply. */
  flexMessages?: LineMessage[];
  /** Quick-reply suggestions to attach to the text reply. */
  followUps?: { label: string; text: string }[];
};

export type AgentResult = {
  text: string;
  hints: AgentHints;
  /** Tool calls made during the turn (for eval/debug). */
  toolCalls?: { toolName: string; input: unknown }[];
  /**
   * What to store in conversation history for this turn. Usually equal to
   * `text`, EXCEPT when `text` was suppressed to "" for display because a
   * Flex card (inbox carousel, draft confirmation, task list, ...) already
   * carries the content — history still needs a textual trace of what
   * happened, or the model loses track of its own prior action (e.g. what a
   * pending draft said, or that a search already ran) and redundantly
   * redoes tool calls on the next turn.
   */
  historyText: string;
};
const MEMORY_RECALL_TRIGGERS = [
  /\bwhat\s+do\s+you\s+remember\b/i,
  /\bwhat\s+do\s+you\s+know\s+about\s+me\b/i,
  /\bwhat\s+have\s+you\s+remembered\b/i,
  /\b(list|show|tell)\s+me\s+what\s+you\s+remember\b/i,
  /\b(my\s+memories|my\s+remembered\s+facts)\b/i,
];

export function looksLikeMemoryRecall(text: string): boolean {
  return MEMORY_RECALL_TRIGGERS.some((r) => r.test(text));
}

export function looksLikeTaskList(text: string): boolean {
  const lower = text.toLowerCase().trim();
  // Thai task-list phrases
  if (/มีงาน|งานที่ต้องทำ|รายการงาน|งานเหลือ|งานของ(ฉัน|ผม|ดิฉัน)|แสดงงาน/.test(text)) return true;
  // English task-list phrases (broader than isTaskQuery)
  if (/\b(my\s+)?(tasks?|todo|to-dos?)(\s+(list|please|now|today|tomorrow))?\b/.test(lower)) return true;
  if (/\bwhat\s+(are\s+my|do\s+i\s+have)\s+(tasks?|todo)\b/.test(lower)) return true;
  if (/\bwhat\s+tasks?\s+(do\s+i\s+have|left|remain|overdue)\b/.test(lower)) return true;
  if (/\bshow\s+(me\s+)?my\s+(tasks?|todo)\b/.test(lower)) return true;
  if (/\b(show|list|everything|anything)\s+.*\b(i\s+need\s+to\s+do|left\s+to\s+do|to\s+do)\b/.test(lower)) return true;
  if (/\banything\s+left\s+to\s+do\b/.test(lower)) return true;
  if (/\bwhat\s+do\s+i\s+need\s+to\s+do\b/.test(lower)) return true;
  if (/\boverdue\s+(tasks?|todo)\b/.test(lower)) return true;
  return false;
}

export function looksLikeReminderList(text: string): boolean {
  const lower = text.toLowerCase().trim();
  // Thai reminder-list phrases
  if (/มีการแจ้งเตือน|การแจ้งเตือนที่ต้องทำ|รายการแจ้งเตือน|แจ้งเตือนค้าง|แจ้งเตือนของ(ฉัน|ผม|ดิฉัน)|แสดงการแจ้งเตือน/.test(text)) return true;
  // English reminder-list phrases (broader than isReminderQuery)
  if (/\b(my\s+)?(reminders?)(\s+(list|please|now|today|tomorrow))?\b/.test(lower)) return true;
  if (/\bwhat\s+reminders?\s+(do\s+i\s+have|are\s+(there|scheduled)|left)\b/.test(lower)) return true;
  if (/\bshow\s+(me\s+)?my\s+reminders?\b/.test(lower)) return true;
  if (/\bopen\s+(my\s+)?reminders?\b/.test(lower)) return true;
  if (/\bmy\s+(open|pending|upcoming)\s+reminders?\b/.test(lower)) return true;
  return false;
}

export async function fallbackListReminders(
  userId: string,
  timezone = "Asia/Bangkok",
  language?: string | null,
): Promise<{ text: string; flexMessages?: LineMessage[]; toolCalls: { toolName: string; input: unknown }[] }> {
  const all = await listReminders(userId);
  return {
    text: "",
    flexMessages: [
      reminderListFlex(
        all.map((r) => ({ id: r.id, message: r.message, fireAt: r.fireAt })),
        { timezone, language },
      ),
    ],
    toolCalls: [{ toolName: "list_reminders", input: {} }],
  };
}

export async function fallbackListMemories(userId: string, _displayName: string): Promise<{ text: string; flexMessages?: LineMessage[]; toolCalls: { toolName: string; input: unknown }[] }> {
  const f = await loadFacts(userId);
  const ordered = displayOrder(f.facts);
  const items: FactsListItem[] = ordered.map((fact) => ({
    content: fact.content,
    category: fact.category,
    updatedAt: fact.updatedAt,
  }));
  return {
    text: "",
    flexMessages: [factsListFlex(items)],
    toolCalls: [{ toolName: "list_memories", input: {} }],
  };
}

export function looksLikeWeather(text: string): boolean {
  return /\b(weather|forecast|temperature|temp)\b/i.test(text);
}

export type FinanceQuery =
  | { type: "crypto"; coin: string }
  | { type: "stock"; ticker: string }
  | { type: "fx"; from: string; to: string; amount: number };

export function looksLikeFinance(text: string): FinanceQuery | null {
  const lower = text.toLowerCase();

  // FX: "100 USD to THB", "usd/thb", "convert eur to jpy"
  const fxMatch1 = text.match(/(\d+(?:\.\d+)?)\s*(USD|EUR|GBP|JPY|THB|CNY|SGD|AUD|CAD|CHF|HKD|KRW|INR)\s*(?:to|into|=)\s*(USD|EUR|GBP|JPY|THB|CNY|SGD|AUD|CAD|CHF|HKD|KRW|INR)\b/i);
  if (fxMatch1) {
    return { type: "fx", from: fxMatch1[2]!.toUpperCase(), to: fxMatch1[3]!.toUpperCase(), amount: parseFloat(fxMatch1[1]!) };
  }
  const fxMatch2 = text.match(/\b(USD|EUR|GBP|JPY|THB|CNY|SGD|AUD|CAD|CHF|HKD|KRW|INR)\s*\/\s*(USD|EUR|GBP|JPY|THB|CNY|SGD|AUD|CAD|CHF|HKD|KRW|INR)\b/i);
  if (fxMatch2) {
    return { type: "fx", from: fxMatch2[1]!.toUpperCase(), to: fxMatch2[2]!.toUpperCase(), amount: 1 };
  }
  const fxMatch3 = text.match(/(?:convert|exchange)\s+(\d+(?:\.\d+)?)?\s*(USD|EUR|GBP|JPY|THB|CNY|SGD|AUD|CAD|CHF|HKD|KRW|INR)\s+(?:to|into|for)\s+(USD|EUR|GBP|JPY|THB|CNY|SGD|AUD|CAD|CHF|HKD|KRW|INR)\b/i);
  if (fxMatch3) {
    return { type: "fx", from: fxMatch3[2]!.toUpperCase(), to: fxMatch3[3]!.toUpperCase(), amount: fxMatch3[1] ? parseFloat(fxMatch3[1]) : 1 };
  }

  // Crypto trading pairs: "btc/usdt", "eth/usd"
  const pairMatch = text.match(/\b(btc|eth|sol|bnb|xrp|doge|ada|dot|link|avax)\s*\/\s*\w+\b/i);
  if (pairMatch?.[1]) return { type: "crypto", coin: pairMatch[1] };
  // "price of btc", "price of bitcoin"
  const priceOfMatch = text.match(/\bprice\s+of\s+(btc|eth|sol|bnb|xrp|doge|bitcoin|ethereum|solana|crypto\w*)\b/i);
  if (priceOfMatch?.[1]) return { type: "crypto", coin: priceOfMatch[1] };
  // "btc price", "bitcoin price"
  const coinPriceMatch = text.match(/\b(btc|eth|sol|bnb|xrp|doge|bitcoin|ethereum|solana)\s+(price|value|worth)\b/i);
  if (coinPriceMatch?.[1]) return { type: "crypto", coin: coinPriceMatch[1] };

  // Stock: "AAPL price", "TSLA stock", "what's NVDA at?", "ราคาหุ้น AAPL"
  const stockMatch1 = text.match(/\b([A-Z]{1,5})\s+(?:stock|price|share|share price)\b/i);
  if (stockMatch1?.[1]) return { type: "stock", ticker: stockMatch1[1].toUpperCase() };
  const stockMatch2 = text.match(/\b(?:stock|price)\s+(?:of\s+)?([A-Z]{1,5})\b/i);
  if (stockMatch2?.[1]) return { type: "stock", ticker: stockMatch2[1].toUpperCase() };
  const stockMatch3 = text.match(/\b(?:หุ้น|ราคาหุ้น)\s+([A-Z]{1,5})\b/i);
  if (stockMatch3?.[1]) return { type: "stock", ticker: stockMatch3[1].toUpperCase() };
  // Generic "what's AAPL?" — only if uppercase ticker and finance context
  if (/\b(price|stock|rate|finance|หุ้น|ราคา)\b/i.test(text)) {
    const generic = text.match(/\b([A-Z]{1,5})\b/);
    if (generic?.[1]) return { type: "stock", ticker: generic[1].toUpperCase() };
  }

  return null;
}

export async function fallbackFinance(query: string): Promise<{ text: string; flexMessages?: LineMessage[]; toolCalls: { toolName: string; input: unknown }[] }> {
  const finInfo = looksLikeFinance(query);
  if (!finInfo) return { text: "I couldn't look that up right now.", toolCalls: [] };

  const fTools = buildFinanceTools();

  if (finInfo.type === "crypto") {
    const coin = finInfo.coin;
    try {
      const result = await fTools.crypto_price.execute!({ coin }, { toolCallId: "fallback", messages: [] });
      const val = extractToolValue(result) as CryptoResult | null;
      if (val && typeof val === "object" && val.ok) {
        return {
          text: "",
          flexMessages: [buildCryptoFlex(val)],
          toolCalls: [{ toolName: "crypto_price", input: { coin } }],
        };
      }
      const err = (val as unknown as { error?: string })?.error;
      return { text: err ?? "Couldn't fetch that crypto price right now.", toolCalls: [{ toolName: "crypto_price", input: { coin } }] };
    } catch {
      return { text: "Couldn't fetch that crypto price right now. Try again shortly.", toolCalls: [{ toolName: "crypto_price", input: { coin } }] };
    }
  }

  if (finInfo.type === "stock") {
    const ticker = finInfo.ticker;
    try {
      const result = await fTools.stock_price.execute!({ ticker }, { toolCallId: "fallback", messages: [] });
      const val = extractToolValue(result) as StockResult | null;
      if (val && typeof val === "object" && val.ok) {
        return {
          text: "",
          flexMessages: [buildStockFlex(val)],
          toolCalls: [{ toolName: "stock_price", input: { ticker } }],
        };
      }
      const err = (val as unknown as { error?: string })?.error;
      return { text: err ?? "Couldn't fetch that stock price right now.", toolCalls: [{ toolName: "stock_price", input: { ticker } }] };
    } catch {
      return { text: "Couldn't fetch that stock price right now. Try again shortly.", toolCalls: [{ toolName: "stock_price", input: { ticker } }] };
    }
  }

  // FX
  const { from, to, amount } = finInfo;
  try {
    const result = await fTools.fx_rate.execute!({ from, to, amount }, { toolCallId: "fallback", messages: [] });
    const val = extractToolValue(result) as { ok: true; from: string; to: string; rate: number; amount: number; converted: number; source: string; asOf: string | null } | null;
    if (val && typeof val === "object" && val.ok) {
      const lines = [
        `💱 ${val.amount.toLocaleString()} ${val.from} = ${val.converted.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${val.to}`,
        `Rate: 1 ${val.from} = ${val.rate.toFixed(4)} ${val.to}`,
        `Source: ${val.source}${val.asOf ? ` • ${val.asOf}` : ""}`,
      ];
      return { text: lines.join("\n"), toolCalls: [{ toolName: "fx_rate", input: { from, to, amount } }] };
    }
    const err = (val as unknown as { error?: string })?.error;
    return { text: err ?? "Couldn't fetch that FX rate right now.", toolCalls: [{ toolName: "fx_rate", input: { from, to, amount } }] };
  } catch {
    return { text: "Couldn't fetch that FX rate right now. Try again shortly.", toolCalls: [{ toolName: "fx_rate", input: { from, to, amount } }] };
  }
}

export function looksLikeMediaQuery(text: string): boolean {
  return /\b(read|summarize|analyze|ocr|tell\s+me\s+about|what('s|s|\s+is)|extract)\s+(this|that|it|the\s+(file|pdf|doc|document|image|photo|picture))\b/i.test(text);
}

export function looksLikeNewsQuery(text: string): boolean {
  return /\b(news|headlines?|breaking|latest\s+news|current events|what'?s happening|top\s+news|news\s+today|today'?s\s+news)\b/i.test(text);
}

export function looksLikeHelpQuery(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return /^\/?(help|start)$/.test(lower) || /\bwhat\s+can\s+you\s+do\b/i.test(lower) || /\bwhat\s+are\s+your\s+(feature|capabilities|function)/i.test(lower);
}

// Catch-all: does this look like a factual or research question worth searching?
// Excludes casual chat, single-word utterances, and pure commands.
export function looksLikeFactualQuery(text: string): boolean {
  const t = text.trim();
  // Too short to be a real question
  if (t.length < 8) return false;
  // Looks like a question or research query
  return (
    /\?(^|$)/.test(t) ||
    /^(what|who|when|where|why|how|which|is|are|was|were|can|does|do|will|has|have)\b/i.test(t) ||
    /\b(price|rate|value|cost|score|rank|population|capital|founded|ceo|owner|headquarters)\b/i.test(t) ||
    /\b(latest|current|today|now|right\s+now|live|real[- ]?time)\b/i.test(t)
  );
}

export async function fallbackWeather(
  query: string,
  _timezone = "Asia/Bangkok",
  language?: string | null,
  defaultLocation?: string | null,
): Promise<{ text: string; flexMessages?: LineMessage[]; toolCalls: { toolName: string; input: unknown }[] }> {
  const locationMatch = query.match(/\b(?:in|at|for)\s+(.{2,80}?)\s*(?:\?|$)/i);
  const location = locationMatch?.[1]?.trim() ?? defaultLocation ?? "Bangkok";
  const wTools = buildWeatherTools();
  try {
    const result = await wTools.weather.execute!({ location }, { toolCallId: "fallback", messages: [] });
    const val = extractToolValue(result) as WeatherResult | null;
    if (val && typeof val === "object" && val.ok && val.current) {
      return {
        text: "",
        flexMessages: [buildWeatherFlex(val)],
        toolCalls: [{ toolName: "weather", input: { location } }],
      };
    }
    return { text: t(language, "done"), toolCalls: [{ toolName: "weather", input: { location } }] };
  } catch {
    return { text: t(language, "agentErrGeneric"), toolCalls: [{ toolName: "weather", input: { location } }] };
  }
}

export async function fallbackNewsSearch(
  query: string,
  language?: string | null,
): Promise<{ text: string; flexMessages?: LineMessage[]; toolCalls: { toolName: string; input: unknown }[] }> {
  const topicMatch = query.match(/\b(?:news\s+(?:on|about)|about|on)\s+(.{2,80}?)\s*(?:\?|$)/i);
  const topic = (topicMatch?.[1]?.trim() ?? query.replace(/\b(latest|news|today|on|about|the)\b/gi, "").trim()) || "top news";
  try {
    const nTools = buildNewsTools();
    const result = await nTools.news_search.execute!({ query: topic, days: 2, count: 5 }, { toolCallId: "fallback", messages: [] });
    const val = extractToolValue(result) as Record<string, unknown> | null;
    const stories = Array.isArray(val?.stories) ? val.stories as Array<{ title: string; url: string; snippet?: string; source?: string }> : [];
    if (stories.length === 0) return { text: t(language, "done"), toolCalls: [{ toolName: "news_search", input: { query: topic } }] };
    return {
      text: "",
      flexMessages: [newsFlex(stories, `📰 ${topic}`)],
      toolCalls: [{ toolName: "news_search", input: { query: topic } }],
    };
  } catch {
    return { text: t(language, "agentErrUnavailable"), toolCalls: [{ toolName: "news_search", input: { query: topic } }] };
  }
}

export async function fallbackSummarizeDocument(
  userId: string,
  displayName: string,
  question: string,
  language?: string | null,
): Promise<{ text: string; flexMessages?: LineMessage[]; toolCalls: { toolName: string; input: unknown }[] }> {
  // Pass the user's actual question through — previously called with {} (index
  // only), which silently discarded whatever they specifically asked and always
  // returned a generic 4-8 bullet summary instead of an answer to their question.
  const input = { question };
  try {
    const tools = buildMediaAiTools(userId);
    const result = await tools.summarize_document!.execute!(input as unknown as { index?: number; question?: string }, { toolCallId: "fallback", messages: [] });
    const val = extractToolValue(result) as Record<string, unknown> | null;
    if (val && typeof val === "object" && val.ok === false && typeof val.error === "string") {
      return { text: val.error, toolCalls: [{ toolName: "summarize_document", input }] };
    }
    const output = val && typeof val === "object" && typeof val.output === "string" ? val.output : String(result);
    return { text: `${displayName}, ${output}`, toolCalls: [{ toolName: "summarize_document", input }] };
  } catch (err) {
    return { text: t(language, "agentErrGeneric"), toolCalls: [{ toolName: "summarize_document", input }] };
  }
}

export async function fallbackWebSearch(
  query: string,
  language?: string | null,
): Promise<{ text: string; flexMessages?: LineMessage[]; toolCalls: { toolName: string; input: unknown }[] }> {
  const wsTool = buildWebSearchTool();
  try {
    const result = await wsTool.web_search.execute!({ query, count: 5 }, { toolCallId: "fallback", messages: [] });
    const val = extractToolValue(result) as Record<string, unknown> | null;
    if (val && val.ok === false) {
      return { text: t(language, "agentErrUnavailable"), toolCalls: [{ toolName: "web_search", input: { query } }] };
    }
    const answer = typeof val?.answer === "string" && val.answer ? val.answer : null;
    const results = Array.isArray(val?.results) ? val.results as Array<{ title: string; url: string; content?: string }> : [];
    if (answer) {
      return { text: answer, toolCalls: [{ toolName: "web_search", input: { query } }] };
    }
    if (results.length > 0) {
      const lines = results.slice(0, 3).map((r) => `• ${r.title}: ${(r.content ?? "").slice(0, 120)}...`).join("\n");
      return { text: lines, toolCalls: [{ toolName: "web_search", input: { query } }] };
    }
    return { text: t(language, "agentErrGeneric"), toolCalls: [{ toolName: "web_search", input: { query } }] };
  } catch {
    return { text: t(language, "agentErrUnavailable"), toolCalls: [{ toolName: "web_search", input: { query } }] };
  }
}

export async function fallbackListTasks(
  userId: string,
  _displayName: string,
  timezone = "Asia/Bangkok",
  language?: string | null,
): Promise<{ text: string; flexMessages?: LineMessage[]; toolCalls: { toolName: string; input: unknown }[] }> {
  const tasks = await listTasks(userId, "open");
  if (tasks.length === 0) {
    return {
      text: "",
      flexMessages: [buildSimpleCardFlex("✅ Tasks", "#00B894", [{ primary: t(language, "noTasks") }])],
      toolCalls: [{ toolName: "list_tasks", input: { filter: "open" } }],
    };
  }
  return {
    text: "",
    flexMessages: [taskListFlex(
      tasks.map((t) => ({ id: t.id, title: t.title, done: Boolean(t.doneAt), dueAt: t.dueAt })),
      { timezone },
    )],
    toolCalls: [{ toolName: "list_tasks", input: { filter: "open" } }],
  };
}

export function getLastUserText(messages: ModelMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== "user") continue;
    if (typeof m.content === "string") return m.content;
    if (Array.isArray(m.content)) {
      return m.content
        .filter((part): part is { type: "text"; text: string } =>
          typeof part === "object" &&
          part !== null &&
          (part as { type?: string }).type === "text" &&
          typeof (part as { text?: unknown }).text === "string"
        )
        .map((part) => part.text)
        .filter(Boolean)
        .join(" ");
    }
  }
  return "";
}

export async function handleAgentError(err: unknown, userId: string, language?: string | null, traceId?: string): Promise<string> {
  try {
    const authErr = unwrapAuthRequired(err);
    if (authErr) {
      // Ensures the connect link exists / env is configured, but we don't paste
      // the raw URL into text (dead, unselectable inside a Flex text bubble).
      // hints.needsGoogleConnect (set below) adds a "Connect Google" quick
      // reply that routes through the tappable-button shortcut instead.
      await buildConnectUrl(userId);
      return t(language, "agentErrConnect");
    }
  } catch (e) {
    console.error("[agent] buildConnectUrl failed in error handler", e);
  }

  const confirmErr = unwrapCause(err, (v): v is NeedsConfirmation => v instanceof NeedsConfirmation);
  if (confirmErr) {
    return confirmErr.message;
  }
  const rateErr = unwrapCause(err, (v): v is RateLimited => v instanceof RateLimited);
  if (rateErr) {
    return t(language, "agentErrRateLimit", { sec: String(rateErr.retryAfterSec) });
  }
  if (err instanceof AgentTimeoutError) {
    console.warn("[agent] timeout", { seconds: err.seconds, traceId });
    return t(language, "agentErrTimeout");
  }
  if (err instanceof Error && /abort|aborted|AbortError|This operation was aborted/i.test(err.message)) {
    console.warn("[agent] LLM call aborted (timeout)", { traceId });
    return t(language, "agentErrTimeout");
  }
  const msg = err instanceof Error ? err.message : String(err);
  // AI_RetryError wraps the 503: its .message is "Failed after N attempts. Last error: ..."
  // The 503/UNAVAILABLE status lives in the nested cause, not in msg itself.
  // Bug 4 & 5: Gemini 503 / cold-start Bad Gateway — return friendly message, not raw error
  if (
    /UNAVAILABLE|Bad.?Gateway|service.?unavailable|high demand|experiencing.*demand/i.test(msg) ||
    /\b50[23]\b/.test(msg) ||
    /AI_RetryError|maxRetriesExceeded/i.test(msg)
  ) {
    console.warn("[agent] service unavailable", { msg: msg.slice(0, 200), traceId });
    return t(language, "agentErrUnavailable");
  }
  if (/spending cap|RESOURCE_EXHAUSTED|exceeded its monthly|rate limit|429/i.test(msg)) {
    console.warn("[agent] LLM quota exhausted", { msg: msg.slice(0, 200), traceId });
    return t(language, "agentErrQuota");
  }
  console.error("[agent] unhandled", err, { traceId });
  return t(language, "agentErrGeneric");
}
