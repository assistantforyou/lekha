import { z } from "zod";
import { tool } from "ai";
import { getSettings } from "@/lib/memory/settings";
import {
  addTask,
  listTasks,
  completeTask,
  completeAllOpenTasks,
  reopenTask,
  updateTask,
  deleteTask,
} from "@/lib/memory/tasks";

function formatDueText(ts: number, timezone = "Asia/Bangkok"): string {
  const due = new Date(ts);
  const now = new Date();
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, ...opts }).format(d);

  const dueDate = fmt(due, { year: "numeric", month: "short", day: "numeric" });
  const nowDate = fmt(now, { year: "numeric", month: "short", day: "numeric" });
  if (dueDate === nowDate) return "today";

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (fmt(tomorrow, { year: "numeric", month: "short", day: "numeric" }) === dueDate) {
    return "tomorrow";
  }

  const currentYear = fmt(now, { year: "numeric" });
  const dueYear = fmt(due, { year: "numeric" });
  if (dueYear === currentYear) {
    return fmt(due, { month: "short", day: "numeric" }).toLowerCase();
  }
  return dueDate.toLowerCase();
}

async function resolveTaskId(
  userId: string,
  id: string | undefined,
  title: string | undefined,
  filter: "open" | "done" | "all" = "open",
): Promise<string | null> {
  if (id) return id;
  if (!title) return null;
  const tasks = await listTasks(userId, filter === "all" ? "all" : filter);
  const lower = title.trim().toLowerCase();
  const matches = tasks.filter((t) => t.title.toLowerCase().includes(lower));
  if (matches.length === 0) return null;
  if (matches.length > 1) {
    // Return the most recently created match
    matches.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }
  return matches[0]!.id;
}

