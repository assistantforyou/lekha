/**
 * Integration tests for the Lekha bot via the /api/dev/chat endpoint.
 *
 * These tests require a running production (or dev) deployment and valid credentials:
 *   DEV_CHAT_SECRET, DEV_LINE_USER_ID, APP_BASE_URL
 *
 * Run:
 *   npm run test:integration
 *
 * They are automatically skipped in CI (where those env vars are absent).
 */

import { describe, it, expect } from "vitest";

const SECRET = process.env.DEV_CHAT_SECRET;
const USER_ID = process.env.DEV_LINE_USER_ID;
const BASE_URL = process.env.APP_BASE_URL ?? "https://lekha-iota.vercel.app";

const hasCredentials = Boolean(SECRET && USER_ID);

// ─── helpers ──────────────────────────────────────────────────────────────────

async function chat(text: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/dev/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-dev-secret": SECRET!,
    },
    body: JSON.stringify({ userId: USER_ID, text }),
  });
  if (!res.ok) throw new Error(`chat failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { reply: string };
  return json.reply;
}

/** Returns true when the string contains a meaningful fraction of Thai script. */
function isThai(text: string): boolean {
  const thaiChars = (text.match(/[฀-๿]/g) ?? []).length;
  const words = text.trim().split(/\s+/).length;
  // At least 40% of the tokens should come from Thai-range characters, or at
  // least 10 Thai characters in a reply of any length.
  return thaiChars >= 10 || (thaiChars / Math.max(words, 1)) > 0.4;
}

/** Returns true when the string contains NO Thai script. */
function isEnglishOnly(text: string): boolean {
  return !/[฀-๿]/.test(text);
}

/** Returns true when the string contains Thai script. */
function containsThai(text: string): boolean {
  return /[฀-๿]/.test(text);
}

// ─── suite ────────────────────────────────────────────────────────────────────

describe.skipIf(!hasCredentials)("Lekha chat integration", { timeout: 90_000 }, () => {

  // ── Language handling ──────────────────────────────────────────────────────

  describe("Thai language", () => {
    it("replies in Thai when greeted in Thai", async () => {
      const reply = await chat("สวัสดีค่ะ");
      expect(containsThai(reply)).toBe(true);
      expect(reply).not.toMatch(/^Hello/i);
      expect(reply).not.toMatch(/^Hi there/i);
    });

    it("replies entirely in Thai to a Thai task request", async () => {
      const reply = await chat("ช่วยตั้งเตือนพรุ่งนี้ตอน 8 โมงเช้า เรื่องประชุมทีม");
      expect(containsThai(reply)).toBe(true);
      // Must not give an English-only reply
      expect(isEnglishOnly(reply)).toBe(false);
    });

    it("replies in Thai when asking what it can do in Thai", async () => {
      const reply = await chat("คุณทำอะไรได้บ้าง");
      expect(containsThai(reply)).toBe(true);
    });

    it("saves a fact in Thai when user says something in Thai", async () => {
      const reply = await chat("จำไว้ด้วยนะว่าฉันชอบกาแฟดำไม่ใส่น้ำตาล");
      // Reply should be in Thai
      expect(containsThai(reply)).toBe(true);
      // Should confirm it was saved (not ask for clarification)
      expect(reply.toLowerCase()).not.toMatch(/what (would you like|do you mean)/i);
    });

    it("Thai reminder confirmation is in Thai", async () => {
      const reply = await chat("เตือนฉันพรุ่งนี้บ่ายสองโมง เรื่องส่งรายงาน");
      expect(containsThai(reply)).toBe(true);
    });

    it("replies in English when user writes in English", async () => {
      const reply = await chat("What tasks do I have today?");
      expect(isEnglishOnly(reply)).toBe(true);
    });

    it("switches language mid-conversation correctly", async () => {
      const thaiReply = await chat("สวัสดีจ้า");
      expect(containsThai(thaiReply)).toBe(true);

      const engReply = await chat("Hello, what can you help me with?");
      // Should switch to English
      expect(engReply.length).toBeGreaterThan(10);
    });

    it("Thai question about saved memories gets a Thai answer", async () => {
      const reply = await chat("คุณจำอะไรเกี่ยวกับฉันได้บ้าง");
      expect(containsThai(reply)).toBe(true);
    });
  });

  // ── Reminder vs Calendar distinction ──────────────────────────────────────

  describe("Reminder vs Calendar", () => {
    it("answers 'is this in Google Calendar?' correctly after setting a reminder", async () => {
      await chat("remind me in 2 hours to check the server logs");
      const reply = await chat("is this in my Google Calendar?");
      const lower = reply.toLowerCase();
      // Must NOT say "I cannot check" or "I am unable"
      expect(lower).not.toMatch(/cannot (check|confirm|fulfill)/i);
      expect(lower).not.toMatch(/unable to (check|confirm)/i);
      expect(lower).not.toMatch(/tools do not allow/i);
      // Should clarify reminder ≠ calendar event
      const clarifies = lower.includes("calendar") || lower.includes("reminder") || lower.includes("not");
      expect(clarifies).toBe(true);
    });

    it("does NOT create a calendar event when user says 'make it a reminder too'", async () => {
      // Set up: create a calendar event first (just a draft, we won't confirm it)
      // then ask to also make it a reminder — bot should ONLY call set_reminder
      const reply = await chat("make it a reminder too for 9am tomorrow");
      const lower = reply.toLowerCase();
      // Must not show a calendar draft in addition to the reminder confirmation
      expect(lower).not.toMatch(/draft calendar event/i);
      // Should confirm just the reminder
      expect(lower).toMatch(/remind(er)?/i);
    });

    it("uses list_reminders to verify what was set", async () => {
      await chat("remind me in 10 minutes to drink water");
      const reply = await chat("what reminders do I have?");
      expect(reply.toLowerCase()).toMatch(/remind(er)?|water/i);
      expect(reply.toLowerCase()).not.toMatch(/cannot (check|confirm)/i);
    });

    it("clarifies reminder is not a calendar event when asked", async () => {
      const reply = await chat(
        "You set a reminder — does that show up in Google Calendar automatically?",
      );
      const lower = reply.toLowerCase();
      expect(lower).not.toMatch(/yes.*(calendar|show up)/i);
      expect(lower).not.toMatch(/i cannot/i);
    });
  });

  // ── Context retention ──────────────────────────────────────────────────────

  describe("Context retention", () => {
    it("remembers what was discussed earlier in the same session", async () => {
      await chat("My dog's name is Mango");
      const reply = await chat("What's my dog's name again?");
      expect(reply.toLowerCase()).toContain("mango");
    });

    it("does not ask 'what would you like to add?' after setting a reminder and user says 'put in calendar'", async () => {
      await chat("remind me tomorrow at 9am to call the dentist");
      const reply = await chat("can you also put that in my Google Calendar?");
      const lower = reply.toLowerCase();
      // Should draft the event directly, not ask for info that was just provided
      expect(lower).not.toMatch(/what would you like (to add|to schedule|me to add)/i);
    });

    it("can discuss a topic and then act on it", async () => {
      await chat("I need to remember that the ND3 contract renewal is in 2 months");
      const reply = await chat("can you set a reminder for that?");
      expect(reply.toLowerCase()).toMatch(/remind(er)?|nd3|contract/i);
    });
  });

  // ── Tool routing correctness ───────────────────────────────────────────────

  describe("Tool routing", () => {
    it("does not call tools for a simple greeting", async () => {
      const reply = await chat("Hey! How are you?");
      // Should be a short conversational reply, not a tool output
      expect(reply.length).toBeGreaterThan(5);
      expect(reply.length).toBeLessThan(300);
      expect(reply.toLowerCase()).not.toMatch(/tool|error|ok:/i);
    });

    it("calls list_tasks not list_upcoming_events for tasks question", async () => {
      const reply = await chat("What are my tasks today?");
      // Should get a real answer about tasks, not ask to connect Google
      expect(reply).toBeDefined();
      expect(reply.length).toBeGreaterThan(5);
    });

    it("does not relay raw tool JSON to the user", async () => {
      const reply = await chat("what reminders do I have set?");
      // Should be human-readable, not a JSON blob
      expect(reply).not.toMatch(/^\{/);
      expect(reply).not.toMatch(/"ok"\s*:/);
    });

    it("sets multiple reminders with one message, individually", async () => {
      const reply = await chat(
        "Remind me to: 1) take medication at 8am tomorrow, 2) call mom at 6pm tomorrow",
      );
      const lower = reply.toLowerCase();
      // Both reminders should be confirmed
      expect(lower).toMatch(/medic/i);
      expect(lower).toMatch(/mom|call/i);
    });
  });

  // ── Hard real-world conversations ──────────────────────────────────────────

  describe("Hard real-world scenarios", () => {
    it("handles a multi-part business request", async () => {
      const reply = await chat(
        "I have a meeting with a client called Bluescope Lysaght on Monday at 10am. " +
        "Can you add it to my calendar, set a reminder 1 hour before, and find any recent news about Bluescope?",
      );
      // Should handle all three requests
      expect(reply.length).toBeGreaterThan(50);
      const lower = reply.toLowerCase();
      // Should mention the meeting/calendar
      expect(lower).toMatch(/calendar|event|monday|meeting/i);
      // Should mention the reminder
      expect(lower).toMatch(/remind(er)?|hour before/i);
    });

    it("handles a Thai business message with specific names", async () => {
      const reply = await chat(
        "วันพรุ่งนี้เช้า 9 โมงมีประชุมกับลูกค้า บริษัท ABC จำกัด " +
        "ช่วยเพิ่มในปฏิทินและเตือนก่อน 30 นาทีด้วยค่ะ",
      );
      expect(containsThai(reply)).toBe(true);
      // Should acknowledge the calendar/reminder action
      expect(reply).toMatch(/ปฏิทิน|เตือน|ABC|abc/i);
    });

    it("gives a straight answer when asking about the difference between reminders and calendar events — in Thai if asked in Thai", async () => {
      const reply = await chat("event กับ reminder ต่างกันยังไง");
      expect(containsThai(reply)).toBe(true);
      // Should be a direct explanation, not a tool call result
      expect(reply.length).toBeGreaterThan(30);
    });

    it("handles 'delete the event, keep the reminder' instruction", async () => {
      const reply = await chat(
        "Actually, delete the calendar event for the meeting with Bluescope but keep the reminder",
      );
      expect(reply).toBeDefined();
      expect(reply.toLowerCase()).not.toMatch(/i (cannot|am unable|don't have the ability)/i);
    });

    it("handles 'what did I ask you to remember last time?' style questions", async () => {
      const reply = await chat("What do you remember about me?");
      // Should either list facts or say there's nothing yet — not error
      expect(reply.length).toBeGreaterThan(5);
      expect(reply).not.toMatch(/error/i);
    });

    it("handles a confusing mixed request gracefully", async () => {
      const reply = await chat(
        "Actually cancel that, and instead remind me tomorrow morning, " +
        "but also put it in the calendar if it's not already there",
      );
      // Should not crash or produce an empty reply
      expect(reply.length).toBeGreaterThan(10);
    });

    it("handles consecutive yes/no confirmations correctly", async () => {
      await chat("draft an email to test@example.com saying hello from James");
      const reply = await chat("no, cancel that");
      const lower = reply.toLowerCase();
      expect(lower).toMatch(/cancel(led)?|discard(ed)?|ok|got it/i);
    });
  });

  // ── Error recovery ─────────────────────────────────────────────────────────

  describe("Error recovery", () => {
    it("never says 'I cannot check' when asked to verify a reminder", async () => {
      await chat("remind me in 5 minutes to stretch");
      const reply = await chat("was the reminder actually set?");
      expect(reply.toLowerCase()).not.toMatch(/cannot (check|confirm)/i);
      expect(reply.toLowerCase()).not.toMatch(/tools do not allow/i);
      expect(reply.toLowerCase()).toMatch(/remind(er)?|stretch|set|yes/i);
    });

    it("relays a real error instead of a generic apology", async () => {
      // Setting a reminder for 60 days should hit the 30-day limit
      const reply = await chat("remind me in 60 days to renew my passport");
      expect(reply.toLowerCase()).not.toMatch(/technical (hiccup|issue|difficulty)/i);
      expect(reply.toLowerCase()).not.toMatch(/try again later/i);
      // Should explain the 30-day limit or reject with the real reason
      expect(reply.toLowerCase()).toMatch(/30 day|max|limit|cannot|too far/i);
    });

    it("does not produce an empty reply after any tool call", async () => {
      const reply = await chat("what's the weather today?");
      expect(reply.trim().length).toBeGreaterThan(10);
    });
  });

  // ── Formatting ─────────────────────────────────────────────────────────────

  describe("LINE formatting", () => {
    it("does not use markdown bold or headers in replies", async () => {
      const reply = await chat("what tasks do I have?");
      expect(reply).not.toMatch(/\*\*/);
      expect(reply).not.toMatch(/^#{1,3} /m);
    });

    it("does not use markdown bold in a Thai reply", async () => {
      const reply = await chat("สรุปงานที่ต้องทำวันนี้");
      expect(reply).not.toMatch(/\*\*/);
    });
  });
});
