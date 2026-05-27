import { generateText, stepCountIs, type ModelMessage } from "ai";
import { chatModel, AGENT_TIMEOUT_MS, GEMINI_PROVIDER_OPTIONS } from "@/lib/llm/provider";
import { buildSystemPrompt, buildTimeContext } from "@/lib/llm/prompts";
import { factsToPromptBlock, type loadFacts } from "@/lib/memory/facts";
import { listAccounts } from "@/lib/tools/google-auth";
import { listRecentMedia } from "@/lib/memory/recent-media";
import { getSettings } from "@/lib/memory/settings";
import { toolsForUser } from "@/lib/tools";
import { renderDraftsBlock } from "@/lib/llm/render-drafts";
import { buildConnectUrl } from "@/lib/tools/google-auth";
import { GoogleAuthRequired, NeedsConfirmation, RateLimited } from "@/lib/errors";
import type { LineMessage } from "@/lib/line/client";
import { buildFlexFromToolResults, buildFollowUps } from "@/lib/llm/agent-flex";

/** Strip markdown syntax that LINE renders as raw punctuation. Model-independent guarantee. */
export function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")  // **bold** → bold (no cross-line)
    .replace(/\*([^*\n]+)\*/g, "$1")       // *italic* → italic (no cross-line)
    .replace(/^#{1,6} /gm, "")             // ## headers → plain
    .replace(/^[ \t]*\*[ \t]+/gm, "• ")   // * bullets → • (handles "* " or "*   ")
    .replace(/^[ \t]*-[ \t]+/gm, "• ")    // - bullets → •
    .replace(/`([^`\n]+)`/g, "$1")         // `code` → plain
    .trim();
}

/** Human-readable labels for common tool names (used in Done! fallback and timeout recovery). */
export const ACTION_LABELS: Record<string, string> = {
  set_reminder: "Reminder set",
  set_recurring_reminder: "Recurring reminder set",
  cancel_reminder: "Reminder cancelled",
  schedule_email: "Email scheduled",
  cancel_scheduled_email: "Scheduled email cancelled",
  add_task: "Task added",
  complete_task: "Task done",
  delete_task: "Task deleted",
  remember: "Saved to memory",
  forget_memory: "Memory removed",
  clear_all_memories: "Memories cleared",
  draft_calendar_event: "Calendar event drafted",
  set_timezone: "Timezone updated",
  set_location: "Location updated",
  set_language: "Language updated",
  enable_morning_briefing: "Morning briefing enabled",
  disable_morning_briefing: "Morning briefing disabled",
  enable_evening_summary: "Evening summary enabled",
  disable_evening_summary: "Evening summary disabled",
};

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

export function extractToolValue(output: unknown): unknown {
  if (output && typeof output === "object") {
    const o = output as { type?: string; value?: unknown };
    if (o.type === "json" && "value" in o) return o.value;
    return output;
  }
  return output;
}

type ProcessedResult = {
  reply: string;
  authNeeded: { connectUrl: string; reason: string } | null;
  apiDisabled: { api: string; enableUrl: string | null; message: string } | null;
  googleErr: { status: number | null; message: string } | null;
};

function processResult(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any,
  activeEmail: string | null,
  allCalls: { toolName: string; input: unknown }[],
  timezone?: string,
): ProcessedResult {
  let authNeeded: { connectUrl: string; reason: string } | null = null;
  let apiDisabled: { api: string; enableUrl: string | null; message: string } | null = null;
  let googleErr: { status: number | null; message: string } | null = null;

  // allCalls already populated by onStepFinish; scan steps only for auth/error signals
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
      }
    }
  }

  if (authNeeded) return { reply: "", authNeeded, apiDisabled: null, googleErr: null };
  if (apiDisabled) return { reply: "", authNeeded: null, apiDisabled, googleErr: null };
  if (googleErr) return { reply: "", authNeeded: null, apiDisabled: null, googleErr };

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
    // Verbatim-content tools: if model returns empty text but one of these ran,
    // pull the string result from the tool output rather than showing a "✓" label.
    const verbatimTools = new Set(["get_morning_briefing", "get_evening_summary"]);
    for (const step of result.steps) {
      for (const tr of step.toolResults) {
        const toolName = (tr as { toolName?: string }).toolName ?? "";
        if (!verbatimTools.has(toolName)) continue;
        const value = extractToolValue((tr as { output?: unknown }).output);
        if (typeof value === "string" && value.length > 10) {
          return { reply: value, authNeeded: null, apiDisabled: null, googleErr: null };
        }
      }
    }
    const labels = allCalls.map((c) => ACTION_LABELS[c.toolName] ?? c.toolName).filter(Boolean);
    const unique = [...new Set(labels)];
    return { reply: unique.length ? unique.join(" • ") + " ✓" : "Done.", authNeeded: null, apiDisabled: null, googleErr: null };
  }
  return { reply: "…", authNeeded: null, apiDisabled: null, googleErr: null };
}

function formatProcessed(processed: ProcessedResult): string {
  if (processed.authNeeded) {
    const isReauth = processed.authNeeded.reason.includes("scopes");
    const intro = isReauth
      ? "Your Google account needs a quick permission update to access calendar and Gmail features."
      : "I need access to your Google account to do that.";
    return `${intro}\n\nType "connect google" to reconnect — it only takes a few seconds and you'll only need to do this once.\n\n${processed.authNeeded.connectUrl}`;
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
};

