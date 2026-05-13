import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub env() before importing crypto — crypto.ts calls env() at encrypt/decrypt time.
vi.mock("@/lib/env", () => ({
  env: () => ({ TOKEN_ENCRYPTION_KEY: "a".repeat(64) }),
}));

import { encrypt, decrypt, hmac, safeEqual } from "@/lib/memory/crypto";

describe("encrypt / decrypt", () => {
  it("round-trips ASCII", () => {
    const s = "hello world";
    expect(decrypt(encrypt(s))).toBe(s);
  });

  it("round-trips UTF-8 multi-byte (Thai)", () => {
    const s = "สวัสดี";
    expect(decrypt(encrypt(s))).toBe(s);
  });

  it("round-trips empty string", () => {
    expect(decrypt(encrypt(""))).toBe("");
  });

  it("round-trips long string (>50KB)", () => {
    const s = "x".repeat(60_000);
    expect(decrypt(encrypt(s))).toBe(s);
  });

  it("produces different ciphertexts for same plaintext (IV randomness)", () => {
    const s = "test";
    expect(encrypt(s)).not.toBe(encrypt(s));
  });

  it("rejects modified ciphertext (auth tag mismatch)", () => {
    const blob = encrypt("secret");
    const buf = Buffer.from(blob, "base64url");
    // Flip last byte of ciphertext (after 12-byte IV + 16-byte tag = offset 28+)
    buf[buf.length - 1] = (buf[buf.length - 1]! ^ 0xff) & 0xff;
    expect(() => decrypt(buf.toString("base64url"))).toThrow();
  });

  it("rejects modified IV", () => {
    const blob = encrypt("secret");
    const buf = Buffer.from(blob, "base64url");
    // Flip a byte in the IV (first 12 bytes)
    buf[0] = (buf[0]! ^ 0xff) & 0xff;
    expect(() => decrypt(buf.toString("base64url"))).toThrow();
  });

  it("rejects modified auth tag (bytes 12–27)", () => {
    const blob = encrypt("secret");
    const buf = Buffer.from(blob, "base64url");
    buf[15] = (buf[15]! ^ 0xff) & 0xff;
    expect(() => decrypt(buf.toString("base64url"))).toThrow();
  });
});

describe("hmac", () => {
  it("is deterministic", () => {
    expect(hmac("msg", "key")).toBe(hmac("msg", "key"));
  });

  it("changes when message changes", () => {
    expect(hmac("a", "key")).not.toBe(hmac("b", "key"));
  });

  it("changes when secret changes", () => {
    expect(hmac("msg", "key1")).not.toBe(hmac("msg", "key2"));
  });
});

describe("safeEqual", () => {
  it("returns true for identical strings", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
  });

  it("returns false for different strings (same length)", () => {
    expect(safeEqual("abc", "abd")).toBe(false);
  });

  it("returns false for strings of different length", () => {
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("abcd", "abc")).toBe(false);
  });

  it("returns false for empty vs non-empty", () => {
    expect(safeEqual("", "a")).toBe(false);
    expect(safeEqual("a", "")).toBe(false);
  });

  it("returns true for two empty strings", () => {
    expect(safeEqual("", "")).toBe(true);
  });
});
