import { z } from "zod";
import { tool } from "ai";
import {
  addTask,
  listTasks,
  completeTask,
  completeAllOpenTasks,
  reopenTask,
  updateTask,
  deleteTask,
} from "@/lib/memory/tasks";

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
        "Add a task (a persistent open work item). Use for things the user wants to track until done — distinct from reminders, which fire and disappear. Optional dueAt for soft deadlines.",
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

    list_tasks: tool({
      description: "List tasks. Filter 'open' (default), 'done', or 'all'.",
      inputSchema: z.object({
        filter: z.enum(["all", "open", "done"]).default("open"),
      }),
      execute: async ({ filter }) => ({ tasks: await listTasks(userId, filter) }),
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
