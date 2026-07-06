import { redis } from "@/lib/memory/redis";
import { addTask } from "@/lib/memory/tasks";
import { appendFact, type FactCategory } from "@/lib/memory/facts";
import { _resetSettingsCache } from "@/lib/memory/settings";
import { _resetFactsCache } from "@/lib/memory/facts";
import { appendTurn } from "@/lib/memory/history";
import { resetRedisMock } from "@/eval/mocks/redis";
import type { SeededState, ScenarioContext } from "@/eval/engine/types";
import type { ModelMessage } from "ai";
import type { StoredReminder } from "@/lib/tools/reminders";

export async function resetEvalState(): Promise<void> {
  resetRedisMock();
  _resetSettingsCache();
  _resetFactsCache();
}

export async function seedState(ctx: ScenarioContext, state: SeededState): Promise<void> {
  const { userId } = ctx;

  if (state.settings) {
    await _resetSettingsCache();
    const { updateSettings } = await import("@/lib/memory/settings");
    await updateSettings(userId, state.settings as Parameters<typeof updateSettings>[1]);
  }

  if (state.facts) {
    _resetFactsCache();
    for (const fact of state.facts) {
      await appendFact(userId, fact.content, {
        category: fact.category as FactCategory,
        priority: fact.priority,
      });
    }
  }

  if (state.tasks) {
    for (const task of state.tasks) {
      await addTask(userId, {
        title: task.title,
        notes: task.notes,
        dueAt: task.dueAt,
        doneAt: task.doneAt,
      });
    }
  }

  if (state.reminders) {
    for (const r of state.reminders) {
      const id = crypto.randomUUID();
      const stored: StoredReminder = {
        id,
        message: r.message,
        fireAt: r.fireAt,
        qstashId: "",
      };
      await redis().set(`reminder:${userId}:${id}`, stored, { ex: 60 * 60 * 24 * 400 });
      await redis().sadd(`reminder:${userId}:_list`, id);
    }
  }

  if (state.history) {
    for (const turn of state.history) {
      const content = typeof turn.content === "string" ? turn.content : JSON.stringify(turn.content);
      await appendTurn(userId, { role: turn.role as "user" | "assistant", content, ts: Date.now() });
    }
  }
}

export function emptyState(): SeededState {
  return {};
}

export function taskListState(titles: string[], overrides: { done?: boolean; dueAt?: number } = {}): SeededState {
  return {
    tasks: titles.map((title) => ({
      title,
      doneAt: overrides.done ? Date.now() : undefined,
      dueAt: overrides.dueAt,
    })),
  };
}

export function reminderListState(messages: string[], fireAt?: number): SeededState {
  const base = fireAt ?? Date.now() + 60_000;
  return {
    reminders: messages.map((message, i) => ({
      message,
      fireAt: base + i * 60_000,
    })),
  };
}

export function conversationHistory(turns: Array<{ role: "user" | "assistant"; text: string }>): ModelMessage[] {
  return turns.map((t) => ({ role: t.role, content: t.text }));
}
