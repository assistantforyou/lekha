import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "@/lib/llm/prompts";

describe("buildSystemPrompt name resolution", () => {
  it("uses LINE display name when no preferred name is set", () => {
    const prompt = buildSystemPrompt("", { displayName: "LINE James" }, { personaPreferredName: null });
    expect(prompt).toContain('The user\'s LINE display name is "LINE James".');
    expect(prompt).not.toContain("preferred name");
  });

  it("uses preferred name when set and different from LINE name", () => {
    const prompt = buildSystemPrompt("", { displayName: "LINE James" }, { personaPreferredName: "Jimmy" });
    expect(prompt).toContain('The user\'s preferred name is "Jimmy"');
    expect(prompt).toContain('LINE display name: "LINE James"');
  });

  it("falls back to LINE name when preferred name is empty string", () => {
    const prompt = buildSystemPrompt("", { displayName: "LINE James" }, { personaPreferredName: "" });
    expect(prompt).toContain('The user\'s LINE display name is "LINE James".');
  });

  it("uses preferred name even when it matches LINE name", () => {
    const prompt = buildSystemPrompt("", { displayName: "James" }, { personaPreferredName: "James" });
    expect(prompt).toContain('The user\'s LINE display name is "James".');
  });
});
