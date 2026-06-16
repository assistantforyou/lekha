import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildFinanceTools } from "@/lib/tools/finance";

async function fx(args: { from: string; to: string; amount: number }) {
  const tools = buildFinanceTools();
  const tool = tools.fx_rate as unknown as {
    execute: (input: { from: string; to: string; amount: number }, options?: object) => Promise<unknown>;
  };
  return tool.execute(args, {});
}

describe("fx_rate", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("uses exchangerate-api.com when available", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ base: "USD", date: "2026-06-14", rates: { THB: 32.55 } }),
    } as Response);

    const result = (await fx({ from: "USD", to: "THB", amount: 10 })) as Record<string, unknown>;

    expect(result).toMatchObject({
      ok: true,
      from: "USD",
      to: "THB",
      rate: 32.55,
      amount: 10,
      converted: 325.5,
      source: "exchangerate-api.com",
      asOf: "2026-06-14T00:00:00Z",
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.exchangerate-api.com/v4/latest/USD",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("falls back to Frankfurter when primary is missing the currency", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ base: "USD", date: "2026-06-14", rates: {} }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rates: { XYZ: 1.23 } }),
      } as Response);

    const result = (await fx({ from: "USD", to: "XYZ", amount: 1 })) as Record<string, unknown>;

    expect(result).toMatchObject({
      ok: true,
      rate: 1.23,
      source: "Frankfurter (ECB)",
    });
  });

  it("falls back to fawazahmed0 when earlier sources fail", async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("primary down"))
      .mockRejectedValueOnce(new Error("frankfurter down"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ usd: { thb: 32.77 } }),
      } as Response);

    const result = (await fx({ from: "USD", to: "THB", amount: 10 })) as Record<string, unknown>;

    expect(result).toMatchObject({
      ok: true,
      rate: 32.77,
      source: "fawazahmed0.com",
    });
    expect((result as Record<string, unknown>).converted).toBeCloseTo(327.7);
  });

  it("returns an error when all sources fail", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network error"));

    const result = (await fx({ from: "USD", to: "THB", amount: 1 })) as Record<string, unknown>;

    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/No rate available|network error/) });
  });
});
