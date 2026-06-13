import { describe, it, expect, vi, afterEach } from "vitest";
import { shouldFireBriefingNow } from "@/lib/llm/briefing";
import { shouldFireEveningSummaryNow } from "@/lib/llm/evening-summary";

// We freeze time so the "local time" check is deterministic.
// Bangkok is UTC+7. To simulate 07:05 BKK, we need 00:05 UTC.
function freezeUtc(utcHour: number, utcMin: number) {
  const now = new Date();
  now.setUTCHours(utcHour, utcMin, 0, 0);
  vi.setSystemTime(now);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("shouldFireBriefingNow (Bangkok UTC+7)", () => {
  it("fires when local time is within the 30-min window and never fired before", () => {
    vi.useFakeTimers();
    freezeUtc(0, 5); // 07:05 BKK
    expect(shouldFireBriefingNow("07:00", null, "Asia/Bangkok")).toBe(true);
  });

  it("fires at 07:29 local (catches a delayed 15-min cron)", () => {
    vi.useFakeTimers();
    freezeUtc(0, 29); // 07:29 BKK
    expect(shouldFireBriefingNow("07:00", null, "Asia/Bangkok")).toBe(true);
  });

  it("does not fire at 06:59 local (before window)", () => {
    vi.useFakeTimers();
    freezeUtc(23, 59); // 06:59 BKK
    expect(shouldFireBriefingNow("07:00", null, "Asia/Bangkok")).toBe(false);
  });

  it("does not fire at 07:30 local (after window)", () => {
    vi.useFakeTimers();
    freezeUtc(0, 30); // 07:30 BKK
    expect(shouldFireBriefingNow("07:00", null, "Asia/Bangkok")).toBe(false);
  });

  it("does not fire if fired within the last 12 hours", () => {
    vi.useFakeTimers();
    freezeUtc(0, 5); // 07:05 BKK — within window
    const oneHourAgo = Date.now() - 1 * 60 * 60 * 1000;
    expect(shouldFireBriefingNow("07:00", oneHourAgo, "Asia/Bangkok")).toBe(false);
  });

  it("fires if last fired more than 12 hours ago", () => {
    vi.useFakeTimers();
    freezeUtc(0, 5); // 07:05 BKK — within window
    const thirteenHoursAgo = Date.now() - 13 * 60 * 60 * 1000;
    expect(shouldFireBriefingNow("07:00", thirteenHoursAgo, "Asia/Bangkok")).toBe(true);
  });

  it("does not fire when briefingTime is null", () => {
    vi.useFakeTimers();
    freezeUtc(0, 5);
    expect(shouldFireBriefingNow(null, null, "Asia/Bangkok")).toBe(false);
  });
});

describe("shouldFireEveningSummaryNow (Bangkok UTC+7, 9 PM target)", () => {
  it("fires when local time is 21:00–21:29 and never fired before", () => {
    vi.useFakeTimers();
    freezeUtc(14, 5); // 21:05 BKK (UTC+7)
    expect(shouldFireEveningSummaryNow(null, "Asia/Bangkok")).toBe(true);
  });

  it("fires at 21:29 local (catches a delayed 15-min cron)", () => {
    vi.useFakeTimers();
    freezeUtc(14, 29); // 21:29 BKK
    expect(shouldFireEveningSummaryNow(null, "Asia/Bangkok")).toBe(true);
  });

  it("does not fire at 20:59 local (before window)", () => {
    vi.useFakeTimers();
    freezeUtc(13, 59); // 20:59 BKK
    expect(shouldFireEveningSummaryNow(null, "Asia/Bangkok")).toBe(false);
  });

  it("does not fire at 21:30 local (after window)", () => {
    vi.useFakeTimers();
    freezeUtc(14, 30); // 21:30 BKK
    expect(shouldFireEveningSummaryNow(null, "Asia/Bangkok")).toBe(false);
  });

  it("does not fire if fired within the last 12 hours", () => {
    vi.useFakeTimers();
    freezeUtc(14, 5); // 21:05 BKK
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    expect(shouldFireEveningSummaryNow(twoHoursAgo, "Asia/Bangkok")).toBe(false);
  });
});
