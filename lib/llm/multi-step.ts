import { generateText } from "ai";
import { z } from "zod";
import type { ToolSet, Tool } from "ai";
import { withGeminiFallback } from "./provider";
import { buildTimeContext } from "./prompts";

const PlannedCallSchema = z.object({
  tool: z.string().describe("Exact tool name from the catalog"),
  input: z.record(z.string(), z.unknown()).describe("Tool arguments matching the tool's input schema"),
  reason: z.string().max(120).optional().describe("Why this tool is needed for the user's request"),
});

const PlanSchema = z.object({
  calls: z
    .array(PlannedCallSchema)
    .max(8)
    .describe("Ordered list of tool calls needed to fulfill the user's multi-step request"),
});

export type PlannedCall = z.infer<typeof PlannedCallSchema>;
export type ToolResult = { tool: string; input: unknown; output: unknown };

const MAX_RETRIES = 2;

/**
 * Conservative heuristic for messages that contain multiple independent requests.
 * Catches numbered lists, bulleted lists, and explicit multi-part language.
 */
export function looksMultiStep(userText: string): boolean {
  const t = userText.trim();
  // Numbered or lettered list with at least two items, e.g. "1) ... 2) ...", "(1) ... (2) ...", "a. ... b. ..."
  if (
    /(?:\(\s*\d+\s*[.)]\s*|\b\d+[.)]\s+|\b\w[.)]\s+)\S+[\s\S]*?(?:\n|\s+(?:and|also|plus)\s+|\s*,\s*)(?:\(\s*\d+\s*[.)]\s*|\b\d+[.)]\s+|\b\w[.)]\s+)\S+/is.test(
      t,
    )
  ) {
    return true;
  }
  // "Please: A, B, C" or similar colon-delimited lists
  if (/\bplease\s*[:;]\s*(?:\S+\s*(?:,|;|\n)\s*){2,}\S+/i.test(t)) {
    return true;
  }
  // Multiple distinct action clauses joined by and/or/plus
  if (
    /(?:\?|\.)\s+(?:and|also|plus)\s+(?:can you|could you|please|check|search|find|add|remember|tell|give)/i.test(
      t,
    )
  ) {
    return true;
  }
  return false;
}

function buildToolCatalog(tools: ToolSet): string {
  const lines: string[] = [];
  for (const [name, t] of Object.entries(tools)) {
    const tool = t as Tool<unknown, unknown>;
    const desc = tool.description?.trim() || "No description";
    const schema = (tool.inputSchema as { toJSONSchema?: () => unknown }).toJSONSchema?.();
    const schemaStr = schema ? ` Input JSON schema: ${JSON.stringify(schema)}` : "";
    lines.push(`- ${name}: ${desc.replace(/\s+/g, " ")}${schemaStr}`);
  }
  return lines.join("\n");
}

function formatResultForSynthesis(result: unknown): string {
  if (result === null || result === undefined) return "(no result)";
  if (typeof result === "string") return result.slice(0, 800);
  if (typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (r.ok === false && typeof r.error === "string") return `Error: ${r.error}`;
    // Prefer a text/summary field if present
    if (typeof r.text === "string") return r.text.slice(0, 800);
    if (typeof r.summary === "string") return r.summary.slice(0, 800);
    return JSON.stringify(result).slice(0, 800);
  }
  return String(result).slice(0, 800);
}

async function planCalls(
  userText: string,
  tools: ToolSet,
  context: { timezone: string; language?: string | null; displayName?: string },
  priorErrors?: string[],
): Promise<PlannedCall[]> {
  const catalog = buildToolCatalog(tools);
  const timeContext = buildTimeContext(context.timezone);
  const lang = context.language && context.language !== "en" ? `Reply in ${context.language}.` : "Reply in English.";

  const system = `You are Lekha's planner. The user sent a message with multiple independent requests.

Current context:
${timeContext}

Available tools:
${catalog}

Your job: output a JSON list of tool calls that, together, fulfill every request in the user's message.
Rules:
- Only include tools that are actually needed.
- Use exact tool names from the catalog.
- For each tool, use its Input JSON schema to construct the input object. EVERY required field must have a value.
- NEVER return an empty input object ({}).
- For weather, include { "location": "<city>" }.
- For web_search/news_search, include { "query": "<search query>" }.
- For remember, include { "fact": "<fact text>", "category": "<category>" }.
- For add_task, include { "title": "<task title>" }.
- For fx_rate, include { "from": "USD", "to": "THB" }.
- Do not include tools that require user confirmation (drafts are fine; do NOT call sendEmail or create_calendar_event directly).

Example input schema:
- weather: { "location": "string" }
Example output:
[{ "tool": "weather", "input": { "location": "Bangkok" }, "reason": "User asked for Bangkok weather" }]
${lang}`;

  const errorBlock = priorErrors?.length
    ? `\n\nThe previous plan had these validation errors — fix them:\n${priorErrors.map((e) => `- ${e}`).join("\n")}`
    : "";

  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { text } = await withGeminiFallback((model) =>
        generateText({
          model,
          system,
          prompt: `User message:\n${userText}${errorBlock}\n\nOutput JSON only. No prose.`,
          maxRetries: 2,
        }),
      );
      const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
      const parsed = JSON.parse(cleaned);
      const plan = PlanSchema.parse(Array.isArray(parsed) ? { calls: parsed } : parsed);
      // Filter out any tool names that don't exist
      const valid = plan.calls.filter((c) => c.tool in tools);
      return valid;
    } catch (err) {
      lastErr = err;
      console.warn("[multi-step] planner attempt failed", attempt, err);
      if (attempt === MAX_RETRIES) break;
    }
  }
  console.warn("[multi-step] planner failed, falling back to empty plan", lastErr);
  return [];
}

