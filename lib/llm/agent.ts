import { generateText, stepCountIs, type ModelMessage } from "ai";
import { chatModel } from "@/lib/llm/provider";
import { buildSystemPrompt } from "@/lib/llm/prompts";
import { factsToPromptBlock, type loadFacts } from "@/lib/memory/facts";
import { listAccounts } from "@/lib/tools/google-auth";
import { listRecentMedia } from "@/lib/memory/recent-media";
import { getSettings } from "@/lib/memory/settings";
import { getContentLibraryCount } from "@/lib/memory/content-library";
import { toolsForUser } from "@/lib/tools";
import { renderDraftsBlock } from "@/lib/llm/render-drafts";
import { buildConnectUrl } from "@/lib/tools/google-auth";
import { GoogleAuthRequired, NeedsConfirmation, RateLimited } from "@/lib/errors";
import { hasVercelBlob } from "@/lib/env";

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
    !/quota|rate.?limit|RESOURCE_EXHAUSTED|429|UNAVAILABLE|overloaded|503|502|504|INTERNAL|temporarily|AI_RetryError|fetch failed|ECONN|ENOTFOUND/i.test(
      text,
    )
  ) {
    return null;
  }
  const m = text.match(/retry in (\d+(?:\.\d+)?)s/i);
  const retryAfterSec = m ? Math.ceil(parseFloat(m[1]!)) : 30;
  return { retryAfterSec };
}

export function extractToolValue(output: unknown): unknown {
  if (output && typeof output === "object") {
    const o = output as { type?: string; value?: unknown };
    if (o.type === "json" && "value" in o) return o.value;
    return output;
  }
  return output;
}

export async function runAgent(
  userId: string,
  profile: { displayName: string },
  facts: Awaited<ReturnType<typeof loadFacts>>,
  messages: ModelMessage[],
): Promise<string> {
  const [accounts, staged, settings, libCount] = await Promise.all([
    listAccounts(userId),
    listRecentMedia(userId),
    getSettings(userId),
    hasVercelBlob() ? getContentLibraryCount(userId) : Promise.resolve(0),
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
  const contentLibBlock =
    libCount > 0
      ? `\n\nContent library: ${libCount} file${libCount !== 1 ? "s" : ""} stored. Use list_content_library or search_content_library to find relevant files.`
      : "";
  const system =
    buildSystemPrompt(factsToPromptBlock(facts), profile, settings) +
    accountsBlock +
    recentBlock +
    contentLibBlock;

  const tStart = Date.now();
  try {
    const result = await withTimeout(
      generateText({
        model: chatModel(),
        system,
        messages,
        tools: toolsForUser(userId),
        temperature: 0.4,
        stopWhen: stepCountIs(8),
        maxRetries: 0,
        onStepFinish: (step) => {
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
      45_000,
    );
    console.log("[agent] done", { ms: Date.now() - tStart, steps: result.steps.length });

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
      return (inner as NeedsConfirmation).message;
    }
    if (inner instanceof RateLimited) {
      return `I'm being rate-limited. Try again in ~${(inner as RateLimited).retryAfterSec}s.`;
    }
    if (err instanceof AgentTimeoutError) {
      console.warn("[agent] timeout", { seconds: err.seconds });
      return `Timed out after ${err.seconds}s — that was a heavy request. Try again in a sec.`;
    }
    const quota = parseQuotaError(err);
    if (quota) {
      console.warn("[agent] quota/overload", { retryAfter: quota.retryAfterSec });
      return `I'm overloaded right now. Try again in ~${quota.retryAfterSec}s.`;
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[agent] unhandled", err);
    return `Error: ${msg.slice(0, 300)}`;
  }
}