export function buildTaskTools(userId: string) {
  return {
    add_task: tool({
      description:
        "Add a single task (a persistent open work item). Use for one-off items the user wants to track until done — distinct from reminders, which fire and disappear. Optional dueAt for soft deadlines. If the user gives a numbered or bulleted list with 2+ items, use add_tasks (plural) instead.",
      inputSchema: z.object({
        title: z.string().min(2).max(200),
        notes: z.string().max(2000).optional(),
        dueAt: z.string().optional().describe("ISO 8601 deadline. Optional."),
      }),
      execute: async ({ title, notes, dueAt }) => {
        let dueAtTs: number | undefined;
        if (dueAt) {
          if (!Number.isFinite(new Date(dueAt).getTime())) {
            return { ok: false, error: "Invalid dueAt date" };
          }
          dueAtTs = new Date(dueAt).getTime();
        }
        const t = await addTask(userId, { title, notes, dueAt: dueAtTs });
        return { ok: true, task: t };
      },
    }),

    add_tasks: tool({
      description:
        "Add multiple tasks at once from a numbered or bulleted list. Use when the user says something like 'add these tasks: 1) X 2) Y 3) Z' or lists several to-dos in one message. Each item becomes its own task.",
      inputSchema: z.object({
        items: z
          .array(
            z.object({
              title: z.string().min(2).max(200),
              notes: z.string().max(2000).optional(),
              dueAt: z.string().optional().describe("ISO 8601 deadline for this item. Optional."),
            }),
          )
          .min(2)
          .max(20),
      }),
      execute: async ({ items }) => {
        const created: Awaited<ReturnType<typeof addTask>>[] = [];
        const errors: string[] = [];
        for (const item of items) {
          let dueAtTs: number | undefined;
          if (item.dueAt) {
            if (!Number.isFinite(new Date(item.dueAt).getTime())) {
              errors.push(`Invalid dueAt for "${item.title}"`);
              continue;
            }
            dueAtTs = new Date(item.dueAt).getTime();
          }
          const t = await addTask(userId, { title: item.title, notes: item.notes, dueAt: dueAtTs });
          created.push(t);
        }
        return { ok: true, createdCount: created.length, created, errors: errors.length ? errors : undefined };
      },
    }),

    list_tasks: tool({
      description:
        "List the user's current tasks. MUST be called EVERY time the user asks about their tasks, to-do list, or anything they need to do — NEVER answer from memory or previous turns. Tasks can change between conversations. Filter: 'open' (default), 'done', or 'all'. When presenting due dates in text, use the pre-computed dueText field — NEVER output raw ISO timestamps.",
      inputSchema: z.object({
        filter: z.enum(["all", "open", "done"]).default("open"),
      }),
      execute: async ({ filter }) => {
        const settings = await getSettings(userId);
        const tasks = await listTasks(userId, filter);
        return {
          tasks: tasks.map((t) => ({
            ...t,
            dueText: t.dueAt ? formatDueText(t.dueAt, settings.timezone) : null,
          })),
        };
      },
    }),

    complete_task: tool({
      description: "Mark a task done by id or title. Use this EVERY time the user says 'done', 'finished', 'complete it', or 'mark it done' after seeing tasks. If title is provided and id is omitted, finds the first open task matching the title. NEVER just confirm in text — always call this tool.",
      inputSchema: z.object({ id: z.string().optional(), title: z.string().optional() }),
      execute: async ({ id, title }) => {
        const targetId = await resolveTaskId(userId, id, title);
        if (!targetId) return { ok: false, error: title ? `No open task matching "${title}".` : "Task not found" };
        const t = await completeTask(userId, targetId);
        return t ? { ok: true, task: t } : { ok: false, error: "Task not found" };
      },
    }),

    reopen_task: tool({
      description: "Re-open a previously-completed task by id or title. If title is provided and id is omitted, finds the first done task matching the title.",
      inputSchema: z.object({ id: z.string().optional(), title: z.string().optional() }),
      execute: async ({ id, title }) => {
        const targetId = await resolveTaskId(userId, id, title, "done");
        if (!targetId) return { ok: false, error: title ? `No completed task matching "${title}".` : "Task not found" };
        const t = await reopenTask(userId, targetId);
        return t ? { ok: true, task: t } : { ok: false, error: "Task not found" };
      },
    }),

    update_task: tool({
      description: "Edit a task's title, notes, or due date by id or title. If title is provided and id is omitted, finds the first task matching the title.",
      inputSchema: z.object({
        id: z.string().optional(),
        title: z.string().optional(),
        new_title: z.string().min(2).max(200).optional(),
        notes: z.string().max(2000).optional(),
        dueAt: z.string().optional(),
      }),
      execute: async ({ id, title, new_title, notes, dueAt }) => {
        const targetId = await resolveTaskId(userId, id, title);
        if (!targetId) return { ok: false, error: title ? `No task matching "${title}".` : "Task not found" };
        const patch: Parameters<typeof updateTask>[2] = {};
        if (new_title !== undefined) patch.title = new_title;
        if (notes !== undefined) patch.notes = notes;
        if (dueAt !== undefined) {
          if (!Number.isFinite(new Date(dueAt).getTime())) {
            return { ok: false, error: "Invalid dueAt date" };
          }
          patch.dueAt = new Date(dueAt).getTime();
        }
        const t = await updateTask(userId, targetId, patch);
        return t ? { ok: true, task: t } : { ok: false, error: "Task not found" };
      },
    }),

    complete_all_open_tasks: tool({
      description:
        "Mark EVERY currently-open task as done in one atomic call. Use when the user says 'clear all my tasks', 'mark them all done', 'all tasks done', 'wipe my open tasks', etc. Returns the list of tasks that were completed. Do NOT call list_tasks + complete_task individually for bulk clears — use this instead.",
      inputSchema: z.object({}),
      execute: async () => {
        const completed = await completeAllOpenTasks(userId);
        return { ok: true, completedCount: completed.length, completed };
      },
    }),

    delete_task: tool({
      description: "Delete a task by id or title permanently. If title is provided and id is omitted, finds the first task matching the title.",
      inputSchema: z.object({ id: z.string().optional(), title: z.string().optional() }),
      execute: async ({ id, title }) => {
        const targetId = await resolveTaskId(userId, id, title, "all");
        if (!targetId) return { ok: false, error: title ? `No task matching "${title}".` : "Task not found" };
        return { ok: await deleteTask(userId, targetId) };
      },
    }),
  };
}
