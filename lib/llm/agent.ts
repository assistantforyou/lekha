import { performance } from "perf_hooks";
import { generateText, stepCountIs, type ModelMessage } from "ai";
import { chatModelForTier, hasFreeKey, hasPaidKey, AGENT_TIMEOUT_MS, GEMINI_PROVIDER_OPTIONS } from "@/lib/llm/provider";
import { isTierDown, markTierDown } from "@/lib/llm/health";
import { buildSystemPrompt, buildTimeContext } from "@/lib/llm/prompts";
import { factsToPromptBlock, loadFacts, displayOrder } from "@/lib/memory/facts";
import { listAccounts } from "@/lib/tools/google-auth";
import { listRecentMedia } from "@/lib/memory/recent-media";
import { listTasks } from "@/lib/memory/tasks";
import { getSettings } from "@/lib/memory/settings";
import { toolsForUser } from "@/lib/tools";
import { renderDraftsBlock } from "@/lib/llm/render-drafts";
import { buildConnectUrl } from "@/lib/tools/google-auth";
import type { ToolSet } from "ai";
import { GoogleAuthRequired, NeedsConfirmation, RateLimited, unwrapCause, unwrapAuthRequired } from "@/lib/errors";
import type { LineMessage } from "@/lib/line/client";
import { buildFlexFromToolResults, buildFollowUps, buildSimpleCardFlex, buildDraftFlexCards } from "@/lib/llm/agent-flex";
import { taskListFlex, newsFlex } from "@/lib/line/flex";
import { buildWeatherFlex, type WeatherResult } from "@/lib/line/weather-flex";
import { span, tick, withTimeout, AgentTimeoutError } from "@/lib/timing";
import { stripMarkdown } from "@/lib/format";
import { ACTION_LABELS } from "@/lib/llm/action-labels";
import { buildMediaAiTools } from "@/lib/tools/media-ai";
import { buildWeatherTools } from "@/lib/tools/weather";
import { buildNewsTools } from "@/lib/tools/news";
import { buildFinanceTools } from "@/lib/tools/finance";
import { buildWebSearchTool } from "@/lib/tools/web-search";
import { buildCryptoFlex, buildStockFlex, type CryptoResult, type StockResult } from "@/lib/line/finance-flex";
import { HELP_TEXT } from "@/lib/tools/help";

/**
 * Map a fastClassify hint to a facts-injection limit.
 * Stateless queries (weather, finance, news) need almost no user facts;
 * memory/email/calendar queries benefit from fuller context.
 * undefined hint (ambiguous/multi-topic) gets a moderate default.
 */
