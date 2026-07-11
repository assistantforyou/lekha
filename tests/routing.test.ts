import { describe, it, expect } from "vitest";
import { BASE_PERSONALITY } from "@/lib/llm/prompts";
import { isTaskQuery, isReminderQuery, isCalendarQuery } from "@/lib/shortcuts";

describe("prompt routing rules", () => {
  it("does not tell the model to lean toward searching for every question", () => {
    expect(BASE_PERSONALITY).not.toMatch(/lean toward searching/i);
    expect(BASE_PERSONALITY).not.toMatch(/when in doubt, search/i);
  });

  it("restricts news_search to news/current events", () => {
    expect(BASE_PERSONALITY).toMatch(/news_search/i);
    expect(BASE_PERSONALITY).toMatch(/current events/i);
  });

  it("tells web_search to handle general research, not news", () => {
    expect(BASE_PERSONALITY).toMatch(/web_search/i);
    expect(BASE_PERSONALITY).toMatch(/general research/i);
  });

  it("warns against searching for casual chat / emoji / test messages", () => {
    expect(BASE_PERSONALITY).toMatch(/emoji requests/i);
    expect(BASE_PERSONALITY).toMatch(/test,/i);
    expect(BASE_PERSONALITY).toMatch(/casual chat/i);
  });

  it("requires search results to come only from the tool response", () => {
    expect(BASE_PERSONALITY).toMatch(/Only report what a tool returned/i);
    expect(BASE_PERSONALITY).toMatch(/don't invent headlines or facts/i);
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
    expect(isTaskQuery("what do i have to do today")).toBe(true);
    expect(isTaskQuery("What do i have to do today")).toBe(true);
  });

  it("matches reminder list queries and rejects add/set intents", () => {
    expect(isReminderQuery("Open Reminders")).toBe(true);
    expect(isReminderQuery("my reminders")).toBe(true);
    expect(isReminderQuery("list my reminders")).toBe(true);
    expect(isReminderQuery("what reminders do i have")).toBe(true);
    expect(isReminderQuery("show my reminders")).toBe(true);
    expect(isReminderQuery("add a reminder")).toBe(false);
    expect(isReminderQuery("set reminder call mom")).toBe(false);
  });

  it("matches calendar today queries and rejects add/schedule intents", () => {
    expect(isCalendarQuery("what's on my calendar today")).toBe(true);
    expect(isCalendarQuery("what's on my calendar")).toBe(true);
    expect(isCalendarQuery("my calendar today")).toBe(true);
    expect(isCalendarQuery("my schedule")).toBe(true);
    expect(isCalendarQuery("anything on my calendar today")).toBe(true);
    expect(isCalendarQuery("add to my calendar")).toBe(false);
    expect(isCalendarQuery("schedule a meeting tomorrow")).toBe(false);
  });
});
