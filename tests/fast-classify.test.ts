import { describe, it, expect } from "vitest";
import { fastClassify } from "@/lib/fast-classify";
import { BASE_PERSONALITY } from "@/lib/llm/prompts";

describe("fastClassify", () => {
  it("classifies recent/current event queries as 'recent' when they are unambiguous", () => {
    expect(fastClassify("What happened in the election today?")).toBe("recent");
    expect(fastClassify("Latest iPhone release")).toBe("recent");
    expect(fastClassify("Who won last night?")).toBe("recent");
    expect(fastClassify("Is the airport open right now?")).toBe("recent");
    expect(fastClassify("What did they announce this week?")).toBe("recent");
  });

  it("disambiguates overlapping intents by priority", () => {
    // "today" overlaps with recent, but high-confidence concrete intents win.
    expect(fastClassify("what's on my calendar today")).toBe("calendar");
    expect(fastClassify("weather today")).toBe("weather");
    expect(fastClassify("my tasks today")).toBe("task");
  });

  it("lets concrete lookup intents win over generic recent markers", () => {
    // "Latest" triggers recent AND "AAPL stock price" triggers finance — finance wins.
    expect(fastClassify("Latest AAPL stock price")).toBe("finance");
    // "Breaking news" triggers news AND "hurricane" triggers recent — news wins.
    expect(fastClassify("Breaking news about the hurricane")).toBe("news");
    expect(fastClassify("news today")).toBe("news");
    expect(fastClassify("search for Thai restaurants today")).toBe("search");
  });

  it("classifies explicit research queries as 'search'", () => {
    expect(fastClassify("search for Thai restaurants")).toBe("search");
    expect(fastClassify("why did the economy crash")).toBe("search");
    expect(fastClassify("how do I make sourdough")).toBe("search");
    expect(fastClassify("tell me about quantum computing")).toBe("search");
  });

  it("classifies news queries as 'news'", () => {
    expect(fastClassify("top headlines")).toBe("news");
    expect(fastClassify("news about AI")).toBe("news");
    expect(fastClassify("breaking news")).toBe("news");
    expect(fastClassify("what's in the news")).toBe("news");
  });

  it("classifies task queries", () => {
    expect(fastClassify("my tasks")).toBe("task");
    expect(fastClassify("what tasks do i have")).toBe("task");
    expect(fastClassify("add buy milk to my tasks")).toBe("task");
    expect(fastClassify("complete my task buy milk")).toBe("task");
    expect(fastClassify("delete my tasks")).toBe("task");
    expect(fastClassify("what do i need to do today")).toBe("task");
    expect(fastClassify("list my todo")).toBe("task");
    // Thai
    expect(fastClassify("งานของฉัน")).toBe("task");
    expect(fastClassify("รายการงาน")).toBe("task");
  });

  it("classifies reminder queries", () => {
    expect(fastClassify("remind me to call mom at 6pm")).toBe("reminder");
    expect(fastClassify("set a reminder")).toBe("reminder");
    expect(fastClassify("Open Reminders")).toBe("reminder");
    expect(fastClassify("list my reminders")).toBe("reminder");
    expect(fastClassify("what reminders do I have")).toBe("reminder");
    expect(fastClassify("show my reminders")).toBe("reminder");
    expect(fastClassify("cancel my reminders")).toBe("reminder");
    expect(fastClassify("delete my reminders")).toBe("reminder");
    // Thai
    expect(fastClassify("การแจ้งเตือนของฉัน")).toBe("reminder");
    expect(fastClassify("ตั้งการแจ้งเตือน")).toBe("reminder");
  });

  it("classifies calendar queries", () => {
    expect(fastClassify("what's on my calendar today")).toBe("calendar");
    expect(fastClassify("what's on my schedule")).toBe("calendar");
    expect(fastClassify("my calendar")).toBe("calendar");
    expect(fastClassify("schedule a meeting tomorrow")).toBe("calendar");
    expect(fastClassify("what meetings do i have")).toBe("calendar");
    expect(fastClassify("when am i free")).toBe("calendar");
    expect(fastClassify("book a call next week")).toBe("calendar");
    // Thai
    expect(fastClassify("ปฏิทินของฉัน")).toBe("calendar");
    expect(fastClassify("ตารางงาน")).toBe("calendar");
  });

  it("classifies email queries", () => {
    expect(fastClassify("send an email")).toBe("email");
    expect(fastClassify("draft an email to john")).toBe("email");
    expect(fastClassify("check my inbox")).toBe("email");
    expect(fastClassify("unread emails")).toBe("email");
    expect(fastClassify("reply to the team email")).toBe("email");
    expect(fastClassify("search my gmail")).toBe("email");
    expect(fastClassify("list my scheduled emails")).toBe("email");
    expect(fastClassify("send emails to the team")).toBe("email");
  });

  it("classifies drive queries", () => {
    expect(fastClassify("search my google drive")).toBe("drive");
    expect(fastClassify("my drive files")).toBe("drive");
    expect(fastClassify("upload this to drive")).toBe("drive");
    expect(fastClassify("get a link to the drive file")).toBe("drive");
  });

  it("classifies connect-google queries", () => {
    expect(fastClassify("connect my google account")).toBe("connect");
    expect(fastClassify("connect Google Drive")).toBe("connect");
    expect(fastClassify("link my google calendar")).toBe("connect");
    expect(fastClassify("list my connected google accounts")).toBe("connect");
    expect(fastClassify("เชื่อมต่อ Google Drive")).toBe("connect");
    expect(fastClassify("เชื่อม Google")).toBe("connect");
  });

  it("classifies weather queries", () => {
    expect(fastClassify("weather in Bangkok")).toBe("weather");
    expect(fastClassify("will it rain tomorrow")).toBe("weather");
    expect(fastClassify("temperature")).toBe("weather");
    expect(fastClassify("do i need an umbrella")).toBe("weather");
    // Thai
    expect(fastClassify("อากาศวันนี้")).toBe("weather");
    expect(fastClassify("ฝนตกไหม")).toBe("weather");
  });

  it("classifies finance queries", () => {
    expect(fastClassify("NVDA stock price")).toBe("finance");
    expect(fastClassify("bitcoin price")).toBe("finance");
    expect(fastClassify("ETH/USD")).toBe("finance");
    expect(fastClassify("100 USD to THB")).toBe("finance");
    expect(fastClassify("convert 50 GBP to JPY")).toBe("finance");
    expect(fastClassify("AAPL quote")).toBe("finance");
    // Thai
    expect(fastClassify("ราคาหุ้น AAPL")).toBe("finance");
    expect(fastClassify("ค่าเงิน USD to THB")).toBe("finance");
  });

  it("classifies memory queries", () => {
    expect(fastClassify("what do you remember about me")).toBe("memory");
    expect(fastClassify("search my memories for that")).toBe("memory");
    expect(fastClassify("remember that I like Thai food")).toBe("memory");
    expect(fastClassify("list my memories")).toBe("memory");
  });

  it("classifies list queries", () => {
    expect(fastClassify("my grocery list")).toBe("lists");
    expect(fastClassify("add milk to my shopping list")).toBe("lists");
    expect(fastClassify("packing list")).toBe("lists");
  });

  it("classifies receipt queries", () => {
    expect(fastClassify("scan this receipt")).toBe("receipts");
    expect(fastClassify("my receipts")).toBe("receipts");
    expect(fastClassify("track my expenses")).toBe("receipts");
  });

  it("classifies briefing queries", () => {
    expect(fastClassify("morning briefing")).toBe("briefing");
    expect(fastClassify("send me my daily summary")).toBe("briefing");
    expect(fastClassify("evening summary")).toBe("briefing");
  });

  it("classifies settings queries", () => {
    expect(fastClassify("/settings")).toBe("settings");
    expect(fastClassify("set my timezone to Asia/Tokyo")).toBe("settings");
    expect(fastClassify("change my language to th")).toBe("settings");
    expect(fastClassify("turn off morning briefing")).toBe("settings");
  });

  it("classifies media queries", () => {
    expect(fastClassify("read this pdf")).toBe("media");
    expect(fastClassify("summarize this image")).toBe("media");
    expect(fastClassify("transcribe this audio")).toBe("media");
    expect(fastClassify("ocr")).toBe("media");
  });

  it("classifies places queries", () => {
    expect(fastClassify("suggest places to eat")).toBe("places");
    expect(fastClassify("restaurants near me")).toBe("places");
  });

  it("classifies contacts queries", () => {
    expect(fastClassify("search my contacts")).toBe("contacts");
    expect(fastClassify("find a contact")).toBe("contacts");
  });

  it("returns undefined for ambiguous or casual messages", () => {
    expect(fastClassify("hello")).toBeUndefined();
    expect(fastClassify("what's up")).toBeUndefined();
    expect(fastClassify("ok")).toBeUndefined();
    expect(fastClassify("tell me a joke")).toBeUndefined();
    expect(fastClassify("thanks")).toBeUndefined();
    expect(fastClassify("hi, how are you?")).toBeUndefined();
  });

  it("returns undefined for genuinely compound or ambiguous queries", () => {
    // Two intents at the same priority → ambiguous.
    expect(fastClassify("my lists and memories")).toBeUndefined();
  });

  it("prefers staged-media hint when media is referenced", () => {
    expect(fastClassify("summarize this file", { hasStagedMedia: true })).toBe("media");
    expect(fastClassify("what's in this image", { hasStagedMedia: true })).toBe("media");
  });

  it("lets explicit email intent win over staged-media reference", () => {
    expect(
      fastClassify("Write an email to jamyangperenchio@gmail.com sending this image", { hasStagedMedia: true }),
    ).toBe("email");
    expect(fastClassify("send this image to my email", { hasStagedMedia: true })).toBe("email");
    expect(fastClassify("forward that file", { hasStagedMedia: true })).toBe("email");
  });
});

describe("search-first prompt rules", () => {
  it("commands search first for recent/current/live information", () => {
    expect(BASE_PERSONALITY).toMatch(/ALWAYS call web_search or news_search FIRST/i);
    expect(BASE_PERSONALITY).toMatch(/current\/recent\/live information/i);
  });

  it("commands news_search first for news/current events", () => {
    expect(BASE_PERSONALITY).toMatch(/News\/current events → ALWAYS news_search first/i);
  });

  it("commands web_search first for general research", () => {
    expect(BASE_PERSONALITY).toMatch(/General research.*ALWAYS web_search first/i);
  });
});
