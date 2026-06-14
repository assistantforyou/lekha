import { performance } from "perf_hooks";
import { generateText, stepCountIs, type ModelMessage } from "ai";
import { chatModel, AGENT_TIMEOUT_MS, GEMINI_PROVIDER_OPTIONS } from "@/lib/llm/provider";
import { buildSystemPrompt, buildTimeContext } from "@/lib/llm/prompts";
import { factsToPromptBlock, loadFacts, displayOrder, formatFactLine } from "@/lib/memory/facts";
import { listAccounts } from "@/lib/tools/google-auth";
import { listRecentMedia } from "@/lib/memory/recent-media";
import { listTasks } from "@/lib/memory/tasks";
import { getSettings } from "@/lib/memory/settings";
import { toolsForUser } from "@/lib/tools";
import { renderDraftsBlock } from "@/lib/llm/render-drafts";
import { buildConnectUrl } from "@/lib/tools/google-auth";
import type { ToolSet } from "ai";
import { GoogleAuthRequired, NeedsConfirmation, RateLimited, unwrapCause, unwrapAuthRequired } from "@/lib/errors";
import type { Intent } from "@/lib/intent";
import type { LineMessage } from "@/lib/line/client";
import { buildFlexFromToolResults, buildFollowUps } from "@/lib/llm/agent-flex";
import { span, tick, withTimeout, AgentTimeoutError } from "@/lib/timing";
import { stripMarkdown } from "@/lib/format";
import { ACTION_LABELS } from "@/lib/llm/action-labels";
import { buildMediaAiTools } from "@/lib/tools/media-ai";
import { buildWeatherTools } from "@/lib/tools/weather";

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
    // If model generated empty text after a display tool call, render the data ourselves.
    const displayText = renderDisplayFallback(result);
    if (displayText) {
      return { reply: displayText, authNeeded: null, apiDisabled: null, googleErr: null };
    }
    const labels = allCalls.map((c) => ACTION_LABELS[c.toolName] ?? c.toolName).filter(Boolean);
    const unique = [...new Set(labels)];
    return { reply: unique.length ? unique.join(" • ") + " ✓" : "Done.", authNeeded: null, apiDisabled: null, googleErr: null };
  }
  return { reply: "I didn't catch that — could you rephrase?", authNeeded: null, apiDisabled: null, googleErr: null };
}

