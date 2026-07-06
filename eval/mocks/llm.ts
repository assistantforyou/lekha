import { vi } from "vitest";
import type { GenerateTextResult, ToolSet, LanguageModelUsage } from "ai";

export type MockGenerateTextParams = {
  model: unknown;
  system?: string;
  messages: Array<{ role: string; content: unknown }>;
  tools?: ToolSet;
  [key: string]: unknown;
};

export type MockStep = {
  text?: string;
  toolCalls?: Array<{ toolName: string; input?: unknown; toolCallId?: string }>;
  toolResults?: Array<{ toolName?: string; output?: unknown; toolCallId?: string }>;
};

export type MockLLMScenario = {
  match?: (params: MockGenerateTextParams) => boolean;
  result: (params: MockGenerateTextParams) => MockedGenerateTextResult;
};

export type MockedGenerateTextResult = {
  text: string;
  steps: MockStep[];
  usage?: LanguageModelUsage;
  experimental_providerMetadata?: { google?: { cachedContentTokenCount?: number } };
};

const { getScenarios, setScenarios } = vi.hoisted(() => {
  let scenarios: MockLLMScenario[] = [];
  return {
    getScenarios: () => scenarios,
    setScenarios: (s: MockLLMScenario[]) => {
      scenarios = s;
    },
  };
});

export function mockGenerateText(scenarios: MockLLMScenario[]) {
  setScenarios(scenarios);
}

function lastUserText(params: MockGenerateTextParams): string {
  for (let i = params.messages.length - 1; i >= 0; i--) {
    const m = params.messages[i];
    if (m?.role === "user") {
      if (typeof m.content === "string") return m.content;
      if (Array.isArray(m.content)) {
        const textPart = m.content.find((p) => p && typeof p === "object" && (p as { type?: string }).type === "text");
        if (textPart && typeof textPart === "object" && "text" in textPart) {
          return String((textPart as { text?: unknown }).text ?? "");
        }
      }
    }
  }
  return "";
}

function buildStep(step: MockStep, index: number): Record<string, unknown> {
  const toolCalls = (step.toolCalls ?? []).map((tc) => ({
    type: "tool-call",
    toolCallId: tc.toolCallId ?? `call-${index}-${tc.toolName}`,
    toolName: tc.toolName,
    input: tc.input ?? {},
  }));

  const toolResults = (step.toolResults ?? []).map((tr, i) => {
    const call = step.toolCalls?.[i];
    return {
      type: "tool-result",
      toolCallId: tr.toolCallId ?? call?.toolCallId ?? `call-${index}-${tr.toolName ?? call?.toolName ?? "unknown"}`,
      toolName: tr.toolName ?? call?.toolName ?? "",
      output: tr.output,
    };
  });

  return {
    stepNumber: index,
    text: step.text ?? "",
    toolCalls,
    toolResults,
    staticToolCalls: toolCalls,
    staticToolResults: toolResults,
    dynamicToolCalls: [],
    dynamicToolResults: [],
    content: [{ type: "text", text: step.text ?? "" }],
    reasoning: [],
    reasoningText: undefined,
    files: [],
    sources: [],
    finishReason: "stop",
    rawFinishReason: "stop",
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      inputTokenDetails: {},
      outputTokenDetails: {},
    },
    warnings: undefined,
    request: {},
    response: { messages: [] },
    providerMetadata: undefined,
    experimental_context: undefined,
    functionId: undefined,
    metadata: undefined,
    model: { provider: "mock", modelId: "mock" },
  };
}

function buildUsage(base?: LanguageModelUsage): LanguageModelUsage {
  const usage: LanguageModelUsage = {
    inputTokens: base?.inputTokens ?? 100,
    outputTokens: base?.outputTokens ?? 20,
    totalTokens: base?.totalTokens ?? 120,
    inputTokenDetails: base?.inputTokenDetails ?? { noCacheTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 },
    outputTokenDetails: base?.outputTokenDetails ?? { textTokens: 20, reasoningTokens: 0 },
    reasoningTokens: 0,
  };
  return usage;
}

vi.mock("ai", async (importOriginal) => {
  const original = await importOriginal<typeof import("ai")>();
  return {
    ...original,
    generateText: async (params: MockGenerateTextParams) => {
      const scenarios = getScenarios();
      const scenario = scenarios.find((s) => !s.match || s.match(params));
      if (!scenario) {
        const preview = lastUserText(params) || JSON.stringify(params.messages.at(-1)).slice(0, 120);
        throw new Error(`[eval] no mock LLM scenario matched for message: ${preview}`);
      }
      const res = scenario.result(params);
      const onStepFinish = params.onStepFinish as ((step: unknown) => void) | undefined;
      const usage = buildUsage(res.usage);
      const totalUsage: LanguageModelUsage = {
        ...usage,
        inputTokens: res.steps.reduce((sum, s) => sum + (s.toolCalls?.length ? 10 : 0), usage.inputTokens ?? 0),
        outputTokens: res.steps.reduce((sum, s) => sum + (s.text?.length ? 1 : 0), usage.outputTokens ?? 0),
      };
      const text = res.text;
      const result = {
        text,
        content: [{ type: "text", text }],
        reasoning: [],
        reasoningText: undefined,
        files: [],
        sources: [],
        toolCalls: [],
        staticToolCalls: [],
        dynamicToolCalls: [],
        toolResults: [],
        staticToolResults: [],
        dynamicToolResults: [],
        finishReason: "stop",
        rawFinishReason: "stop",
        usage,
        totalUsage,
        warnings: undefined,
        request: {},
        response: { messages: [] },
        providerMetadata: undefined,
        experimental_providerMetadata: res.experimental_providerMetadata,
        steps: res.steps.map((s, i) => {
          const step = buildStep(s, i);
          onStepFinish?.(step);
          return step;
        }),
        experimental_output: undefined,
        output: undefined,
      };
      return result as unknown as GenerateTextResult<Record<string, never>, never>;
    },
  };
});
