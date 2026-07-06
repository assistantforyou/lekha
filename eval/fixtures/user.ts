import { DEFAULTS, type UserSettings } from "@/lib/memory/settings";
import type { FactCategory } from "@/lib/memory/facts";
import type { SeededState } from "@/eval/engine/types";

export const TEST_USER_ID = "U_eval_test_001";

export function testProfile(overrides: { displayName?: string } = {}) {
  return { displayName: overrides.displayName ?? "Eval User" };
}

export function testSettings(overrides: Partial<UserSettings> = {}): UserSettings {
  return { ...DEFAULTS, ...overrides } as UserSettings;
}

export function testFacts(): SeededState["facts"] {
  return [
    { category: "preferences", content: "likes Thai iced tea", priority: 1 },
    { category: "people", content: "mom lives in Chiang Mai" },
    { category: "work", content: "works in fintech" },
  ];
}

export function testFactsObject() {
  const now = Date.now();
  return {
    facts: (testFacts() ?? []).map((f) => ({
      id: crypto.randomUUID(),
      category: f.category as FactCategory,
      content: f.content,
      createdAt: now,
      updatedAt: now,
      priority: f.priority,
    })),
    updatedAt: now,
  };
}

export function emptyFacts() {
  return { facts: [] as never[], updatedAt: Date.now() };
}

export function testAccounts(): SeededState["accounts"] {
  return [{ email: "eval@example.com", active: true }];
}