async function executeCalls(calls: PlannedCall[], tools: ToolSet): Promise<ToolResult[]> {
  const results: ToolResult[] = [];
  await Promise.all(
    calls.map(async (call) => {
      const tool = tools[call.tool] as Tool<unknown, unknown> | undefined;
      if (!tool || !tool.execute) {
        results.push({ tool: call.tool, input: call.input, output: { ok: false, error: "Tool not available" } });
        return;
      }
      try {
        const output = await tool.execute(call.input, { messages: [], abortSignal: undefined } as any);
        results.push({ tool: call.tool, input: call.input, output });
      } catch (err) {
        results.push({
          tool: call.tool,
          input: call.input,
          output: { ok: false, error: err instanceof Error ? err.message : String(err) },
        });
      }
    }),
  );
  return results;
}

async function synthesizeReply(
  userText: string,
  results: ToolResult[],
  context: { timezone: string; language?: string | null; displayName?: string },
): Promise<string> {
  const timeContext = buildTimeContext(context.timezone);
  const lang = context.language && context.language !== "en" ? `Reply in ${context.language}.` : "Reply in English.";
  const resultBlock = results
    .map((r) => `## ${r.tool}\nInput: ${JSON.stringify(r.input)}\nResult: ${formatResultForSynthesis(r.output)}`)
    .join("\n\n");

  const system = `You are Lekha, a warm, concise personal secretary in the user's LINE chat.

${timeContext}

The user asked several things at once. You have already gathered the results below. Write ONE concise, friendly reply that addresses every request. Cite sources and timestamps for live data (weather, rates, search). Use LINE formatting: short paragraphs, • bullets, emoji where helpful. Avoid markdown (*, **, #, leading -).

IMPORTANT: ${lang}`;

  const { text } = await withGeminiFallback((model) =>
    generateText({
      model,
      system,
      prompt: `User message:\n${userText}\n\nTool results:\n${resultBlock}`,
      maxRetries: 2,
    }),
  );

  return text;
}

function validateCalls(calls: PlannedCall[], tools: ToolSet): { valid: PlannedCall[]; errors: string[] } {
  const valid: PlannedCall[] = [];
  const errors: string[] = [];
  for (const call of calls) {
    const tool = tools[call.tool] as Tool<unknown, unknown> | undefined;
    if (!tool) {
      errors.push(`Tool "${call.tool}" does not exist`);
      continue;
    }
    const parse = (tool.inputSchema as { safeParse?: (input: unknown) => { success: boolean; error?: { issues?: { message: string; path?: (string | number)[] }[] } } }).safeParse?.(call.input);
    if (parse && !parse.success) {
      const issues = parse.error?.issues?.map((i) => `${i.path?.join(".") ?? "input"}: ${i.message}`) ?? ["invalid input"];
      errors.push(`Tool "${call.tool}" ${issues.join("; ")}`);
      continue;
    }
    valid.push(call);
  }
  return { valid, errors };
}

/**
 * Deterministic multi-step handler: plan → execute → synthesize.
 * Returns a result shape compatible with runMastraAgent's post-processing.
 */
export async function runMultiStep(
  userText: string,
  tools: ToolSet,
  context: { timezone: string; language?: string | null; displayName?: string },
): Promise<{ text: string; toolCalls: PlannedCall[]; toolResults: ToolResult[] }> {
  let calls = await planCalls(userText, tools, context);
  let { valid: callsToRun, errors } = validateCalls(calls, tools);

  // One repair attempt if the planner produced invalid inputs.
  if (errors.length > 0) {
    calls = await planCalls(userText, tools, context, errors);
    const repaired = validateCalls(calls, tools);
    callsToRun = repaired.valid;
    errors = repaired.errors;
  }

  if (callsToRun.length === 0) {
    return { text: "", toolCalls: [], toolResults: [] };
  }

  const results = await executeCalls(callsToRun, tools);
  const text = await synthesizeReply(userText, results, context);
  return { text, toolCalls: callsToRun, toolResults: results };
}