function factLimitForHint(hint: string | undefined): number {
  if (!hint) return 20;
  switch (hint) {
    // Stateless lookups — only inject location/context facts (top 5)
    case "weather":
    case "finance":
    case "news":
      return 5;
    // Tool-focused queries — moderate context
    case "reminder":
    case "task":
    case "lists":
    case "settings":
    case "media":
    case "receipts":
      return 12;
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

export function extractToolValue(output: unknown): unknown {
  if (output && typeof output === "object") {
    const o = output as { type?: string; value?: unknown };
    if (o.type === "json" && "value" in o) return o.value;
    return output;
  }
  return output;
}

function classifyResultType(val: unknown): string {
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
function createStepTracker(traceId: string | undefined) {
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
};

function processResult(
  result: any,
  activeEmail: string | null,
  allCalls: { toolName: string; input: unknown }[],
  timezone?: string,
): ProcessedResult {
  let authNeeded: { connectUrl: string; reason: string } | null = null;
  let apiDisabled: { api: string; enableUrl: string | null; message: string } | null = null;
  let googleErr: { status: number | null; message: string } | null = null;
  const toolErrors: string[] = [];

  // Single pass: scan all tool results for auth/errors/tool-errors
  for (const step of result.steps) {
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
      } else if (v.ok === false && typeof v.error === "string") {
        const toolName = (tr as { toolName?: string }).toolName ?? "tool";
        toolErrors.push(`${toolName}: ${v.error}`);
      }
    }
  }

  if (authNeeded) return { reply: "", authNeeded, apiDisabled: null, googleErr: null };
  if (apiDisabled) return { reply: "", authNeeded: null, apiDisabled, googleErr: null };
  if (googleErr) return { reply: "", authNeeded: null, apiDisabled: null, googleErr };

  const draftBlock = renderDraftsBlock(allCalls, activeEmail, timezone);
  const modelText = result.text?.trim() ?? "";

  if (toolErrors.length > 0 && !draftBlock) {
    const allErrorsPresent = toolErrors.every((e) => modelText.includes(e.split(": ").slice(1).join(": ")));
    if (!allErrorsPresent) {
      console.warn("[agent] model soft-apologized — overriding with real tool errors", toolErrors);
      return { reply: toolErrors.join("\n"), authNeeded: null, apiDisabled: null, googleErr: null };
    }
  }

  if (draftBlock) {
    const intro = modelText.length > 0 && modelText.length < 240 ? `${modelText}\n\n` : "";
    return { reply: `${intro}${draftBlock}`, authNeeded: null, apiDisabled: null, googleErr: null };
  }

  if (modelText.length > 0) return { reply: modelText, authNeeded: null, apiDisabled: null, googleErr: null };
  if (allCalls.length > 0) {
    for (const step of result.steps) {
      for (const tr of step.toolResults) {
        const toolName = (tr as { toolName?: string }).toolName ?? "";
        if (toolName === "get_morning_briefing" || toolName === "get_evening_summary") {
          return { reply: "", authNeeded: null, apiDisabled: null, googleErr: null };
        }
      }
    }
    const labels = allCalls.map((c) => ACTION_LABELS[c.toolName]).filter((l): l is string => l != null);
    const unique = [...new Set(labels)];
    return { reply: unique.length ? unique.join(" • ") + " ✓" : "Done.", authNeeded: null, apiDisabled: null, googleErr: null };
  }
  return { reply: "I didn't catch that — could you rephrase?", authNeeded: null, apiDisabled: null, googleErr: null };
}


function formatProcessed(processed: ProcessedResult): string {
  if (processed.authNeeded) {
    const isReauth = processed.authNeeded.reason.includes("scopes") || processed.authNeeded.reason.includes("reconnect") || processed.authNeeded.reason.includes("no longer valid");
    const intro = isReauth
      ? "Your Google connection expired and needs to be refreshed."
      : "I need access to your Google account to do that.";
    return `${intro}\n\nType "connect google" to reconnect — it only takes a few seconds.\n\n${processed.authNeeded.connectUrl}`;
  }
  if (processed.apiDisabled) {
    const enableHint = processed.apiDisabled.enableUrl
      ? `\n\nEnable it here:\n${processed.apiDisabled.enableUrl}`
      : `\n\nEnable it in Google Cloud Console → APIs & Services → Library.`;
    return `Google says the ${processed.apiDisabled.api} isn't enabled in your Cloud project.${enableHint}\n\nGive it ~1 min to propagate after enabling, then try again.`;
  }
  if (processed.googleErr) {
    const status = processed.googleErr.status ? ` (HTTP ${processed.googleErr.status})` : "";
    return `Google API error${status}: ${processed.googleErr.message}`;
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
};

export async function runAgent(
  userId: string,
  profile: { displayName: string },
  facts: Awaited<ReturnType<typeof loadFacts>>,
  messages: ModelMessage[],
  traceId?: string,
  opts?: {
    accounts?: Awaited<ReturnType<typeof listAccounts>>;
    staged?: Awaited<ReturnType<typeof listRecentMedia>>;
    tools?: ToolSet;
    hasStagedMedia?: boolean;
    /** Pass pre-loaded settings to avoid a duplicate getSettings call. */
    settings?: Awaited<ReturnType<typeof getSettings>>;
    /** fastClassify hint — used to narrow the facts injected into the prompt. */
    hint?: string;
    /** The current user message already includes the image bytes; don't tell the model to call image-reading tools. */
    imageBundled?: boolean;
    /** Override the default 30s agent timeout. Use 55s when image bytes are in the request. */
    timeoutMs?: number;
  },
): Promise<AgentResult> {
  const endAgent = span("agent:runAgent", traceId);

  try {
    const [accounts, staged, settings] = await Promise.all([
      opts?.accounts ? Promise.resolve(opts.accounts) : listAccounts(userId),
      opts?.staged ? Promise.resolve(opts.staged) : listRecentMedia(userId),
      opts?.settings ? Promise.resolve(opts.settings) : getSettings(userId),
    ]);
    const userHasGoogle = accounts.accounts.length > 0;
    tick("agent:preload-done", traceId, { accounts: accounts.accounts.length, staged: staged.length });
    const accountsBlock = accounts.accounts.length
      ? `\n\nConnected Google accounts: ${accounts.accounts
          .map((a) => `${a.email}${a.email === accounts.activeEmail ? " (active)" : ""}`)
          .join(", ")}.`
      : "";
    // Only mention staged items from the last 10 minutes to keep the prompt tight.
    const freshStaged = staged.filter((m) => Date.now() - m.ts < 10 * 60_000);
    const recentBlock = freshStaged.length
      ? opts?.imageBundled
        ? `\n\nThe user's current message includes the image shown above. Answer based on that image. Do NOT call \`ocr_image\` or \`summarize_image\` for this image — it is already visible to you.\n\nOther staged LINE media (1-indexed, oldest first):\n${freshStaged
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
            .join("\n")}\nIf they ask about a PDF/document above, call \`summarize_document\` or \`read_document\`. Use \`attach_recent_media\` / \`attach_recent_media_indexes\` only when attaching files to an email.`
        : `\n\nStaged LINE media (1-indexed, oldest first). The user may be referring to one of these:\n${freshStaged
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
            .join("\n")}\nIf the user asks about an image, call \`ocr_image\` or \`summarize_image\` with the index. If they ask about a PDF/document, call \`summarize_document\` or \`read_document\`. Use \`attach_recent_media\` / \`attach_recent_media_indexes\` only when attaching files to an email.`
      : "";
    const tz = settings.timezone ?? "Asia/Bangkok";
    const factsBlock = factsToPromptBlock(facts, factLimitForHint(opts?.hint));
    const system = buildSystemPrompt(factsBlock, profile, settings);

    // Volatile per-request context goes into a synthetic first message pair so
    // the system prompt stays stable and Gemini's implicit prefix cache can hit.
    const recencyReminder = opts?.hint === "recent"
      ? "This message likely asks about current or recent information. ALWAYS search the web (web_search or news_search) before answering. Do not rely on training data."
      : "";
    const contextParts = [buildTimeContext(tz), accountsBlock, recentBlock, recencyReminder].filter(Boolean).join("\n");
    const timePrefix: ModelMessage[] = contextParts
      ? [
          { role: "user", content: [{ type: "text", text: contextParts }] },
          { role: "assistant", content: [{ type: "text", text: "Got it." }] },
        ]
      : [];

    const tracker = createStepTracker(traceId);

    const endTools = span("agent:toolsForUser", traceId);
    const tools =
      opts?.tools ??
      (await toolsForUser(userId, {
        userHasGoogle,
        disabledCategories: settings.disabledCategories,
        hasStagedMedia: opts?.hasStagedMedia,
      }));
    endTools({ toolCount: Object.keys(tools).length });

    const endGenerate = span("agent:generateText", traceId);

    // Build ordered tier list: free first (separate GCP project, no billing),
    // paid as fallback. Skip a tier if its key is absent or recently marked down.
    const [freeDown, paidDown] = await Promise.all([
      hasFreeKey() ? isTierDown("free") : Promise.resolve(true),
      hasPaidKey() ? isTierDown("paid") : Promise.resolve(true),
    ]);
    const tiersToTry: ("free" | "paid")[] = [];
    if (hasFreeKey() && !freeDown) tiersToTry.push("free");
    if (hasPaidKey() && !paidDown) tiersToTry.push("paid");
    if (tiersToTry.length === 0) tiersToTry.push(hasFreeKey() ? "free" : "paid");

    let geminiRanToolCalls = false;
    let lastTierErr: unknown = null;
    let result: Awaited<ReturnType<typeof generateText>> | undefined;

    for (let i = 0; i < tiersToTry.length; i++) {
      const tier = tiersToTry[i]!;
      try {
        result = await withTimeout(
          generateText({
            model: chatModelForTier(tier),
            system,
            messages: [...timePrefix, ...messages],
            tools,
            temperature: 0.6,
            stopWhen: stepCountIs(8),
            maxRetries: 3,
            onStepFinish: (step) => {
              if (step.toolCalls.length > 0) geminiRanToolCalls = true;
              tracker.record(step as Parameters<ReturnType<typeof createStepTracker>["record"]>[0]);
            },
            providerOptions: GEMINI_PROVIDER_OPTIONS,
          }),
          opts?.timeoutMs ?? AGENT_TIMEOUT_MS,
        );
        if (tiersToTry.length > 1 && i > 0) console.log("[tier] switched to", tier, { ms: Date.now() });
        break;
      } catch (err) {
        const isTimeout = err instanceof AgentTimeoutError;
        const isQuota = /spending cap|RESOURCE_EXHAUSTED|exceeded.*quota|quota exceeded|exceeded its monthly|rate.?limit|429/i.test(
          err instanceof Error ? err.message : String(err),
        );
        if (!isQuota && !isTimeout) throw err;
        if (isTimeout && geminiRanToolCalls) throw err;
        await markTierDown(tier, 60).catch(() => {});
        lastTierErr = err;
        const nextTier = tiersToTry[i + 1];
        console.warn(`[tier] ${tier}→${nextTier ?? "none"} (${isTimeout ? "timeout" : "quota"})`, { ms: Date.now() });
      }
    }

    if (!result) throw lastTierErr ?? new Error("All Gemini tiers exhausted — try again shortly");
    const usage = result.usage as { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined;
    const cached = (result as { experimental_providerMetadata?: { google?: { cachedContentTokenCount?: number } } }).experimental_providerMetadata?.google?.cachedContentTokenCount;
    const costUsd =
      ((usage?.promptTokens ?? 0) * 0.3) / 1_000_000 +
      ((cached ?? 0) * 0.075) / 1_000_000 +
      ((usage?.completionTokens ?? 0) * 2.5) / 1_000_000;
    console.log("[agent] usage", {
      traceId,
      promptTokens: usage?.promptTokens ?? 0,
      completionTokens: usage?.completionTokens ?? 0,
      cachedTokens: cached ?? 0,
      costUsd: Math.round(costUsd * 10000) / 10000,
    });
    endGenerate({
      steps: result.steps.length,
      toolCalls: tracker.allCalls.length,
      stepTimes: tracker.stepTimes,
      totalToolMs: tracker.stepTimes.reduce((a, b) => a + b, 0),
      promptTokens: usage?.promptTokens ?? 0,
      completionTokens: usage?.completionTokens ?? 0,
      cachedTokens: cached ?? 0,
      costUsd,
    });
    const endProcess = span("agent:processResult", traceId);
    const processed = processResult(result as any, accounts.activeEmail, tracker.successfulCalls, settings?.timezone);
    const text = formatProcessed(processed);
    const draftToolNames = tracker.successfulCalls
      .filter((c) =>
        c.toolName === "draft_email" ||
        c.toolName === "draft_calendar_event" ||
        c.toolName === "schedule_email",
      )
      .map((c) => c.toolName);
    const confirmDraft = draftToolNames.length > 0;
    if (confirmDraft && tracker.successfulCalls.length === 0) {
      console.error("[agent] BUG: confirmDraft=true but successfulCalls is empty — this should never happen");
    }
    const lastUserText = getLastUserText(messages);
    let { messages: flexMessages, suppressText } = buildFlexFromToolResults(result as any, settings?.timezone, {
      userText: lastUserText,
    });
    // Build rich Flex cards for draft confirmations (with YES/NO postback buttons).
    let hasDraftFlex = false;
    if (confirmDraft) {
      const draftCalls = tracker.successfulCalls.filter((c) =>
        c.toolName === "draft_email" ||
        c.toolName === "draft_calendar_event" ||
        c.toolName === "schedule_email",
      );
      const draftCards = buildDraftFlexCards(draftCalls, settings?.timezone);
      if (draftCards.length > 0) {
        flexMessages = [...draftCards, ...flexMessages];
        suppressText = true;
        hasDraftFlex = true;
      }
    }
    // NEVER suppress text when auth is needed — the connect message is critical.
    let finalText = suppressText && !processed.authNeeded ? "" : text;
    let extraToolCalls = tracker.allCalls;
    const looksBlankOrUnhelpful = finalText === "I didn't catch that — could you rephrase?" ||
      (finalText.length < 60 && !processed.authNeeded && !processed.apiDisabled && !processed.googleErr && tracker.successfulCalls.length === 0);
    if (looksBlankOrUnhelpful) {
      // Deterministic fallbacks: if the model blanks on an unambiguous query,
      // execute the canonical tool ourselves and return a Flex card.
      if (looksLikeMemoryRecall(lastUserText)) {
        const fb = await fallbackListMemories(userId, profile.displayName);
        finalText = fb.text;
        extraToolCalls = fb.toolCalls;
        if (fb.flexMessages?.length) flexMessages = [...flexMessages, ...fb.flexMessages];
      } else if (looksLikeTaskList(lastUserText)) {
        const fb = await fallbackListTasks(userId, profile.displayName, settings?.timezone);
        finalText = fb.text;
        extraToolCalls = fb.toolCalls;
        if (fb.flexMessages?.length) flexMessages = [...flexMessages, ...fb.flexMessages];
      } else if (looksLikeWeather(lastUserText)) {
        const fb = await fallbackWeather(lastUserText, settings?.timezone);
        finalText = fb.text;
        extraToolCalls = fb.toolCalls;
        if (fb.flexMessages?.length) flexMessages = [...flexMessages, ...fb.flexMessages];
      } else if (looksLikeFinance(lastUserText)) {
        const fb = await fallbackFinance(lastUserText);
        finalText = fb.text;
        extraToolCalls = fb.toolCalls;
        if (fb.flexMessages?.length) flexMessages = [...flexMessages, ...fb.flexMessages];
      } else if (opts?.hasStagedMedia && looksLikeMediaQuery(lastUserText)) {
        const fb = await fallbackSummarizeDocument(userId, profile.displayName);
        finalText = fb.text;
        extraToolCalls = fb.toolCalls;
      } else if (looksLikeNewsQuery(lastUserText)) {
        const fb = await fallbackNewsSearch(lastUserText);
        finalText = fb.text;
        extraToolCalls = fb.toolCalls;
        if (fb.flexMessages?.length) flexMessages = [...flexMessages, ...fb.flexMessages];
      } else if (looksLikeHelpQuery(lastUserText)) {
        finalText = HELP_TEXT;
        extraToolCalls = [{ toolName: "show_help", input: {} }];
      } else if (looksLikeFactualQuery(lastUserText)) {
        // Universal fallback: any factual/research question the model blanked on
        // → web_search. This is how Claude.ai/Gemini work: web search is always
        // the backstop for current or factual queries the model can't answer alone.
        const fb = await fallbackWebSearch(lastUserText);
        finalText = fb.text;
        extraToolCalls = fb.toolCalls;
        if (fb.flexMessages?.length) flexMessages = [...flexMessages, ...fb.flexMessages];
      }
    }
    const followUps = buildFollowUps(extraToolCalls.map((c) => c.toolName), { confirmDraft, modelText: finalText });
    endProcess({ confirmDraft, flexCount: flexMessages?.length ?? 0 });
    const hints: AgentHints = {
      confirmDraft,
      hasDraftFlex,
      pickAccount:
        accounts.accounts.length > 1 &&
        /which (google )?account/i.test(text) &&
        tracker.successfulCalls.some((c) =>
          c.toolName === "draft_email" ||
          c.toolName === "draft_calendar_event" ||
          c.toolName === "drive_upload_recent_media",
        ),
      needsGoogleConnect:
        processed.authNeeded !== null || (accounts.accounts.length === 0 && /connect google/i.test(text)),
      flexMessages,
      followUps,
    };
    endAgent({ success: true, steps: result.steps.length, toolCalls: extraToolCalls.length, replyLength: finalText.length });
    return { text: finalText, hints, toolCalls: extraToolCalls };
  } catch (err) {
    const errText = await handleAgentError(err, userId, traceId);
    endAgent({ error: err instanceof Error ? err.message : String(err) });
    return {
      text: errText,
      hints: {
        confirmDraft: false,
        hasDraftFlex: false,
        pickAccount: false,
        needsGoogleConnect: unwrapAuthRequired(err) !== undefined,
      },
      toolCalls: [],
    };
  }
}

const MEMORY_RECALL_TRIGGERS = [
  /\bwhat\s+do\s+you\s+remember\b/i,
  /\bwhat\s+do\s+you\s+know\s+about\s+me\b/i,
  /\bwhat\s+have\s+you\s+remembered\b/i,
  /\b(list|show|tell)\s+me\s+what\s+you\s+remember\b/i,
  /\b(my\s+memories|my\s+remembered\s+facts)\b/i,
];

function looksLikeMemoryRecall(text: string): boolean {
  return MEMORY_RECALL_TRIGGERS.some((r) => r.test(text));
}

function looksLikeTaskList(text: string): boolean {
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

async function fallbackListMemories(userId: string, _displayName: string): Promise<{ text: string; flexMessages?: LineMessage[]; toolCalls: { toolName: string; input: unknown }[] }> {
  const f = await loadFacts(userId);
  const ordered = displayOrder(f.facts);
  if (ordered.length === 0) {
    return {
      text: "",
      flexMessages: [buildSimpleCardFlex("🧠 What I Remember", "#A29BFE", [{ primary: "Nothing saved yet." }])],
      toolCalls: [{ toolName: "list_memories", input: {} }],
    };
  }
  const items = ordered.map((fact) => ({ primary: fact.content, secondary: fact.category }));
  return {
    text: "",
    flexMessages: [buildSimpleCardFlex("🧠 What I Remember", "#A29BFE", items)],
    toolCalls: [{ toolName: "list_memories", input: {} }],
  };
}

function looksLikeWeather(text: string): boolean {
  return /\b(weather|forecast|temperature|temp)\b/i.test(text);
}

function looksLikeFinance(text: string): { type: "crypto"; coin: string } | { type: "stock"; ticker: string } | null {
  // Trading pairs: "btc/usdt", "eth/usd"
  const pairMatch = text.match(/\b(btc|eth|sol|bnb|xrp|doge|ada|dot|link|avax)\s*\/\s*\w+\b/i);
  if (pairMatch?.[1]) return { type: "crypto", coin: pairMatch[1] };
  // "price of btc", "price of bitcoin"
  const priceOfMatch = text.match(/\bprice\s+of\s+(btc|eth|sol|bnb|xrp|doge|bitcoin|ethereum|solana|crypto\w*)\b/i);
  if (priceOfMatch?.[1]) return { type: "crypto", coin: priceOfMatch[1] };
  // "btc price", "bitcoin price"
  const coinPriceMatch = text.match(/\b(btc|eth|sol|bnb|xrp|doge|bitcoin|ethereum|solana)\s+(price|value|worth)\b/i);
  if (coinPriceMatch?.[1]) return { type: "crypto", coin: coinPriceMatch[1] };
  return null;
}

async function fallbackFinance(query: string): Promise<{ text: string; flexMessages?: LineMessage[]; toolCalls: { toolName: string; input: unknown }[] }> {
  const finInfo = looksLikeFinance(query);
  if (!finInfo || finInfo.type !== "crypto") return { text: "I couldn't look that up right now.", toolCalls: [] };
  const coin = finInfo.coin;
  const fTools = buildFinanceTools();
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
    return { text: err ?? "Couldn't fetch that price right now.", toolCalls: [{ toolName: "crypto_price", input: { coin } }] };
  } catch {
    return { text: "Couldn't fetch that price right now. Try again shortly.", toolCalls: [{ toolName: "crypto_price", input: { coin } }] };
  }
}

function looksLikeMediaQuery(text: string): boolean {
  return /\b(read|summarize|analyze|ocr|tell\s+me\s+about|what('s|s|\s+is)|extract)\s+(this|that|it|the\s+(file|pdf|doc|document|image|photo|picture))\b/i.test(text);
}

function looksLikeNewsQuery(text: string): boolean {
  return /\b(news|headlines?|breaking|latest\s+news|current events|what'?s happening|top\s+news|news\s+today|today'?s\s+news)\b/i.test(text);
}

function looksLikeHelpQuery(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return /^\/?(help|start)$/.test(lower) || /\bwhat\s+can\s+you\s+do\b/i.test(lower) || /\bwhat\s+are\s+your\s+(feature|capabilities|function)/i.test(lower);
}

// Catch-all: does this look like a factual or research question worth searching?
// Excludes casual chat, single-word utterances, and pure commands.
function looksLikeFactualQuery(text: string): boolean {
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

async function fallbackWeather(query: string, _timezone = "Asia/Bangkok"): Promise<{ text: string; flexMessages?: LineMessage[]; toolCalls: { toolName: string; input: unknown }[] }> {
  const locationMatch = query.match(/\b(?:in|at|for)\s+(.{2,80}?)\s*(?:\?|$)/i);
  const location = locationMatch?.[1]?.trim() ?? "Bangkok";
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
    return { text: "Weather lookup completed.", toolCalls: [{ toolName: "weather", input: { location } }] };
  } catch {
    return { text: `I couldn't get the weather for ${location} right now.`, toolCalls: [{ toolName: "weather", input: { location } }] };
  }
}

async function fallbackNewsSearch(query: string): Promise<{ text: string; flexMessages?: LineMessage[]; toolCalls: { toolName: string; input: unknown }[] }> {
  const topicMatch = query.match(/\b(?:news\s+(?:on|about)|about|on)\s+(.{2,80}?)\s*(?:\?|$)/i);
  const topic = (topicMatch?.[1]?.trim() ?? query.replace(/\b(latest|news|today|on|about|the)\b/gi, "").trim()) || "top news";
  try {
    const nTools = buildNewsTools();
    const result = await nTools.news_search.execute!({ query: topic, days: 2, count: 5 }, { toolCallId: "fallback", messages: [] });
    const val = extractToolValue(result) as Record<string, unknown> | null;
    const stories = Array.isArray(val?.stories) ? val.stories as Array<{ title: string; url: string; snippet?: string; source?: string }> : [];
    if (stories.length === 0) return { text: `No news found for "${topic}" right now.`, toolCalls: [{ toolName: "news_search", input: { query: topic } }] };
    return {
      text: "",
      flexMessages: [newsFlex(stories, `📰 ${topic}`)],
      toolCalls: [{ toolName: "news_search", input: { query: topic } }],
    };
  } catch {
    return { text: `I couldn't fetch news right now. Try again shortly.`, toolCalls: [{ toolName: "news_search", input: { query: topic } }] };
  }
}

async function fallbackSummarizeDocument(userId: string, displayName: string): Promise<{ text: string; flexMessages?: LineMessage[]; toolCalls: { toolName: string; input: unknown }[] }> {
  try {
    const tools = buildMediaAiTools(userId);
    const result = await tools.summarize_document!.execute!({} as unknown as { index?: number }, { toolCallId: "fallback", messages: [] });
    const val = extractToolValue(result) as Record<string, unknown> | null;
    if (val && typeof val === "object" && val.ok === false && typeof val.error === "string") {
      return { text: val.error, toolCalls: [{ toolName: "summarize_document", input: {} }] };
    }
    const output = val && typeof val === "object" && typeof val.output === "string" ? val.output : String(result);
    return { text: `${displayName}, here's what I found in the document:\n\n${output}`, toolCalls: [{ toolName: "summarize_document", input: {} }] };
  } catch (err) {
    return { text: `I couldn't read that document, ${displayName}. Try sending it again.`, toolCalls: [{ toolName: "summarize_document", input: {} }] };
  }
}

async function fallbackWebSearch(query: string): Promise<{ text: string; flexMessages?: LineMessage[]; toolCalls: { toolName: string; input: unknown }[] }> {
  const wsTool = buildWebSearchTool();
  try {
    const result = await wsTool.web_search.execute!({ query, count: 5 }, { toolCallId: "fallback", messages: [] });
    const val = extractToolValue(result) as Record<string, unknown> | null;
    if (val && val.ok === false) {
      return { text: "I couldn't search for that right now. Please try again.", toolCalls: [{ toolName: "web_search", input: { query } }] };
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
    return { text: "I couldn't find anything for that right now.", toolCalls: [{ toolName: "web_search", input: { query } }] };
  } catch {
    return { text: "Search failed. Please try again shortly.", toolCalls: [{ toolName: "web_search", input: { query } }] };
  }
}

async function fallbackListTasks(userId: string, _displayName: string, timezone = "Asia/Bangkok"): Promise<{ text: string; flexMessages?: LineMessage[]; toolCalls: { toolName: string; input: unknown }[] }> {
  const tasks = await listTasks(userId, "open");
  if (tasks.length === 0) {
    return {
      text: "",
      flexMessages: [buildSimpleCardFlex("✅ Tasks", "#00B894", [{ primary: "No open tasks right now. 🎉" }])],
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

function getLastUserText(messages: ModelMessage[]): string {
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

async function handleAgentError(err: unknown, userId: string, traceId?: string): Promise<string> {
  try {
    const authErr = unwrapAuthRequired(err);
    if (authErr) {
      const url = await buildConnectUrl(userId);
      return `To do that I need access to your Google account. Connect here (link expires in 10 min):\n${url}`;
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
    return `I'm being rate-limited. Try again in ~${rateErr.retryAfterSec}s.`;
  }
  if (err instanceof AgentTimeoutError) {
    console.warn("[agent] timeout", { seconds: err.seconds, traceId });
    return "That took longer than I expected. Try again in a moment, or crop the image to the relevant area.";
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
    return "Temporarily unavailable — please try again in a moment.";
  }
  if (/spending cap|RESOURCE_EXHAUSTED|exceeded its monthly|rate limit|429/i.test(msg)) {
    console.warn("[agent] LLM quota exhausted", { msg: msg.slice(0, 200), traceId });
    return "I'm out of LLM quota for the moment (monthly spending cap hit). Please check the Gemini project spend cap, or try again later.";
  }
  console.error("[agent] unhandled", err, { traceId });
  return `Something went wrong. Try again in a moment.`;
}