export async function runAgent(
  userId: string,
  profile: { displayName: string },
  facts: Awaited<ReturnType<typeof loadFacts>>,
  messages: ModelMessage[],
): Promise<AgentResult> {
  const agentT0 = Date.now();
  const aTick = (label: string, extra?: Record<string, unknown>) =>
    console.warn(`[timing/agent] ${label}`, { ms: Date.now() - agentT0, ...(extra ?? {}) });
  aTick("runAgent:start");
  const [accounts, staged, settings] = await Promise.all([
    listAccounts(userId),
    listRecentMedia(userId),
    getSettings(userId),
  ]);
  const userHasGoogle = accounts.accounts.length > 0;
  aTick("runAgent:preload-done", { accounts: accounts.accounts.length, staged: staged.length });
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

  const tz = settings.timezone ?? "Asia/Bangkok";
  const timePrefix: ModelMessage[] = [
    { role: "user" as const, content: buildTimeContext(tz) },
    { role: "assistant" as const, content: "Noted." },
  ];

  const tStart = Date.now();
  const allCalls: { toolName: string; input: unknown }[] = [];
  const succeededTools: string[] = [];

  try {
    aTick("runAgent:tools-loading");
    const tools = await toolsForUser(userId, { userHasGoogle });
    aTick("runAgent:tools-loaded", { toolCount: Object.keys(tools).length });
    aTick("runAgent:gemini-start");
    const result = await withTimeout(
      generateText({
        model: chatModel(),
        system,
        messages: [...timePrefix, ...messages],
        tools,
        temperature: 0.4,
        stopWhen: stepCountIs(8),
        maxRetries: 3,
        onStepFinish: (step) => {
          // Populate allCalls here so they're available on timeout (Bug 3)
          for (const c of step.toolCalls) {
            if (c) allCalls.push({ toolName: c.toolName, input: c.input });
          }
          // Track tools that returned ok (not auth/api-disabled/error) for timeout recovery
          for (const tr of step.toolResults) {
            const val = extractToolValue((tr as { output?: unknown }).output);
            if (val && typeof val === "object") {
              const v = val as Record<string, unknown>;
              if (v.ok !== false && !v.need_google_auth && !v.google_api_disabled && !v.google_error) {
                succeededTools.push((tr as { toolName?: string }).toolName ?? "");
              }
            }
          }
          console.log("[agent] step", {
            ms: Date.now() - tStart,
            toolCalls: step.toolCalls.map((c) => c?.toolName),
            toolResults: step.toolResults.map((r) => ({
              tool: (r as { toolName?: string }).toolName,
              result: JSON.stringify((r as { output?: unknown }).output ?? r).slice(0, 300),
            })),
            text: step.text?.slice(0, 200) || undefined,
            finish: step.finishReason,
          });
        },
        providerOptions: GEMINI_PROVIDER_OPTIONS,
      }),
      AGENT_TIMEOUT_MS,
    );
    console.log("[agent] done", { ms: Date.now() - tStart, steps: result.steps.length });
    aTick("runAgent:gemini-done", { steps: result.steps.length, toolCalls: allCalls.length });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processed = processResult(result as any, accounts.activeEmail, allCalls, settings?.timezone);
    const text = formatProcessed(processed);
    const confirmDraft = allCalls.some(
      (c) => c.toolName === "draft_email" || c.toolName === "draft_calendar_event" || c.toolName === "schedule_email",
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flexMessages = buildFlexFromToolResults(result as any);
    const followUps = buildFollowUps(allCalls.map((c) => c.toolName), { confirmDraft });
    const hints: AgentHints = {
      confirmDraft,
      // Only show account picker for explicit write-action ambiguity
      // (sending email, creating events). Read actions use active account silently.
      pickAccount:
        accounts.accounts.length > 1 &&
        /which (google )?account/i.test(text) &&
        allCalls.some((c) =>
          c.toolName === "draft_email" ||
          c.toolName === "draft_calendar_event" ||
          c.toolName === "upload_to_drive",
        ),
      needsGoogleConnect:
        processed.authNeeded !== null || (accounts.accounts.length === 0 && /connect google/i.test(text)),
      flexMessages,
      followUps,
    };
    return { text, hints };
  } catch (err) {
    // Bug 3: timeout after tools already completed — synthesize from what finished
    if (err instanceof AgentTimeoutError && succeededTools.length > 0) {
      const draftBlock = renderDraftsBlock(allCalls, accounts.activeEmail, settings.timezone);
      const text = draftBlock
        ? stripMarkdown(draftBlock)
        : stripMarkdown(
            [...new Set(succeededTools.filter(Boolean))]
              .map((t) => ACTION_LABELS[t] ?? t)
              .join(" • "),
          );
      console.warn("[agent] timeout with completed tools — returning summary", { succeededTools });
      return {
        text,
        hints: {
          confirmDraft: Boolean(draftBlock),
          pickAccount: false,
          needsGoogleConnect: false,
        },
      };
    }
    const errText = await handleError(err, userId);
    return {
      text: errText,
      hints: {
        confirmDraft: false,
        pickAccount: false,
        needsGoogleConnect: unwrap(err) instanceof GoogleAuthRequired,
      },
    };
  }
}

async function handleError(err: unknown, userId: string): Promise<string> {
  const inner = unwrap(err);
  if (inner instanceof GoogleAuthRequired) {
    const url = await buildConnectUrl(userId);
    return `To do that I need access to your Google account. Connect here (link expires in 10 min):\n${url}`;
  }
  if (inner instanceof NeedsConfirmation) {
    return (inner as NeedsConfirmation).message;
  }
  if (inner instanceof RateLimited) {
    return `I'm being rate-limited. Try again in ~${(inner as RateLimited).retryAfterSec}s.`;
  }
  if (err instanceof AgentTimeoutError) {
    console.warn("[agent] timeout", { seconds: err.seconds });
    return `Timed out after ${err.seconds}s — that was a heavy request. Try again in a sec.`;
  }
  const msg = err instanceof Error ? err.message : String(err);
  // Bug 4 & 5: Gemini 503 / cold-start Bad Gateway — return friendly message, not raw error
  if (/UNAVAILABLE|Bad.?Gateway|service.?unavailable/i.test(msg) || /\b50[23]\b/.test(msg)) {
    console.warn("[agent] service unavailable", { msg: msg.slice(0, 200) });
    return "Temporarily unavailable — please try again in a moment.";
  }
  console.error("[agent] unhandled", err);
  return `Error: ${msg.slice(0, 300)}`;
}
