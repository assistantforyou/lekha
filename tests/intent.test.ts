import { describe, it, expect } from "vitest";
import { fastClassify, classifyIntent } from "@/lib/intent";

// classifyIntent falls back to fastClassify in tests because generateObject would
// require a real API key. We still exercise the public API wrapper for coverage.
describe("classifyIntent", () => {
  it("returns fast-classified casual intent without an API call", async () => {
    const result = await classifyIntent("test");
    expect(result.primary).toBe("casual");
    expect(result.confidence).toBe("high");
  });

  it("defaults to media when text is empty and an image is attached", async () => {
    const result = await classifyIntent("", { hasImage: true });
    expect(result.primary).toBe("media");
  });
});

describe("fastClassify", () => {
  it("classifies greetings and test as casual", () => {
    expect(fastClassify("test")?.primary).toBe("casual");
    expect(fastClassify("hi")?.primary).toBe("casual");
    expect(fastClassify("hello")?.primary).toBe("casual");
    expect(fastClassify("thanks")?.primary).toBe("casual");
    expect(fastClassify("goodbye")?.primary).toBe("casual");
  });

  it("classifies emoji requests as casual", () => {
    expect(fastClassify("Show me the unicorn emoji")?.primary).toBe("casual");
    expect(fastClassify("send me a heart emoji")?.primary).toBe("casual");
  });

  it("classifies article complaints as casual", () => {
    expect(fastClassify("STOP SENDING ME ARTICLES BRO")?.primary).toBe("casual");
    expect(fastClassify("stop sending me that")?.primary).toBe("casual");
  });

  it("classifies explicit news requests as news", () => {
    expect(fastClassify("search for the top 10 news in finance")?.primary).toBe("news");
    expect(fastClassify("what's the latest news on Tesla?")?.primary).toBe("news");
    expect(fastClassify("breaking news about AI")?.primary).toBe("news");
  });

  it("classifies explicit task requests as task", () => {
    expect(fastClassify("add a task")?.primary).toBe("task");
    expect(fastClassify("my tasks")?.primary).toBe("task");
    expect(fastClassify("what tasks do I have today")?.primary).toBe("task");
  });

  it("classifies reminder requests as reminder", () => {
    expect(fastClassify("remind me to call mom")?.primary).toBe("reminder");
    expect(fastClassify("what reminders do I have")?.primary).toBe("reminder");
  });

  it("classifies weather requests as weather", () => {
    expect(fastClassify("what's the weather today")?.primary).toBe("weather");
  });

  it("classifies finance requests as finance", () => {
    expect(fastClassify("NVDA stock")?.primary).toBe("finance");
    expect(fastClassify("bitcoin price")?.primary).toBe("finance");
  });

  it("classifies connect google as connect", () => {
    expect(fastClassify("connect google")?.primary).toBe("connect");
  });

  it("returns null for ambiguous inputs that need LLM classification", () => {
    expect(fastClassify("why did semiconductors drop last night")).toBeNull();
    expect(fastClassify("what's the latest on Tesla?")).toBeNull();
  });

  it("detects multi-intent requests", () => {
    const result = fastClassify("email John and check the weather");
    expect(result?.primary).toBe("multi");
    expect(result?.isMulti).toBe(true);
  });
});
