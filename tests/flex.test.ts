import { describe, it, expect } from "vitest";
import { confirmCancelFlex, parsePostbackData } from "@/lib/line/flex";

describe("confirmCancelFlex", () => {
  it("emits a flex message with altText derived from summary", () => {
    const msg = confirmCancelFlex("Email to mom@gmail.com: dinner at 7");
    expect(msg.type).toBe("flex");
    expect(msg.altText).toContain("Email to mom@gmail.com");
    expect(msg.altText.length).toBeLessThanOrEqual(400);
  });

  it("truncates long summaries in the body but keeps altText present", () => {
    const long = "x".repeat(5000);
    const msg = confirmCancelFlex(long);
    expect(msg.altText.length).toBeGreaterThan(0);
    const bodyText = JSON.stringify(msg.contents);
    expect(bodyText.length).toBeLessThan(4000);
  });

  it("has yes and no postback actions wired to confirm:yes / confirm:no", () => {
    const msg = confirmCancelFlex("draft");
    const json = JSON.stringify(msg.contents);
    expect(json).toContain('"data":"confirm:yes"');
    expect(json).toContain('"data":"confirm:no"');
  });

  it("supports custom labels", () => {
    const msg = confirmCancelFlex("draft", { yesLabel: "Ship it", noLabel: "Nah" });
    const json = JSON.stringify(msg.contents);
    expect(json).toContain('"label":"Ship it"');
    expect(json).toContain('"label":"Nah"');
  });
});

describe("parsePostbackData", () => {
  it("parses simple verb:arg", () => {
    expect(parsePostbackData("confirm:yes")).toEqual({ verb: "confirm", args: ["yes"] });
    expect(parsePostbackData("confirm:no")).toEqual({ verb: "confirm", args: ["no"] });
  });

  it("parses verb:arg:arg payloads", () => {
    expect(parsePostbackData("task:done:t_abc123")).toEqual({ verb: "task", args: ["done", "t_abc123"] });
    expect(parsePostbackData("reminder:cancel:r_xyz")).toEqual({ verb: "reminder", args: ["cancel", "r_xyz"] });
  });

  it("handles verb only", () => {
    expect(parsePostbackData("ping")).toEqual({ verb: "ping", args: [] });
  });

  it("empty string yields empty verb", () => {
    expect(parsePostbackData("")).toEqual({ verb: "", args: [] });
  });
});
