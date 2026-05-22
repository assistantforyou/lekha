import { describe, it, expect } from "vitest";
import { estimateTokens, type StoredTurn } from "@/lib/memory/history";

const t = (s: string): StoredTurn => ({ role: "user", content: s, ts: 0 });

describe("estimateTokens", () => {
  it("returns 0-ish for empty input", () => {
    expect(estimateTokens([])).toBe(0);
  });

  it("grows with content length", () => {
    const small = estimateTokens([t("hi"), t("hello")]);
    const big = estimateTokens([t("x".repeat(4000))]);
    expect(big).toBeGreaterThan(small);
    // 4000 chars / 4 ≈ 1000 plus role overhead
    expect(big).toBeGreaterThan(900);
  });

  it("triggers the 3K cap around the right size", () => {
    const turns = Array.from({ length: 12 }, () => t("x".repeat(1000)));
    // 12 * 1000 chars / 4 = 3000 tokens — should be near the cap
    expect(estimateTokens(turns)).toBeGreaterThanOrEqual(3000);
  });
});
