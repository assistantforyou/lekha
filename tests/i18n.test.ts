import { describe, it, expect } from "vitest";
import { detectMessageLanguage, uiLang } from "@/lib/i18n";

describe("detectMessageLanguage", () => {
  it("detects Thai text", () => {
    expect(detectMessageLanguage("สวัสดี")).toBe("th");
    expect(detectMessageLanguage("hello สวัสดี")).toBe("th");
  });

  it("detects English text", () => {
    expect(detectMessageLanguage("hello")).toBe("en");
    expect(detectMessageLanguage("What are the legal grounds?")).toBe("en");
  });

  it("returns null for empty or ambiguous input", () => {
    expect(detectMessageLanguage("")).toBeNull();
    expect(detectMessageLanguage("12345")).toBeNull();
  });
});

describe("uiLang", () => {
  it("defaults to English for null/undefined/unknown", () => {
    expect(uiLang(null)).toBe("en");
    expect(uiLang(undefined)).toBe("en");
    expect(uiLang("fr")).toBe("en");
  });

  it("returns Thai only when explicitly th", () => {
    expect(uiLang("th")).toBe("th");
  });
});