function renderDisplayFallback(result: { steps?: { toolResults?: { toolName?: string; output?: unknown }[] }[] }): string | null {
  for (const step of result.steps ?? []) {
    for (const tr of step.toolResults ?? []) {
      if (!tr) continue;
      const v = extractToolValue(tr.output);
      if (!v || typeof v !== "object") continue;
      const val = v as Record<string, unknown>;
      // Some tools return {ok:true, ...} on success; others just return the data.
      // Only skip if it's explicitly an error.
      if (val.ok === false || val.need_google_auth || val.google_api_disabled || val.google_error) continue;

      // ── Tasks ──────────────────────────────────────────────────────────
      if (tr.toolName === "list_tasks" && Array.isArray(val.tasks)) {
        const tasks = val.tasks as Array<Record<string, unknown>>;
        if (tasks.length === 0) return "You don't have any tasks right now.";
        const open = tasks.filter((t) => !t.doneAt).map((t) => `• ${t.title}`).join("\n");
        const done = tasks.filter((t) => t.doneAt).map((t) => `• ${t.title} ✓`).join("\n");
        const parts: string[] = [];
        if (open) parts.push(`Open tasks:\n${open}`);
        if (done) parts.push(`Done:\n${done}`);
        return parts.join("\n\n") || "Tasks loaded.";
      }

      // ── Calendar ───────────────────────────────────────────────────────
      if (
        (tr.toolName === "list_upcoming_events" || tr.toolName === "calendar_today" || tr.toolName === "calendar_week") &&
        Array.isArray(val.events)
      ) {
        const events = val.events as Array<Record<string, unknown>>;
        if (events.length === 0) return "No upcoming events.";
        return events
          .map((e) => {
            const summary = String(e.summary ?? "(no title)");
            const start = String(e.start ?? "").slice(0, 16).replace("T", " ");
            const loc = e.location ? ` @ ${e.location}` : "";
            return `• ${summary}${start ? ` — ${start}` : ""}${loc}`;
          })
          .join("\n");
      }

      // ── Weather ────────────────────────────────────────────────────────
      if (tr.toolName === "weather") {
        const place = String(val.place ?? "unknown location");
        const current = val.current as Record<string, unknown> | null;
        if (!current) continue;
        const tempC = current.tempC;
        const tempF = current.tempF;
        const description = String(current.description ?? "").toLowerCase();
        const humidity = current.humidityPct;
        const wind = current.windKmh;
        const source = String(val.source ?? "");
        let line = place;
        if (typeof tempC === "number") {
          line += ` — ${tempC}°C`;
          if (typeof tempF === "number") line += ` / ${tempF}°F`;
        }
        if (description) line += `, ${description}`;
        if (typeof humidity === "number") line += `, humidity ${humidity}%`;
        if (typeof wind === "number") line += `, wind ${wind} km/h`;
        if (source) line += ` (source: ${source})`;
        const forecast = val.forecast as Array<Record<string, unknown>> | null;
        if (forecast && forecast.length > 0) {
          const fc = forecast.slice(0, 3).map((d) => {
            const date = String(d.date ?? "").slice(5);
            const high = d.highC;
            const low = d.lowC;
            const cond = String(d.condition ?? "").toLowerCase();
            if (typeof high === "number" && typeof low === "number") {
              return `${date}: ${low}°C–${high}°C${cond ? `, ${cond}` : ""}`;
            }
            return null;
          }).filter(Boolean);
          if (fc.length) line += `\n\nForecast:\n${fc.join("\n")}`;
        }
        return line;
      }

      // ── Gmail search ───────────────────────────────────────────────────
      if (tr.toolName === "gmail_search" && Array.isArray(val.messages)) {
        const msgs = val.messages as Array<Record<string, unknown>>;
        if (msgs.length === 0) return "No emails found.";
        return msgs
          .map((m, i) => {
            const from = String(m.from ?? "unknown");
            const subject = String(m.subject ?? "(no subject)");
            const date = String(m.date ?? "").slice(0, 10);
            return `${i + 1}. ${subject} — ${from}${date ? ` (${date})` : ""}`;
          })
          .join("\n");
      }

      // ── Web search ─────────────────────────────────────────────────────
      if (tr.toolName === "web_search") {
        const answer = val.answer ? String(val.answer) : null;
        const results = val.results as Array<Record<string, unknown>> | null;
        if (answer) return answer;
        if (results && results.length > 0) {
          return results
            .map((r, i) => {
              const title = String(r.title ?? "Untitled");
              const snippet = String(r.snippet ?? "").slice(0, 200);
              return `${i + 1}. ${title}${snippet ? `\n${snippet}` : ""}`;
            })
            .join("\n\n");
        }
        return "Search completed but no results were found.";
      }

      // ── News search ────────────────────────────────────────────────────
      if ((tr.toolName === "news_search" || tr.toolName === "search_news") && Array.isArray(val.stories)) {
        const stories = val.stories as Array<Record<string, unknown>>;
        if (stories.length === 0) return "No news stories found.";
        return stories
          .map((s, i) => {
            const title = String(s.title ?? "Untitled");
            const source = s.source ? ` — ${s.source}` : "";
            return `${i + 1}. ${title}${source}`;
          })
          .join("\n");
      }

      // ── Named lists ────────────────────────────────────────────────────
      if (tr.toolName === "list_items" && Array.isArray(val.items)) {
        const items = val.items as string[];
        const listName = String(val.list ?? "list");
        if (items.length === 0) return `${listName}: empty.`;
        return `📋 ${listName}:\n${items.map((s) => `• ${s}`).join("\n")}`;
      }

      // ── Contacts search ────────────────────────────────────────────────
      if (tr.toolName === "contacts_search" && Array.isArray(val.contacts)) {
        const contacts = val.contacts as Array<Record<string, unknown>>;
        if (contacts.length === 0) return "No contacts found.";
        return contacts
          .map((c) => {
            const name = String(c.name ?? "Unknown");
            const email = String(c.email ?? "");
            return `• ${name}${email ? ` — ${email}` : ""}`;
          })
          .join("\n");
      }

      // ── Reminders ──────────────────────────────────────────────────────
      if (tr.toolName === "list_reminders" && Array.isArray(val.reminders)) {
        const reminders = val.reminders as Array<Record<string, unknown>>;
        if (reminders.length === 0) return "No reminders set.";
        return reminders
          .map((r) => {
            const text = String(r.text ?? "");
            const fireAt = String(r.fireAt ?? "").slice(0, 16).replace("T", " ");
            return `• ${text}${fireAt ? ` — ${fireAt}` : ""}`;
          })
          .join("\n");
      }

      // ── Crypto price ───────────────────────────────────────────────────
      if (tr.toolName === "crypto_price" && typeof val.usd === "number") {
        const id = String(val.id ?? "").toUpperCase();
        const usd = val.usd as number;
        const change = val.change24h as number | null;
        const source = String(val.source ?? "");
        let line = `• ${id}: $${usd.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
        if (change != null) {
          const arrow = change >= 0 ? "▲" : "▼";
          line += ` ${arrow} ${Math.abs(change).toFixed(2)}% (24h)`;
        }
        if (source) line += ` (source: ${source})`;
        return line;
      }

      // ── Stock price ────────────────────────────────────────────────────
      if (tr.toolName === "stock_price" && typeof val.price === "number") {
        const symbol = String(val.symbol ?? "").toUpperCase();
        const price = val.price as number;
        const change = val.change as number | null;
        const changePct = val.changePercent as number | null;
        const currency = String(val.currency ?? "USD");
        const source = String(val.source ?? "");
        let line = `• ${symbol}: ${price.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`;
        if (change != null && changePct != null) {
          const arrow = change >= 0 ? "▲" : "▼";
          line += ` ${arrow} ${change.toFixed(2)} (${changePct.toFixed(2)}%)`;
        }
        if (source) line += ` (source: ${source})`;
        return line;
      }

      // ── FX rate ────────────────────────────────────────────────────────
      if (tr.toolName === "fx_rate" && typeof val.rate === "number") {
        const from = String(val.from ?? "").toUpperCase();
        const to = String(val.to ?? "").toUpperCase();
        const rate = val.rate as number;
        const amount = val.amount as number;
        const converted = val.converted as number;
        const source = String(val.source ?? "");
        let line = `• ${amount} ${from} = ${converted.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${to}`;
        line += ` (rate: ${rate.toFixed(4)})`;
        if (source) line += ` (source: ${source})`;
        return line;
      }

      // ── Stock history ──────────────────────────────────────────────────
      if (tr.toolName === "stock_history" && typeof val.lastPrice === "number") {
        const symbol = String(val.symbol ?? "").toUpperCase();
        const firstPrice = val.firstPrice as number;
        const lastPrice = val.lastPrice as number;
        const highPrice = val.highPrice as number;
        const lowPrice = val.lowPrice as number;
        const changePercent = val.changePercent as number;
        const currency = String(val.currency ?? "USD");
        const range = String(val.range ?? "");
        const firstDate = String(val.firstDate ?? "");
        const lastDate = String(val.lastDate ?? "");
        let line = `• ${symbol} (${range}): ${lastPrice.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`;
        if (typeof changePercent === "number") {
          const arrow = changePercent >= 0 ? "▲" : "▼";
          line += ` ${arrow} ${Math.abs(changePercent).toFixed(2)}%`;
        }
        line += `\n  Range: ${lowPrice.toLocaleString("en-US", { maximumFractionDigits: 2 })} – ${highPrice.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`;
        line += `\n  Period: ${firstDate} → ${lastDate}`;
        return line;
      }

      // ── Drive search / list recent ─────────────────────────────────────
      if ((tr.toolName === "drive_search" || tr.toolName === "drive_list_recent") && Array.isArray(val.files)) {
        const files = val.files as Array<Record<string, unknown>>;
        if (files.length === 0) return "No Drive files found.";
        return files
          .map((f, i) => {
            const name = String(f.name ?? "Untitled");
            const link = f.webViewLink ? ` ${f.webViewLink}` : "";
            return `${i + 1}. ${name}${link}`;
          })
          .join("\n");
      }

      // ── Drive read text ────────────────────────────────────────────────
      if (tr.toolName === "drive_read_text" && typeof val.text === "string") {
        const name = String(val.name ?? "File");
        const truncated = val.truncated;
        const text = val.text as string;
        let out = `📄 ${name}\n\n${text.slice(0, 1800)}`;
        if (truncated || text.length > 1800) out += "\n\n--- (truncated) ---";
        return out;
      }

      // ── Drive get link ─────────────────────────────────────────────────
      if (tr.toolName === "drive_get_link" && typeof val.link === "string") {
        const name = String(val.name ?? "File");
        return `${name}\n${val.link}`;
      }

      // ── Receipts ───────────────────────────────────────────────────────
      if ((tr.toolName === "list_receipts" || tr.toolName === "search_receipts") && Array.isArray(val.receipts)) {
        const receipts = val.receipts as Array<Record<string, unknown>>;
        if (receipts.length === 0) return String(val.message ?? "No receipts found.");
        const total = val.total as number | undefined;
        const count = val.count as number | undefined;
        const lines = receipts
          .map((r, i) => {
            const merchant = String(r.merchant ?? "Unknown");
            const date = String(r.date ?? "").slice(0, 10);
            const amount = typeof r.total === "number" ? r.total.toFixed(2) : "?";
            const currency = String(r.currency ?? "");
            return `${i + 1}. ${merchant}${date ? ` (${date})` : ""} — ${amount} ${currency}`;
          })
          .join("\n");
        const suffix = total != null ? `\n\nTotal: ${total.toFixed(2)}` : count != null ? `\n\n(${count} found)` : "";
        return lines + suffix;
      }

      // ── Memories ───────────────────────────────────────────────────────
      if (tr.toolName === "list_memories" && Array.isArray(val.facts)) {
        const facts = val.facts as Array<Record<string, unknown>>;
        if (facts.length === 0) return "No memories saved yet.";
        return facts.map((f) => String(f.display ?? f.text ?? "")).join("\n");
      }

      // ── Archived memory search ─────────────────────────────────────────
      if (tr.toolName === "search_archived_memory" && Array.isArray(val.results)) {
        const results = val.results as Array<Record<string, unknown>>;
        if (results.length === 0) return "No archived memories match that query.";
        return results
          .map((r, i) => {
            const summary = String(r.summary ?? r.text ?? "(no summary)");
            return `${i + 1}. ${summary.slice(0, 200)}`;
          })
          .join("\n\n");
      }

      // ── Archived memory list ───────────────────────────────────────────
      if (tr.toolName === "list_archived_memory" && Array.isArray(val.chunks)) {
        const chunks = val.chunks as Array<Record<string, unknown>>;
        if (chunks.length === 0) return "No archived memories yet.";
        return chunks
          .map((c, i) => {
            const summary = String(c.summary ?? "(no summary)");
            const date = c.ts ? new Date(c.ts as number).toISOString().slice(0, 10) : "";
            return `${i + 1}. ${date ? `[${date}] ` : ""}${summary.slice(0, 200)}`;
          })
          .join("\n\n");
      }

      // ── Sent history ───────────────────────────────────────────────────
      if (tr.toolName === "sent_history" && Array.isArray(val.entries)) {
        const entries = val.entries as Array<Record<string, unknown>>;
        if (entries.length === 0) return "No sent items found in that window.";
        return entries
          .map((e, i) => {
            const kind = String(e.kind ?? "unknown");
            const detail = e.detail as Record<string, unknown> | null;
            const ts = e.ts as number | null;
            const date = ts ? new Date(ts).toISOString().slice(0, 16).replace("T", " ") : "";
            let line = `${i + 1}. ${kind}${date ? ` — ${date}` : ""}`;
            if (detail?.subject) line += `\n  Subject: ${detail.subject}`;
            if (detail?.to && Array.isArray(detail.to)) line += `\n  To: ${(detail.to as string[]).join(", ")}`;
            return line;
          })
          .join("\n");
      }

      // ── Calendar free time ─────────────────────────────────────────────
      if (tr.toolName === "calendar_find_free_time" && Array.isArray(val.slots)) {
        const slots = val.slots as Array<Record<string, unknown>>;
        if (slots.length === 0) return "No free slots found in that window.";
        return slots
          .map((s) => {
            const start = String(s.startISO ?? "").slice(0, 16).replace("T", " ");
            const minutes = s.minutes as number;
            return `• ${start} — ${minutes} min free`;
          })
          .join("\n");
      }

      // ── All lists ──────────────────────────────────────────────────────
      if (tr.toolName === "show_all_lists" && Array.isArray(val.lists)) {
        const lists = val.lists as Array<Record<string, unknown>>;
        if (lists.length === 0) return "No lists yet.";
        return lists.map((l) => `• ${l.name} (${l.count} items)`).join("\n");
      }

      // ── Scheduled emails ───────────────────────────────────────────────
      if (tr.toolName === "list_scheduled_emails" && Array.isArray(val.scheduled)) {
        const scheduled = val.scheduled as Array<Record<string, unknown>>;
        if (scheduled.length === 0) return "No scheduled emails.";
        return scheduled
          .map((s) => {
            const subject = String(s.subject ?? "(no subject)");
            const sendAt = String(s.sendAt ?? "").slice(0, 16).replace("T", " ");
            const to = Array.isArray(s.to) ? (s.to as string[]).join(", ") : "";
            return `• ${subject}${sendAt ? ` — ${sendAt}` : ""}${to ? ` → ${to}` : ""}`;
          })
          .join("\n");
      }

      // ── Media AI (OCR / summarize / read) ──────────────────────────────
      if ((tr.toolName === "ocr_image" || tr.toolName === "summarize_image" || tr.toolName === "read_document" || tr.toolName === "summarize_document") && typeof val.output === "string") {
        return val.output;
      }
    }
  }
  return null;
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
    intent?: Intent;
    hasStagedMedia?: boolean;
  },
): Promise<AgentResult> {
  const endAgent = span("agent:runAgent", traceId);

  try {
    const [accounts, staged, settings] = await Promise.all([
      opts?.accounts ? Promise.resolve(opts.accounts) : listAccounts(userId),
      opts?.staged ? Promise.resolve(opts.staged) : listRecentMedia(userId),
      getSettings(userId),
    ]);
    const userHasGoogle = accounts.accounts.length > 0;
    tick("agent:preload-done", traceId, { accounts: accounts.accounts.length, staged: staged.length });
    const accountsBlock = accounts.accounts.length
      ? `\n\nConnected Google accounts: ${accounts.accounts
          .map((a) => `${a.email}${a.email === accounts.activeEmail ? " (active)" : ""}`)
          .join(", ")}.`
      : "";
    // Only mention staged items from the last 5 minutes to keep the prompt tight.
    const freshStaged = staged.filter((m) => Date.now() - m.ts < 5 * 60_000);
    const recentBlock = freshStaged.length
      ? `\n\nStaged LINE media (1-indexed, oldest first). The user may be referring to one of these:\n${freshStaged
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
    const suppressFactsIntents = new Set<Intent>(["task", "memory", "lists", "reminder", "media"]);
    const factsBlock = opts?.intent && suppressFactsIntents.has(opts.intent)
      ? ""
      : factsToPromptBlock(facts);
    const system =
      buildSystemPrompt(factsBlock, profile, settings) +
      "\n\n" +
      buildTimeContext(tz) +
      accountsBlock +
      recentBlock;

    const timePrefix: ModelMessage[] = [];

    const tracker = createStepTracker(traceId);

    const endTools = span("agent:toolsForUser", traceId);
    const tools =
      opts?.tools ??
      (await toolsForUser(userId, {
        userHasGoogle,
        disabledCategories: settings.disabledCategories,
        intent: opts?.intent,
        hasStagedMedia: opts?.hasStagedMedia,
      }));
    endTools({ toolCount: Object.keys(tools).length });

    const endGenerate = span("agent:generateText", traceId);
    const result = await withTimeout(
      generateText({
        model: chatModel(),
        system,
        messages: [...timePrefix, ...messages],
        tools,
        temperature: 0.6,
        stopWhen: stepCountIs(8),
        maxRetries: 1,
        onStepFinish: (step) => tracker.record(step as Parameters<ReturnType<typeof createStepTracker>["record"]>[0]),
        providerOptions: GEMINI_PROVIDER_OPTIONS,
      }),
      AGENT_TIMEOUT_MS,
    );
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
    const { messages: flexMessages, suppressText } = buildFlexFromToolResults(result as any, settings?.timezone, {
      userText: lastUserText,
    });
    // NEVER suppress text when auth is needed — the connect message is critical.
    let finalText = suppressText && !processed.authNeeded ? "" : text;
    let extraToolCalls = tracker.allCalls;
    if (finalText === "I didn't catch that — could you rephrase?") {
      // Deterministic fallbacks: if the model blanks on an unambiguous query,
      // execute the canonical tool ourselves rather than returning a useless reply.
      if (looksLikeMemoryRecall(lastUserText)) {
        const fb = await fallbackListMemories(userId, profile.displayName);
        finalText = fb.text;
        extraToolCalls = fb.toolCalls;
      } else if (looksLikeTaskList(lastUserText)) {
        const fb = await fallbackListTasks(userId, profile.displayName, settings?.timezone);
        finalText = fb.text;
        extraToolCalls = fb.toolCalls;
      } else if (looksLikeWeather(lastUserText)) {
        const fb = await fallbackWeather(lastUserText, settings?.timezone);
        finalText = fb.text;
        extraToolCalls = fb.toolCalls;
      } else if (opts?.hasStagedMedia && looksLikeMediaQuery(lastUserText)) {
        const fb = await fallbackSummarizeDocument(userId, profile.displayName);
        finalText = fb.text;
        extraToolCalls = fb.toolCalls;
      }
    }
    const followUps = buildFollowUps(extraToolCalls.map((c) => c.toolName), { confirmDraft, modelText: finalText });
    endProcess({ confirmDraft, flexCount: flexMessages?.length ?? 0 });
    const hints: AgentHints = {
      confirmDraft,
      pickAccount:
        accounts.accounts.length > 1 &&
        /which (google )?account/i.test(text) &&
        tracker.successfulCalls.some((c) =>
          c.toolName === "draft_email" ||
          c.toolName === "draft_calendar_event" ||
          c.toolName === "upload_to_drive",
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

async function fallbackListMemories(userId: string, displayName: string): Promise<{ text: string; toolCalls: { toolName: string; input: unknown }[] }> {
  const f = await loadFacts(userId);
  const ordered = displayOrder(f.facts);
  if (ordered.length === 0) {
    return {
      text: `I don't have any remembered facts for you yet, ${displayName}.`,
      toolCalls: [{ toolName: "list_memories", input: {} }],
    };
  }
  const now = Date.now();
  const lines = ordered.map((fact, i) => formatFactLine(fact, i + 1, now));
  return {
    text: `${displayName}, here's what I remember:\n${lines.join("\n")}`,
    toolCalls: [{ toolName: "list_memories", input: {} }],
  };
}

function looksLikeWeather(text: string): boolean {
  return /\b(weather|forecast|temperature|temp)\b/i.test(text);
}

function looksLikeMediaQuery(text: string): boolean {
  return /\b(read|summarize|analyze|ocr|tell\s+me\s+about|what('s|s|\s+is)|extract)\s+(this|that|it|the\s+(file|pdf|doc|document|image|photo|picture))\b/i.test(text);
}

async function fallbackWeather(query: string, timezone = "Asia/Bangkok"): Promise<{ text: string; toolCalls: { toolName: string; input: unknown }[] }> {
  const locationMatch = query.match(/\b(?:in|at|for)\s+(.{2,80}?)\s*(?:\?|$)/i);
  const location = locationMatch?.[1]?.trim() ?? "Bangkok";
  const tools = buildWeatherTools();
  try {
    const result = await tools.weather.execute!({ location }, { toolCallId: "fallback", messages: [] });
    const display = renderDisplayFallback({ steps: [{ toolResults: [{ toolName: "weather", output: result }] }] });
    return { text: display ?? "Weather lookup completed.", toolCalls: [{ toolName: "weather", input: { location } }] };
  } catch (err) {
    return { text: `I couldn't get the weather for ${location} right now.`, toolCalls: [{ toolName: "weather", input: { location } }] };
  }
}

async function fallbackSummarizeDocument(userId: string, displayName: string): Promise<{ text: string; toolCalls: { toolName: string; input: unknown }[] }> {
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

async function fallbackListTasks(userId: string, displayName: string, timezone = "Asia/Bangkok"): Promise<{ text: string; toolCalls: { toolName: string; input: unknown }[] }> {
  const tasks = await listTasks(userId, "open");
  if (tasks.length === 0) {
    return {
      text: `You don't have any open tasks right now, ${displayName}. 🎉`,
      toolCalls: [{ toolName: "list_tasks", input: { filter: "open" } }],
    };
  }
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: timezone, month: "short", day: "numeric" });
  const lines = tasks.map((t) => `• ${t.title}${t.dueAt ? ` — due ${fmt.format(new Date(t.dueAt))}` : ""}`);
  return {
    text: `${displayName}, here are your open tasks:\n${lines.join("\n")}`,
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
    return `Timed out after ${err.seconds}s — that was a heavy request. Try again in a sec.`;
  }
  const msg = err instanceof Error ? err.message : String(err);
  // Bug 4 & 5: Gemini 503 / cold-start Bad Gateway — return friendly message, not raw error
  if (/UNAVAILABLE|Bad.?Gateway|service.?unavailable/i.test(msg) || /\b50[23]\b/.test(msg)) {
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
