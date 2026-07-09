import type { ModelMessage } from "ai";
import type { LLMStepResult } from "@mastra/core/stream";
import { RequestContext } from "@mastra/core/request-context";
import { getLekhaAgent } from "./agents/lekha-agent";
import {
  processResult,
  formatProcessed,
  factLimitForHint,
  createStepTracker,
  flattenToolCallsForAudit,
  handleAgentError,
  getLastUserText,
  computeMaxSteps,
  estimatePromptTokens,
  looksLikeMemoryRecall,
  looksLikeTaskList,
  looksLikeWeather,
  looksLikeFinance,
  looksLikeMediaQuery,
  looksLikeNewsQuery,
  looksLikeHelpQuery,
  looksLikeFactualQuery,
  fallbackListMemories,
  fallbackListTasks,
  fallbackWeather,
  fallbackFinance,
  fallbackSummarizeDocument,
  fallbackNewsSearch,
  fallbackWebSearch,
  type AgentResult,
  type AgentHints,
} from "@/lib/llm/agent-helpers";
import { buildSystemPrompt, buildTimeContext, escapePromptLiteral } from "@/lib/llm/prompts";
import { factsToPromptBlock, type UserFacts } from "@/lib/memory/facts";
import { historyForPrompt, appendTurn, type StoredTurn } from "@/lib/memory/history";
import { appendAuditEntry, type AuditToolCall } from "@/lib/memory/audit-log";
import { buildFlexFromToolResults, buildFollowUps, buildDraftFlexCards } from "@/lib/llm/agent-flex";
import { HELP_TEXT } from "@/lib/tools/help";
import { unwrapAuthRequired } from "@/lib/errors";
import { span, tick, withTimeout } from "@/lib/timing";
import { t } from "@/lib/i18n";
import { logError, logWarn } from "@/lib/log";
import { GEMINI_PROVIDER_OPTIONS, AGENT_TIMEOUT_MS } from "@/lib/llm/provider";
import { env } from "@/lib/env";
import { toolsForUser } from "@/lib/tools";
import { looksMultiStep, runMultiStep } from "@/lib/llm/multi-step";

export type MastraRunOptions = {
  userId: string;
  profile: { displayName: string };
  facts: UserFacts;
  settings: {
    timezone?: string;
    location?: string | null;
    language?: string | null;
    disabledCategories?: string[];
    personaTone?: string;
    personaAddressing?: string;
    personaPrimaryLang?: string;
    personaVoiceMatch?: boolean;
    personaPreferredName?: string | null;
    toolSettings?: Record<string, Record<string, unknown>>;
  };
  accounts: { accounts: Array<{ email: string }>; activeEmail: string | null };
  staged: Array<{ kind: string; messageId: string; ts: number; fileName?: string; contentType?: string; sizeBytes?: number }>;
  hasStagedMedia: boolean;
  hint?: string | null;
  imageBundled?: boolean;
  isGroupChat?: boolean;
  speakerName?: string;
  conversationId?: string;
  groupContext?: ModelMessage[];
  timeoutMs?: number;
  traceId?: string;
};

type InternalStep = {
  toolCalls: { toolCallId?: string; toolName: string; input: unknown }[];
  toolResults: { toolCallId?: string; toolName?: string; output: unknown }[];
  text?: string;
  finishReason?: string;
};

function adaptMastraStep(step: LLMStepResult<unknown>): InternalStep {
  return {
    text: step.text,
    finishReason: step.finishReason,
    toolCalls: step.toolCalls.map((tc) => ({
      toolCallId: tc.payload.toolCallId,
      toolName: tc.payload.toolName,
      input: tc.payload.args,
    })),
    toolResults: step.toolResults.map((tr) => ({
      toolCallId: tr.payload.toolCallId,
      toolName: tr.payload.toolName,
      output: tr.payload.result,
    })),
  };
}

