import { vi } from "vitest";
import type { LanguageModelUsage } from "ai";

export type MockMastraGenerateParams = {
  messages: Array<{ role: string; content: unknown }>;
  instructions?: string;
  context?: unknown[];
  requestContext?: unknown;
  [key: string]: unknown;
};

export type MockMastraStep = {
  text?: string;
  toolCalls?: Array<{ toolName: string; input?: unknown; toolCallId?: string }>;
  toolResults?: Array<{ toolName?: string; output?: unknown; toolCallId?: string }>;
};

export type MockMastraScenario = {
  match?: (params: MockMastraGenerateParams) => boolean;
  result: (params: MockMastraGenerateParams) => MockedMastraGenerateResult;
};

export type MockedMastraGenerateResult = {
  text: string;
  steps: MockMastraStep[];
  usage?: LanguageModelUsage;
};

const { getScenarios, setScenarios } = vi.hoisted(() => {
  let scenarios: MockMastraScenario[] = [];
  return {
    getScenarios: () => scenarios,
    setScenarios: (s: MockMastraScenario[]) => {
      scenarios = s;
    },
  };
});

export function mockMastraAgent(scenarios: MockMastraScenario[]) {
  setScenarios(scenarios);
}

function lastUserText(params: MockMastraGenerateParams): string {
  for (let i = params.messages.length - 1; i >= 0; i--) {
    const m = params.messages[i];
    if (m?.role === "user") {
      if (typeof m.content === "string") return m.content;
      if (Array.isArray(m.content)) {
        const textPart = m.content.find(
          (p) => p && typeof p === "object" && (p as { type?: string }).type === "text",
        );
        if (textPart && typeof textPart === "object" && "text" in textPart) {
          return String((textPart as { text?: unknown }).text ?? "");
        }
      }
    }
  }
  return "";
}

function buildMastraStep(step: MockMastraStep, index: number): Record<string, unknown> {
  const toolCalls = (step.toolCalls ?? []).map((tc) => ({
    type: "tool-call",
    runId: "mock",
    from: "AGENT",
    payload: {
      toolCallId: tc.toolCallId ?? `call-${index}-${tc.toolName}`,
      toolName: tc.toolName,
      args: tc.input ?? {},
    },
  }));

  const toolResults = (step.toolResults ?? []).map((tr, i) => {
    const call = step.toolCalls?.[i];
    return {
      type: "tool-result",
      runId: "mock",
      from: "AGENT",
      payload: {
        toolCallId:
          tr.toolCallId ?? call?.toolCallId ?? `call-${index}-${tr.toolName ?? call?.toolName ?? "unknown"}`,
        toolName: tr.toolName ?? call?.toolName ?? "",
        result: tr.output,
      },
    };
  });

  return {
    stepType: index === 0 ? "initial" : "tool-result",
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

vi.mock("@/mastra/index", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/mastra/index")>();
  return {
    ...original,
    mastra: {
      ...original.mastra,
      getAgent: (id: string) => {
        if (id !== "lekha") {
          return original.mastra.getAgent(id);
        }
        return {
          generate: async (messages: unknown, options: Record<string, unknown>) => {
            const params: MockMastraGenerateParams = { messages: messages as MockMastraGenerateParams["messages"], ...options };
            const scenarios = getScenarios();
            const scenario = scenarios.find((s) => !s.match || s.match(params));
            if (!scenario) {
              const preview = lastUserText(params) || JSON.stringify(params.messages.at(-1)).slice(0, 120);
              throw new Error(`[eval] no Mastra scenario matched for message: ${preview}`);
            }
            const res = scenario.result(params);
            const onStepFinish = options.onStepFinish as ((step: unknown) => void) | undefined;
            const usage = buildUsage(res.usage);
            const totalUsage: LanguageModelUsage = {
              ...usage,
              inputTokens: res.steps.reduce((sum, s) => sum + (s.toolCalls?.length ? 10 : 0), usage.inputTokens ?? 0),
              outputTokens: res.steps.reduce((sum, s) => sum + (s.text?.length ? 1 : 0), usage.outputTokens ?? 0),
            };
            const steps = res.steps.map((s, i) => {
              const step = buildMastraStep(s, i);
              onStepFinish?.(step);
              return step;
            });
            return {
              text: res.text,
              usage,
              totalUsage,
              steps,
              finishReason: "stop",
              rawFinishReason: "stop",
              warnings: undefined,
              request: {},
              response: { messages: [] },
              providerMetadata: undefined,
              toolCalls: [],
              toolResults: [],
              files: [],
              sources: [],
              reasoning: [],
              reasoningText: undefined,
              content: [{ type: "text", text: res.text }],
            } as unknown as Record<string, unknown>;
          },
        };
      },
    },
  };
});
