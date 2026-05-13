import { describe, it, expect } from "vitest";
import { classify } from "@/lib/confirm";

describe("classify", () => {
  const YES_CASES = ["yes", "Yes", "YES", "y", "Y", "yeah", "yep", "yup", "sure", "ok", "okay", "k", "kk", "send", "send it", "do it", "go", "confirm", "confirmed"];
  const NO_CASES = ["no", "No", "NO", "n", "nope", "cancel", "stop", "abort", "nvm", "nevermind", "never mind"];
  const NEITHER_CASES = ["remind me tomorrow", "search for coffee", "", "   ", "maybe", "yes please send it"];

  for (const input of YES_CASES) {
    it(`classifies "${input}" as yes`, () => {
      expect(classify(input)).toBe("yes");
    });
  }

  for (const input of NO_CASES) {
    it(`classifies "${input}" as no`, () => {
      expect(classify(input)).toBe("no");
    });
  }

  for (const input of NEITHER_CASES) {
    it(`classifies "${input}" as neither`, () => {
      expect(classify(input)).toBe("neither");
    });
  }

  it("strips leading/trailing whitespace before matching", () => {
    expect(classify("  yes  ")).toBe("yes");
    expect(classify("  no  ")).toBe("no");
  });
});
