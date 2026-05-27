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
      description: "Mark a task done by id.",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => {
        const t = await completeTask(userId, id);
        return t ? { ok: true, task: t } : { ok: false, error: "Task not found" };
      },
    }),

    reopen_task: tool({
      description: "Re-open a previously-completed task.",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => {
        const t = await reopenTask(userId, id);
        return t ? { ok: true, task: t } : { ok: false, error: "Task not found" };
      },
    }),

    update_task: tool({
      description: "Edit a task's title, notes, or due date by id.",
      inputSchema: z.object({
        id: z.string(),
        title: z.string().min(2).max(200).optional(),
        notes: z.string().max(2000).optional(),
        dueAt: z.string().optional(),
      }),
      execute: async ({ id, title, notes, dueAt }) => {
        const patch: Parameters<typeof updateTask>[2] = {};
        if (title !== undefined) patch.title = title;
        if (notes !== undefined) patch.notes = notes;
        if (dueAt !== undefined) {
          if (!Number.isFinite(new Date(dueAt).getTime())) {
            return { ok: false, error: "Invalid dueAt date" };
          }
          patch.dueAt = new Date(dueAt).getTime();
        }
        const t = await updateTask(userId, id, patch);
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
      description: "Delete a task by id permanently.",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => ({ ok: await deleteTask(userId, id) }),
    }),
  };
}
