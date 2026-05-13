import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifyLineSignature } from "@/lib/line/verify";

const SECRET = "test-channel-secret";

function sign(body: string | Buffer, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("base64");
}

describe("verifyLineSignature", () => {
  it("accepts a valid signature", () => {
    const body = '{"events":[]}';
    expect(verifyLineSignature(body, sign(body, SECRET), SECRET)).toBe(true);
  });

  it("rejects null signature header", () => {
    expect(verifyLineSignature("body", null, SECRET)).toBe(false);
  });

  it("rejects wrong secret", () => {
    const body = "body";
    expect(verifyLineSignature(body, sign(body, "wrong-secret"), SECRET)).toBe(false);
  });

  it("rejects truncated signature (different length)", () => {
    const body = "body";
    const valid = sign(body, SECRET);
    expect(verifyLineSignature(body, valid.slice(0, -4), SECRET)).toBe(false);
  });

  it("rejects extended signature (different length)", () => {
    const body = "body";
    const valid = sign(body, SECRET);
    expect(verifyLineSignature(body, valid + "AAAA", SECRET)).toBe(false);
  });

  it("handles Buffer body", () => {
    const body = Buffer.from('{"events":[]}');
    const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64");
    expect(verifyLineSignature(body, sig, SECRET)).toBe(true);
  });

  it("rejects empty string signature", () => {
    expect(verifyLineSignature("body", "", SECRET)).toBe(false);
  });

  it("handles empty body correctly when expected HMAC matches", () => {
    const body = "";
    expect(verifyLineSignature(body, sign(body, SECRET), SECRET)).toBe(true);
  });
});
