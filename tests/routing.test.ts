import { describe, it, expect } from "vitest";
import { BASE_PERSONALITY } from "@/lib/llm/prompts";
import { isTaskQuery } from "@/lib/shortcuts";

describe("prompt routing rules", () => {
  it("does not tell the model to lean toward searching for every question", () => {
    expect(BASE_PERSONALITY).not.toMatch(/lean toward searching/i);
    expect(BASE_PERSONALITY).not.toMatch(/when in doubt, search/i);
  });

  it("restricts news_search to explicit news requests only", () => {
    expect(BASE_PERSONALITY).toMatch(/news_search.*ONLY for explicit news/i);
    expect(BASE_PERSONALITY).toMatch(/NEVER call for greetings, casual chat, test messages/i);
    expect(BASE_PERSONALITY).toMatch(/Do NOT proactively offer news/i);
  });

  it("tells web_search to never handle news/current events", () => {
    expect(BASE_PERSONALITY).toMatch(/web_search.*NEVER for news\/current events/i);
  });

  it("warns against searching for casual chat / emoji / metaprompts", () => {
    expect(BASE_PERSONALITY).toMatch(/emoji requests/i);
    expect(BASE_PERSONALITY).toMatch(/metaprompts/i);
    expect(BASE_PERSONALITY).toMatch(/test messages/i);
  });

  it("requires search results to come only from the tool response", () => {
    expect(BASE_PERSONALITY).toMatch(/ONLY include what the tool actually returned/i);
    expect(BASE_PERSONALITY).toMatch(/Do not invent headlines/i);
  });
});

describe("shortcut routing", () => {
  it("rejects 'add a task' as a task query", () => {
    expect(isTaskQuery("add a task")).toBe(false);
    expect(isTaskQuery("create a task")).toBe(false);
    expect(isTaskQuery("new task")).toBe(false);
  });

  it("still matches genuine task list queries", () => {
    expect(isTaskQuery("my tasks")).toBe(true);
    expect(isTaskQuery("what tasks do i have")).toBe(true);
    expect(isTaskQuery("show me my todo list")).toBe(true);
    expect(isTaskQuery("what do i need to do today")).toBe(true);
  });
});
