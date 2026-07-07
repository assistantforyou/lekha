import { describe, it, expect, beforeEach, vi } from "vitest";

import { mockMastraAgent, type MockMastraScenario } from "@/eval/mocks/mastra-agent";
import { resetRedisMock } from "@/eval/mocks/redis";

vi.mock("@/lib/memory/redis", async () => {
  const { createRedisMock } = await import("@/eval/mocks/redis");
  return { redis: createRedisMock };
});
vi.mock("@/lib/env", async () => {
  const { createEnvMock } = await import("@/eval/mocks/env");
  return createEnvMock();
});
vi.mock("@/lib/line/client", () => ({
  replyOrPush: vi.fn(),
  push: vi.fn(),
  text: (s: string) => ({ type: "text", text: s }),
  showLoading: vi.fn(),
}));
vi.mock("@/lib/memory/audit-log", () => ({ appendAuditEntry: vi.fn(async () => {}) }));

import { runMastraAgent } from "@/mastra/run";
import { addTask } from "@/lib/memory/tasks";
import { resetEvalState } from "@/eval/fixtures/state";
import { testProfile, testSettings, emptyFacts, TEST_USER_ID } from "@/eval/fixtures/user";
import { requiredTool } from "@/eval/engine/matchers";

beforeEach(async () => {
  await resetEvalState();
});

function baseOpts(overrides: { hint?: string } = {}) {
  return {
    userId: TEST_USER_ID,
    profile: testProfile(),
    facts: emptyFacts(),
    settings: testSettings(),
    accounts: { accounts: [] as Array<{ email: string }>, activeEmail: null as string | null },
    staged: [] as Array<{
      kind: string;
      messageId: string;
      ts: number;
      fileName?: string;
      contentType?: string;
      sizeBytes?: number;
    }>,
    hasStagedMedia: false,
    hint: overrides.hint,
  };
}

describe("deterministic fallback execution", () => {
  it("falls back to list_tasks when model blanks on task query", async () => {
    const scenario: MockMastraScenario = {
      result: () => ({
        text: "I didn't catch that — could you rephrase?",
        steps: [],
      }),
    };
    mockMastraAgent([scenario]);

    await addTask(TEST_USER_ID, { title: "buy milk" });

    const result = await runMastraAgent(
      [{ role: "user" as const, content: "show my tasks" }],
      baseOpts({ hint: "task" }),
    );

    expect(requiredTool(result, "list_tasks").pass).toBe(true);
    expect(result.historyText.length).toBeGreaterThan(0);
    expect(result.hints.flexMessages?.length ?? 0).toBeGreaterThan(0);
  });

  it("falls back to weather when model blanks on weather query", async () => {
    const scenario: MockMastraScenario = {
      result: () => ({
        text: "",
        steps: [],
      }),
    };
    mockMastraAgent([scenario]);

    // Mock weather APIs so the test doesn't depend on slow/unreliable third parties.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const u = url.toString();
        if (u.includes("wttr.in")) {
          return new Response(
            JSON.stringify({
              current_condition: [{
                temp_C: "32",
                temp_F: "90",
                FeelsLikeC: "36",
                weatherDesc: [{ value: "Sunny" }],
                humidity: "65",
                windspeedKmph: "10",
                winddir16Point: "SW",
              }],
              nearest_area: [{
                areaName: [{ value: "Bangkok" }],
                region: [{ value: "Bangkok" }],
                country: [{ value: "Thailand" }],
              }],
              weather: [
                { date: "2026-07-07", maxtempC: "33", mintempC: "26", hourly: [{ chanceofrain: "10", weatherDesc: [{ value: "Sunny" }] }] },
                { date: "2026-07-08", maxtempC: "32", mintempC: "26", hourly: [{ chanceofrain: "20", weatherDesc: [{ value: "Cloudy" }] }] },
                { date: "2026-07-09", maxtempC: "31", mintempC: "25", hourly: [{ chanceofrain: "30", weatherDesc: [{ value: "Rain" }] }] },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({}), { status: 200 });
      }),
    );

    const result = await runMastraAgent(
      [{ role: "user" as const, content: "weather in Bangkok" }],
      baseOpts({ hint: "weather" }),
    );

    expect(requiredTool(result, "weather").pass).toBe(true);
  });
});
