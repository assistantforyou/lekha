import { describe, it, expect, beforeEach, vi } from "vitest";
import { fastClassify } from "@/lib/fast-classify";
import { toolsForUser } from "@/lib/tools";
import { resetRedisMock } from "@/eval/mocks/redis";

vi.mock("@/lib/memory/redis", async () => {
  const { createRedisMock } = await import("@/eval/mocks/redis");
  return { redis: createRedisMock };
});
vi.mock("@/lib/env", async () => {
  const { createEnvMock } = await import("@/eval/mocks/env");
  return createEnvMock();
});

beforeEach(() => resetRedisMock());

describe("fastClassify routing", () => {
  it("classifies task queries", () => {
    expect(fastClassify("what tasks do i have", {})).toBe("task");
    expect(fastClassify("add buy milk to my tasks", {})).toBe("task");
    expect(fastClassify("complete my task buy milk", {})).toBe("task");
  });

  it("classifies reminder queries", () => {
    expect(fastClassify("remind me to call mom at 6pm", {})).toBe("reminder");
  });

  it("classifies weather queries", () => {
    expect(fastClassify("weather in Bangkok", {})).toBe("weather");
  });

  it("classifies finance queries", () => {
    expect(fastClassify("NVDA stock price", {})).toBe("finance");
  });

  it("classifies memory queries", () => {
    expect(fastClassify("what do you remember about me", {})).toBe("memory");
  });

  it("returns undefined for casual chat", () => {
    expect(fastClassify("hi", {})).toBeUndefined();
    expect(fastClassify("thanks!", {})).toBeUndefined();
  });

  it("prioritizes media hint when staged media exists", () => {
    expect(fastClassify("what can you tell me about this", { hasStagedMedia: true })).toBe("media");
  });
});

describe("toolsForUser registry filtering", () => {
  it("includes universal tools without hint", async () => {
    const tools = await toolsForUser("U1", { userHasGoogle: false, hasStagedMedia: false });
    expect(Object.keys(tools)).toContain("weather");
    expect(Object.keys(tools)).toContain("show_help");
  });

  it("narrows to task tools with task hint", async () => {
    const tools = await toolsForUser("U1", { userHasGoogle: false, hint: "task" });
    expect(Object.keys(tools)).toContain("list_tasks");
    expect(Object.keys(tools)).toContain("add_task");
    expect(Object.keys(tools)).not.toContain("draft_email");
  });

  it("excludes Google tools when user has no account", async () => {
    const tools = await toolsForUser("U1", { userHasGoogle: false });
    expect(Object.keys(tools)).not.toContain("gmail_search");
  });

  it("excludes disabled categories", async () => {
    const tools = await toolsForUser("U1", {
      userHasGoogle: false,
      disabledCategories: ["tasks"],
    });
    expect(Object.keys(tools)).not.toContain("list_tasks");
    expect(Object.keys(tools)).not.toContain("add_task");
  });

  it("includes staged-media tools when media is present", async () => {
    const tools = await toolsForUser("U1", { userHasGoogle: false, hasStagedMedia: true });
    expect(Object.keys(tools)).toContain("summarize_document");
    expect(Object.keys(tools)).toContain("ocr_image");
  });
});
