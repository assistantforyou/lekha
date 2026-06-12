import { describe, it, expect } from "vitest";
import { buildFlexFromToolResults } from "@/lib/llm/agent-flex";

describe("buildFlexFromToolResults news guard", () => {
  const newsResult = {
    steps: [
      {
        toolResults: [
          {
            toolName: "news_search",
            output: {
              ok: true,
              stories: [
                { title: "Stocks weigh as foreign investors pull $27 bln", url: "https://example.com/1", snippet: "Stocks..." },
              ],
            },
          },
        ],
      },
    ],
  };

  it("renders news carousel when user asks for news", () => {
    const { messages, suppressText } = buildFlexFromToolResults(newsResult, "Asia/Bangkok", {
      userText: "top 10 news in finance",
    });
    expect(messages.length).toBeGreaterThan(0);
    expect(suppressText).toBe(true);
  });

  it("suppresses news carousel for vague 'test' messages", () => {
    const { messages, suppressText } = buildFlexFromToolResults(newsResult, "Asia/Bangkok", {
      userText: "test",
    });
    expect(messages).toHaveLength(0);
    expect(suppressText).toBe(false);
  });

  it("suppresses news carousel for emoji requests", () => {
    const { messages, suppressText } = buildFlexFromToolResults(newsResult, "Asia/Bangkok", {
      userText: "Show me the unicorn emoji",
    });
    expect(messages).toHaveLength(0);
    expect(suppressText).toBe(false);
  });

  it("suppresses news carousel for complaints about articles", () => {
    const { messages, suppressText } = buildFlexFromToolResults(newsResult, "Asia/Bangkok", {
      userText: "STOP SENDING ME ARTICLES BRO",
    });
    expect(messages).toHaveLength(0);
    expect(suppressText).toBe(false);
  });

  it("still renders news carousel when user text is empty (fallback to model judgment)", () => {
    const { messages, suppressText } = buildFlexFromToolResults(newsResult, "Asia/Bangkok");
    expect(messages.length).toBeGreaterThan(0);
    expect(suppressText).toBe(true);
  });
});
