import { describe, it, expect } from "vitest";
import { looksMultiStep } from "@/lib/llm/multi-step";

describe("looksMultiStep", () => {
  it("detects numbered lists", () => {
    expect(looksMultiStep("1) check weather 2) get fx rate")).toBe(true);
    expect(looksMultiStep("(1) check weather (2) get fx rate")).toBe(true);
    expect(looksMultiStep("a. check weather b. get fx rate")).toBe(true);
  });

  it("detects natural conjunctions", () => {
    expect(looksMultiStep("What's the weather in Bangkok and convert 100 USD to THB?")).toBe(true);
    expect(looksMultiStep("Please check the weather and search for AI news")).toBe(true);
    expect(looksMultiStep("Can you tell me the weather and also add a task to call mom?")).toBe(true);
    expect(looksMultiStep("Show me the weather plus the USD/THB rate")).toBe(true);
    expect(looksMultiStep("Check the weather in Bangkok\nSearch for AI news")).toBe(true);
  });

  it("detects Thai conjunctions", () => {
    expect(looksMultiStep("อากาศกรุงเทพเป็นยังไง และ แลกเงิน 100 USD เป็น THB")).toBe(true);
    expect(looksMultiStep("เช็คข่าว แล้วก็ ดูอากาศ")).toBe(true);
  });

  it("does not flag single requests", () => {
    expect(looksMultiStep("What's the weather in Bangkok?")).toBe(false);
    expect(looksMultiStep("Please search for AI news")).toBe(false);
  });

  it("does not flag casual conjunctions", () => {
    expect(looksMultiStep("How are you and your family?")).toBe(false);
    expect(looksMultiStep("I like coffee and tea")).toBe(false);
  });

  it("detects colon-delimited lists", () => {
    expect(looksMultiStep("Please: check weather, search news, add task")).toBe(true);
  });
});
