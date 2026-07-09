import { describe, it, expect } from "vitest";
import { classify } from "@/lib/confirm";

describe("classify", () => {
  const YES_CASES = [
    "yes", "Yes", "YES", "y", "Y", "yeah", "yep", "yup", "sure", "ok", "okay", "k", "kk", "send", "send it",
    "do it", "go", "confirm", "confirmed", "yes please", "go ahead", "yes please send it", "ok ส่งเลย",
    "ตกลง", "ตกลงครับ", "ได้", "โอเค", "ยืนยัน", "ส่งเลย", "ใช่", "เอา",
  ];
  const NO_CASES = [
    "no", "No", "NO", "n", "nope", "cancel", "stop", "abort", "nvm", "nevermind", "never mind", "ไม่",
    "ยกเลิก", "ไม่เอา", "ไม่ส่ง",
  ];
  const NEITHER_CASES = [
    "remind me tomorrow",
    "search for coffee",
    "",
    "   ",
    "maybe",
    "ok but change the time",
    "okay, but update the subject",
    "ได้ แต่ขอแก้เวลา",
    "โอเค แต่เปลี่ยนวันที่",
    "yes, but make it different",
  ];

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
