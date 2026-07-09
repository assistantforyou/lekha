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

describe("buildFlexFromToolResults document + drive cards", () => {
  it("renders Drive upload confirmation with file link", () => {
    const result = {
      steps: [
        {
          toolResults: [
            {
              toolName: "drive_upload_recent_media",
              output: {
                ok: true,
                uploaded: [
                  { id: "f1", name: "certificate.pdf", webViewLink: "https://drive.google.com/file/d/f1/view" },
                ],
              },
            },
          ],
        },
      ],
    };
    const { messages, suppressText } = buildFlexFromToolResults(result, "Asia/Bangkok");
    expect(messages.length).toBeGreaterThan(0);
    expect(suppressText).toBe(true);
    const json = JSON.stringify(messages);
    expect(json).toContain("Saved to Drive");
    expect(json).toContain("certificate.pdf");
    expect(json).toContain("https://drive.google.com/file/d/f1/view");
  });

  it("strips markdown from document summary output", () => {
    const result = {
      steps: [
        {
          toolResults: [
            {
              toolName: "summarize_document",
              output: {
                ok: true,
                output: "* **Purpose:** This is a test\n- Item two",
              },
            },
          ],
        },
      ],
    };
    const { messages, suppressText } = buildFlexFromToolResults(result, "Asia/Bangkok");
    expect(messages.length).toBeGreaterThan(0);
    expect(suppressText).toBe(true);
    const json = JSON.stringify(messages);
    expect(json).not.toContain("**Purpose:**");
    expect(json).toContain("Purpose: This is a test");
    expect(json).toContain("• Item two");
  });

  it("renders long document summaries without 120-char truncation", () => {
    const longText = "A".repeat(1000);
    const result = {
      steps: [
        {
          toolResults: [
            {
              toolName: "summarize_document",
              output: { ok: true, output: longText },
            },
          ],
        },
      ],
    };
    const { messages } = buildFlexFromToolResults(result, "Asia/Bangkok");
    const json = JSON.stringify(messages);
    expect(json).toContain(longText);
    expect(json).not.toContain("A".repeat(120) + " …");
  });

  it("strips meta-introductions from document summaries", () => {
    const result = {
      steps: [
        {
          toolResults: [
            {
              toolName: "summarize_document",
              output: { ok: true, output: "Here's a summary of the document in 6 bullets:\n\nThis is the actual content." },
            },
          ],
        },
      ],
    };
    const { messages } = buildFlexFromToolResults(result, "Asia/Bangkok");
    const json = JSON.stringify(messages);
    expect(json).not.toContain("Here's a summary");
    expect(json).not.toContain("in 6 bullets");
    expect(json).toContain("This is the actual content");
  });
});

describe("buildFlexFromToolResults places consolidation", () => {
  it("combines web_search summary and places card into one message", () => {
    const result = {
      steps: [
        {
          toolResults: [
            {
              toolName: "web_search",
              output: {
                ok: true,
                answer: "Here are some great restaurants in Sukhumvit.",
                results: [{ title: "Best Sukhumvit restaurants", url: "https://example.com/1" }],
              },
            },
            {
              toolName: "suggest_places",
              output: {
                ok: true,
                title: "Restaurants",
                items: [
                  { name: "Soul Food Mahanakorn", note: "Thai sharing plates", mapsQuery: "Soul Food Mahanakorn Bangkok" },
                  { name: "Err", note: "Rustic Thai", mapsQuery: "Err Bangkok" },
                ],
              },
            },
          ],
        },
      ],
    };
    const { messages, suppressText } = buildFlexFromToolResults(result, "Asia/Bangkok", { userText: "where should we eat" });
    expect(messages).toHaveLength(1);
    expect(suppressText).toBe(true);
    const json = JSON.stringify(messages);
    expect(json).toContain("Here are some great restaurants in Sukhumvit.");
    expect(json).toContain("Soul Food Mahanakorn");
    expect(json).not.toContain("🔍 Web Search");
  });

  it("still renders web_search card when there is no places card", () => {
    const result = {
      steps: [
        {
          toolResults: [
            {
              toolName: "web_search",
              output: {
                ok: true,
                answer: "The capital of France is Paris.",
                results: [],
              },
            },
          ],
        },
      ],
    };
    const { messages, suppressText } = buildFlexFromToolResults(result, "Asia/Bangkok", { userText: "what is the capital of france" });
    expect(messages.length).toBeGreaterThan(0);
    expect(suppressText).toBe(true);
    const json = JSON.stringify(messages);
    expect(json).toContain("Paris");
  });

  it("renders web_search sources as clickable URI buttons", () => {
    const result = {
      steps: [
        {
          toolResults: [
            {
              toolName: "web_search",
              output: {
                ok: true,
                answer: "Legal grounds include defamation and fraud.",
                results: [
                  { title: "OWASP LLM09:2025", url: "https://owasp.org/llm09" },
                  { title: "MisLC paper", url: "https://example.com/mislc" },
                ],
              },
            },
          ],
        },
      ],
    };
    const { messages, suppressText } = buildFlexFromToolResults(result, "Asia/Bangkok", {
      userText: "legal grounds for misinformation",
    });
    expect(messages.length).toBeGreaterThan(0);
    expect(suppressText).toBe(true);
    const json = JSON.stringify(messages);
    expect(json).toContain("https://owasp.org/llm09");
    expect(json).toContain('"type":"uri"');
    expect(json).toContain("OWASP LLM09:2025");
  });
});