export async function runMastraAgent(
  messages: ModelMessage[],
  opts: MastraRunOptions,
): Promise<AgentResult> {
  const traceId = opts.traceId ?? opts.userId;
  const endAgent = span("mastra:runAgent", traceId);
  const agentStart = Date.now();
  let lang: string | null = null;
  let geminiRanToolCalls = false;

  try {
    const { userId, profile, facts, settings, accounts, staged } = opts;
    const userHasGoogle = accounts.accounts.length > 0;
    const activeEmail = accounts.activeEmail;

    tick("mastra:preload-done", traceId, {
      accounts: accounts.accounts.length,
      staged: staged.length,
    });

    const accountsBlock = accounts.accounts.length
      ? `\n\nConnected Google accounts: ${accounts.accounts
          .map((a) => `${a.email}${a.email === activeEmail ? " (active)" : ""}`)
          .join(", ")}.`
      : "";

    const freshStaged = staged.filter((m) => Date.now() - m.ts < 10 * 60_000);
    const recentBlock = freshStaged.length
      ? opts.imageBundled
        ? `\n\nThe user's current message includes the image shown above. Answer based ONLY on visible text/content in that image. Quote the relevant text when possible. If the answer is not clearly visible, say you can't find it — do not guess or use outside knowledge. Do NOT call \`ocr_image\` or \`summarize_image\` for this image; it is already visible to you.\n\nOther staged LINE media (1-indexed, oldest first):\n${freshStaged
            .map((m, i) => {
              const ago = Math.round((Date.now() - m.ts) / 60_000);
              const parts = [
                `${i + 1}. ${m.kind}`,
                m.fileName ? `"${escapePromptLiteral(m.fileName)}"` : null,
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
                m.fileName ? `"${escapePromptLiteral(m.fileName)}"` : null,
                `(${m.contentType}`,
                m.sizeBytes ? `, ${(m.sizeBytes / 1024).toFixed(0)} KB` : "",
                `)`,
                `— ${ago}m ago`,
              ];
              return parts.filter(Boolean).join(" ");
            })
            .join("\n")}\nIf the user asks about an image, call \`ocr_image\` or \`summarize_image\` with the index. If they ask about a PDF/document, call \`summarize_document\` or \`read_document\`. If they ask about a voice memo/meeting/lecture, the full transcript is already saved — use \`search_documents\` to find it and summarize or quote from it. Use \`attach_recent_media\` / \`attach_recent_media_indexes\` only when attaching files to an email.`
      : "";

    const tz = settings.timezone ?? "Asia/Bangkok";
    lang = settings.language ?? null;
    const displayName = settings.personaPreferredName?.trim() || profile.displayName;
    const location = settings.location ?? null;
    const lastUserText = getLastUserText(messages);
    const isMultiStepHint = looksMultiStep(lastUserText);
    const maxSteps = computeMaxSteps(opts.hint ?? undefined, opts.hasStagedMedia, isMultiStepHint);

    let factLimit = factLimitForHint(opts.hint ?? undefined);
    let factsBlock = factsToPromptBlock(facts, factLimit);

    const recencyReminder = opts.hint === "recent"
      ? "This message likely asks about current or recent information. ALWAYS search the web (web_search or news_search) before answering. Do not rely on training data."
      : "";
    const contextParts = [buildTimeContext(tz), accountsBlock, recentBlock, recencyReminder].filter(Boolean).join("\n");
    const contextSystemBlock = contextParts
      ? `\n\nCurrent context (reference data, not a user request):\n${contextParts}`
      : "";

    function buildSystem(currentFactsBlock: string): string {
      return buildSystemPrompt(currentFactsBlock, { displayName }, {
        ...settings,
        isGroupChat: opts.isGroupChat,
        speakerName: opts.speakerName,
      }) + contextSystemBlock;
    }

    let system = buildSystem(factsBlock);

    const requestContext = new RequestContext();
    requestContext.set("userId", userId);
    requestContext.set("hint", opts.hint ?? undefined);
    requestContext.set("hasStagedMedia", opts.hasStagedMedia);
    requestContext.set("userHasGoogle", userHasGoogle);
    requestContext.set("disabledCategories", settings.disabledCategories ?? []);
    requestContext.set("activeEmail", activeEmail);
    requestContext.set("timezone", tz);
    requestContext.set("language", lang);

    const historyMessages = await historyForPrompt(userId);
    const groupContext = opts.groupContext ?? [];
    const currentMessages = messages;
    let conversationMessages: ModelMessage[] = [
      ...historyMessages,
      ...groupContext,
      ...currentMessages,
    ];

    // Per-turn soft token/cost budget compaction.
    let estTokens = estimatePromptTokens(system, conversationMessages);
    if (estTokens > 100_000) {
      const slicedHistory = historyMessages.slice(-20); // ~10 turns
      conversationMessages = [...slicedHistory, ...groupContext, ...currentMessages];
      estTokens = estimatePromptTokens(system, conversationMessages);
      if (estTokens > 150_000) {
        factLimit = 5;
        factsBlock = factsToPromptBlock(facts, factLimit);
        system = buildSystem(factsBlock);
        estTokens = estimatePromptTokens(system, conversationMessages);
      }
      console.log(
        "[mastra] turn budget compacted: turns=%d facts=%d estTokens=%d",
        Math.ceil(slicedHistory.length / 2),
        factLimit,
        estTokens,
      );
    }

    async function attemptGenerate(tier: "free" | "paid") {
      const agent = getLekhaAgent(tier);
      const localTracker = createStepTracker(traceId);
      let localRanToolCalls = false;
      const ctrl = new AbortController();
      const timeoutMs = opts.timeoutMs ?? AGENT_TIMEOUT_MS;
      const abortTimer = setTimeout(() => {
        console.warn("[mastra] aborting agent call due to timeout", { userId, timeoutMs });
        ctrl.abort();
      }, timeoutMs);
      try {
        const res = await withTimeout(
          agent.generate(conversationMessages as any, {
            instructions: system,
            requestContext,
            maxSteps,
            abortSignal: ctrl.signal,
            providerOptions: { google: { ...GEMINI_PROVIDER_OPTIONS.google, temperature: 0.6 } } as any,
            onStepFinish: (step) => {
              if (step.toolCalls.length > 0) localRanToolCalls = true;
              localTracker.record(adaptMastraStep(step));
            },
          }),
          timeoutMs,
        );
        return { res, tracker: localTracker, ranToolCalls: localRanToolCalls };
      } finally {
        clearTimeout(abortTimer);
      }
    }

    // Deterministic multi-step path: plan → execute → synthesize.
    // This avoids Gemini Flash's unreliable auto-loop when several independent
    // tool requests appear in one message.
    let multiStepResult: Awaited<ReturnType<typeof runMultiStep>> | undefined;
    if (looksMultiStep(lastUserText)) {
      try {
        const aiTools = await toolsForUser(userId, {
          userHasGoogle,
          disabledCategories: settings.disabledCategories ?? [],
          hasStagedMedia: opts.hasStagedMedia,
          hint: opts.hint ?? undefined,
          activeEmail,
        });
        multiStepResult = await runMultiStep(lastUserText, aiTools, {
          timezone: tz,
          language: lang,
          displayName,
          location,
          factsBlock: factsBlock,
          personaTone: settings.personaTone,
          personaAddressing: settings.personaAddressing,
          personaPreferredName: settings.personaPreferredName,
          activeEmail,
          accounts: accounts.accounts.map((a) => a.email),
          staged: recentBlock,
          isGroupChat: opts.isGroupChat,
          groupContext: opts.groupContext
            ? opts.groupContext.map((m) => `${m.role}: ${typeof m.content === "string" ? escapePromptLiteral(m.content) : escapePromptLiteral(JSON.stringify(m.content))}`).join("\n")
            : undefined,
        });
      } catch (err) {
        console.warn("[mastra] multi-step handler failed, falling back to agent", err);
        multiStepResult = undefined;
      }
    }

    const endGenerate = span("mastra:generate", traceId);
    let result: Awaited<ReturnType<typeof attemptGenerate>>["res"];
    let tracker: Awaited<ReturnType<typeof attemptGenerate>>["tracker"];
    let geminiRanToolCalls: boolean;
    let multiStepStep: InternalStep | undefined;

    if (multiStepResult && multiStepResult.toolCalls.length > 0) {
      tracker = createStepTracker(traceId);
      geminiRanToolCalls = true;
      const callIds = new Map<string, string>();
      for (const c of multiStepResult.toolCalls) {
        callIds.set(c.tool, `${c.tool}-${Math.random().toString(36).slice(2)}`);
      }
      multiStepStep = {
        text: multiStepResult.text,
        finishReason: "stop",
        toolCalls: multiStepResult.toolCalls.map((c) => ({
          toolCallId: callIds.get(c.tool) ?? `${c.tool}-${Math.random().toString(36).slice(2)}`,
          toolName: c.tool,
          input: c.input,
        })),
        toolResults: multiStepResult.toolResults.map((r) => ({
          toolCallId: callIds.get(r.tool) ?? `${r.tool}-${Math.random().toString(36).slice(2)}`,
          toolName: r.tool,
          output: r.output,
        })),
      };
      tracker.record(multiStepStep);
      result = {
        text: multiStepResult.text,
        steps: [],
        totalUsage: { inputTokens: 0, outputTokens: 0 },
        usage: { inputTokens: 0, outputTokens: 0 },
      } as any;
    } else {
      let generateResult: Awaited<ReturnType<typeof attemptGenerate>>;
      try {
        generateResult = await attemptGenerate("free");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const e = env();
        const canFallback = Boolean(e.GEMINI_API_KEY_FREE && e.GEMINI_API_KEY);
        if (canFallback && /RESOURCE_EXHAUSTED|rate limit|429|quota|exceeded|spending cap|UNAVAILABLE|DeadlineExceeded|503|Bad Gateway|service unavailable|maxRetriesExceeded/i.test(msg)) {
          console.warn("[mastra] free Gemini key quota hit, falling back to paid key", { userId, msg: msg.slice(0, 200) });
          generateResult = await attemptGenerate("paid");
        } else {
          throw err;
        }
      }
      result = generateResult.res;
      tracker = generateResult.tracker;
      geminiRanToolCalls = generateResult.ranToolCalls;
    }

    const usage = result.totalUsage ?? result.usage;
    const costUsd =
      ((usage?.inputTokens ?? 0) * 0.3) / 1_000_000 +
      ((usage?.outputTokens ?? 0) * 2.5) / 1_000_000;
    console.log("[mastra] usage", {
      userId,
      promptTokens: usage?.inputTokens ?? 0,
      completionTokens: usage?.outputTokens ?? 0,
      costUsd: Math.round(costUsd * 10000) / 10000,
    });
    endGenerate({
      steps: multiStepStep ? 1 : result.steps.length,
      toolCalls: tracker.allCalls.length,
      promptTokens: usage?.inputTokens ?? 0,
      completionTokens: usage?.outputTokens ?? 0,
      costUsd,
    });

    const adaptedSteps = multiStepStep ? [multiStepStep] : result.steps.map(adaptMastraStep);
    const adaptedResult = { text: result.text ?? "", steps: adaptedSteps };

    const endProcess = span("mastra:processResult", traceId);
    const processed = processResult(adaptedResult, activeEmail, tracker.successfulCalls, tz, lang);
    const text = formatProcessed(processed, lang);

    const draftToolNames = tracker.successfulCalls
      .filter((c) =>
        c.toolName === "draft_email" ||
        c.toolName === "draft_calendar_event" ||
        c.toolName === "schedule_email",
      )
      .map((c) => c.toolName);
    const confirmDraft = draftToolNames.length > 0;

    let { messages: flexMessages, suppressText } = buildFlexFromToolResults(adaptedResult, tz, {
      userText: lastUserText,
      language: lang,
    });

    let hasDraftFlex = false;
    if (confirmDraft) {
      const draftCalls = tracker.successfulCalls.filter((c) =>
        c.toolName === "draft_email" ||
        c.toolName === "draft_calendar_event" ||
        c.toolName === "schedule_email",
      );
      const draftCards = buildDraftFlexCards(draftCalls, tz, { language: lang, activeEmail, staged });
      if (draftCards.length > 0) {
        flexMessages = [...draftCards, ...flexMessages];
        suppressText = true;
        hasDraftFlex = true;
      }
    }

    const isMultiStep = multiStepStep !== undefined;
    const modelText = result.text?.trim() ?? "";
    let finalText =
      suppressText && !isMultiStep && modelText.length > 0 && !processed.authNeeded && !processed.hadUnrelayedToolError
        ? ""
        : text;
    let extraToolCalls = tracker.allCalls;

    const looksBlankOrUnhelpful =
      finalText === t(lang, "fallbackNoCatch") ||
      (finalText.length < 60 &&
        !processed.authNeeded &&
        !processed.apiDisabled &&
        !processed.googleErr &&
        tracker.successfulCalls.length === 0);

    if (looksBlankOrUnhelpful) {
      if (looksLikeMemoryRecall(lastUserText)) {
        const fb = await fallbackListMemories(userId, displayName);
        finalText = fb.text;
        extraToolCalls = fb.toolCalls;
        if (fb.flexMessages?.length) flexMessages = [...flexMessages, ...fb.flexMessages];
      } else if (looksLikeTaskList(lastUserText)) {
        const fb = await fallbackListTasks(userId, displayName, tz, lang);
        finalText = fb.text;
        extraToolCalls = fb.toolCalls;
        if (fb.flexMessages?.length) flexMessages = [...flexMessages, ...fb.flexMessages];
      } else if (looksLikeWeather(lastUserText)) {
        const fb = await fallbackWeather(lastUserText, tz, lang, location);
        finalText = fb.text;
        extraToolCalls = fb.toolCalls;
        if (fb.flexMessages?.length) flexMessages = [...flexMessages, ...fb.flexMessages];
      } else if (looksLikeFinance(lastUserText)) {
        const fb = await fallbackFinance(lastUserText);
        finalText = fb.text;
        extraToolCalls = fb.toolCalls;
        if (fb.flexMessages?.length) flexMessages = [...flexMessages, ...fb.flexMessages];
      } else if (opts.hasStagedMedia && looksLikeMediaQuery(lastUserText)) {
        const fb = await fallbackSummarizeDocument(userId, displayName, lastUserText, lang);
        finalText = fb.text;
        extraToolCalls = fb.toolCalls;
      } else if (looksLikeNewsQuery(lastUserText)) {
        const fb = await fallbackNewsSearch(lastUserText, lang);
        finalText = fb.text;
        extraToolCalls = fb.toolCalls;
        if (fb.flexMessages?.length) flexMessages = [...flexMessages, ...fb.flexMessages];
      } else if (looksLikeHelpQuery(lastUserText)) {
        finalText = HELP_TEXT;
        extraToolCalls = [{ toolName: "show_help", input: {} }];
      } else if (looksLikeFactualQuery(lastUserText)) {
        const fb = await fallbackWebSearch(lastUserText, lang);
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

    appendAuditEntry(userId, {
      traceId,
      hint: opts.hint ?? undefined,
      userMessage: lastUserText,
      reply: finalText,
      toolCalls: flattenToolCallsForAudit(adaptedSteps) as AuditToolCall[],
      durationMs: Date.now() - agentStart,
    }).catch((e) => logError("audit", "appendAuditEntry failed", e));

    const historyText = finalText.trim().length > 0 ? finalText : text.trim().length > 0 ? text : "Done.";

    // Persist this turn to Redis-backed rolling history.
    const userTurn: StoredTurn = { role: "user", content: getLastUserText(messages), ts: Date.now() };
    const assistantTurn: StoredTurn = { role: "assistant", content: historyText, ts: Date.now() };
    appendTurn(userId, userTurn).catch((e) => logWarn("history", "appendTurn user failed", { error: e }));
    appendTurn(userId, assistantTurn).catch((e) => logWarn("history", "appendTurn assistant failed", { error: e }));

    return { text: finalText, hints, toolCalls: extraToolCalls, historyText };
  } catch (err) {
    const errText = await handleAgentError(err, opts.userId, lang, opts.userId);
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
      historyText: errText,
    };
  }
}
