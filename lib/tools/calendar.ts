import { z } from "zod";
import { tool } from "ai";
import { google } from "googleapis";
import { getGoogleClient } from "./google-auth";
import { withGoogleClient, guardGoogleApiCall } from "./with-google";
import { appendPending, type CreateCalendarEventAction } from "@/lib/confirm";
import { getSettings } from "@/lib/memory/settings";
import { schedulePreMeetingAlerts } from "@/lib/proactive-schedules";

const CAL_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const CAL_READ_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

function brief(e: {
  summary?: string | null;
  start?: { dateTime?: string | null; date?: string | null } | null;
  end?: { dateTime?: string | null; date?: string | null } | null;
  location?: string | null;
  attendees?: { email?: string | null }[] | null;
}) {
  return {
    summary: e.summary ?? "(no title)",
    start: e.start?.dateTime ?? e.start?.date ?? "",
    end: e.end?.dateTime ?? e.end?.date ?? "",
    location: e.location ?? null,
    attendees: e.attendees?.map((a) => a.email ?? "").filter(Boolean) ?? [],
  };
}

function briefWithId(e: {
  id?: string | null;
  summary?: string | null;
  start?: { dateTime?: string | null; date?: string | null } | null;
  end?: { dateTime?: string | null; date?: string | null } | null;
  location?: string | null;
  attendees?: { email?: string | null }[] | null;
  htmlLink?: string | null;
}) {
  return {
    id: e.id ?? "",
    summary: e.summary ?? "(no title)",
    start: e.start?.dateTime ?? e.start?.date ?? "",
    end: e.end?.dateTime ?? e.end?.date ?? "",
    location: e.location ?? null,
    attendees: e.attendees?.map((a) => a.email ?? "").filter(Boolean) ?? [],
    htmlLink: e.htmlLink ?? null,
  };
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function buildCalendarTools(userId: string) {
  return {
    draft_calendar_event: tool({
      description:
        "Draft a Google Calendar event on the user's primary calendar. Does NOT create it — stores a draft and the user must reply YES. The system will render the verbatim draft to the user; don't paraphrase. Before calling this, use search_calendar_events to check for duplicate events with the same or similar title on that day — if a duplicate exists, tell the user and offer to update it instead.",
      inputSchema: z.object({
        summary: z.string().min(1).max(200).describe("Event title"),
        startISO: z.string().describe("ISO 8601 start datetime"),
        endISO: z.string().describe("ISO 8601 end datetime"),
        description: z.string().max(2000).optional(),
        attendees: z.array(z.string().email()).max(20).optional(),
        location: z.string().max(200).optional(),
        fromEmail: z
          .string()
          .email()
          .optional()
          .describe("Which connected Google account's calendar to add to. Omit for active."),
      }),
      execute: async ({ summary, startISO, endISO, description, attendees, location, fromEmail }) => {
        const action: CreateCalendarEventAction = {
          kind: "create_calendar_event",
          summary,
          startISO,
          endISO,
          description,
          attendees,
          location,
          fromEmail,
        };
        await appendPending(userId, action);
        return {
          status: "draft_pending_confirmation" as const,
          draft: { summary, startISO, endISO, description, attendees, location, fromEmail },
        };
      },
    }),

    search_calendar_events: tool({
      description:
        "Search the user's Google Calendar by keyword/title across any date range. Use before creating an event to check for duplicates (search by title), or when the user references an event by name and you need its ID for update/delete.",
      inputSchema: z.object({
        query: z.string().min(1).max(200).describe("Text to search for in event title, description, or location"),
        startISO: z.string().optional().describe("Search from this date (ISO 8601). Defaults to now."),
        endISO: z.string().optional().describe("Search until this date (ISO 8601). Defaults to 30 days from now."),
        maxResults: z.number().int().min(1).max(20).default(10),
        fromEmail: z.string().email().optional(),
      }),
      execute: async ({ query, startISO, endISO, maxResults, fromEmail }) => {
        return withGoogleClient(userId, fromEmail, [CAL_READ_SCOPE], async ({ client }) => {
          const calendar = google.calendar({ version: "v3", auth: client });
          const timeMin = startISO ?? new Date().toISOString();
          const timeMax = endISO ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          const r = await calendar.events.list({
            calendarId: "primary",
            q: query,
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: "startTime",
            maxResults,
          });
          return {
            ok: true as const,
            events: r.data.items?.map(briefWithId) ?? [],
          };
        });
      },
    }),

    update_calendar_event: tool({
      description:
        "Update an existing Google Calendar event — rename it, change the time, location, description, or attendees. Provide only the fields you want to change. Call search_calendar_events first if you need the event ID. Changes are applied immediately.",
      inputSchema: z.object({
        eventId: z.string().min(1).describe("Google Calendar event ID (from search_calendar_events or list_upcoming_events)"),
        summary: z.string().min(1).max(200).optional().describe("New event title"),
        startISO: z.string().optional().describe("New start datetime (ISO 8601 with timezone)"),
        endISO: z.string().optional().describe("New end datetime (ISO 8601 with timezone)"),
        description: z.string().max(2000).optional().describe("New description (replaces existing)"),
        location: z.string().max(200).optional().describe("New location"),
        attendees: z.array(z.string().email()).max(20).optional().describe("Full replacement attendee list (emails)"),
        fromEmail: z.string().email().optional(),
      }),
      execute: async ({ eventId, summary, startISO, endISO, description, location, attendees, fromEmail }) => {
        return withGoogleClient(userId, fromEmail, [CAL_SCOPE], async ({ client }) => {
          const calendar = google.calendar({ version: "v3", auth: client });
          const patch: Record<string, unknown> = {};
          if (summary !== undefined) patch.summary = summary;
          if (startISO !== undefined) patch.start = { dateTime: startISO };
          if (endISO !== undefined) patch.end = { dateTime: endISO };
          if (description !== undefined) patch.description = description;
          if (location !== undefined) patch.location = location;
          if (attendees !== undefined) patch.attendees = attendees.map((email) => ({ email }));
          const r = await calendar.events.patch({
            calendarId: "primary",
            eventId,
            requestBody: patch,
            sendUpdates: attendees !== undefined ? "all" : "none",
          });
          return {
            ok: true as const,
            updated: {
              id: r.data.id ?? eventId,
              summary: r.data.summary ?? "",
              start: r.data.start?.dateTime ?? r.data.start?.date ?? "",
              end: r.data.end?.dateTime ?? r.data.end?.date ?? "",
              location: r.data.location ?? null,
              htmlLink: r.data.htmlLink ?? null,
            },
          };
        });
      },
    }),

    delete_calendar_event: tool({
      description:
        "Permanently delete a Google Calendar event. Call search_calendar_events or list_upcoming_events first to get the event ID. If multiple events match the user's description, list them and ask which one before deleting. Deletion is immediate and cannot be undone.",
      inputSchema: z.object({
        eventId: z.string().min(1).describe("The Google Calendar event ID"),
        fromEmail: z.string().email().optional(),
      }),
      execute: async ({ eventId, fromEmail }) => {
        return withGoogleClient(userId, fromEmail, [CAL_SCOPE], async ({ client }) => {
          const calendar = google.calendar({ version: "v3", auth: client });
          await calendar.events.delete({ calendarId: "primary", eventId });
          return { ok: true as const };
        });
      },
    }),

    list_upcoming_events: tool({
      description: "List the next few events on the user's primary calendar.",
      inputSchema: z.object({
        days: z.number().min(1).max(30).default(7),
        fromEmail: z.string().email().optional(),
      }),
      execute: async ({ days, fromEmail }) => {
        return withGoogleClient(userId, fromEmail, [CAL_READ_SCOPE], async ({ client }) => {
          const calendar = google.calendar({ version: "v3", auth: client });
          const now = new Date();
          const max = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
          const r = await calendar.events.list({
            calendarId: "primary",
            timeMin: now.toISOString(),
            timeMax: max.toISOString(),
            singleEvents: true,
            orderBy: "startTime",
            maxResults: 10,
          });
          return {
            ok: true as const,
            events:
              r.data.items?.map((e) => ({
                id: e.id ?? "",
                summary: e.summary ?? "(no title)",
                start: e.start?.dateTime ?? e.start?.date ?? "",
                end: e.end?.dateTime ?? e.end?.date ?? "",
                location: e.location ?? null,
                htmlLink: e.htmlLink ?? null,
              })) ?? [],
          };
        });
      },
    }),

    calendar_today: tool({
      description: "Quick today-view of the user's calendar — every event today with start/end times.",
      inputSchema: z.object({ fromEmail: z.string().email().optional() }),
      execute: async ({ fromEmail }) => {
        return withGoogleClient(userId, fromEmail, [CAL_READ_SCOPE], async ({ client }) => {
          const calendar = google.calendar({ version: "v3", auth: client });
          const start = new Date(); start.setHours(0, 0, 0, 0);
          const end = new Date();   end.setHours(23, 59, 59, 999);
          const r = await calendar.events.list({
            calendarId: "primary",
            timeMin: start.toISOString(),
            timeMax: end.toISOString(),
            singleEvents: true,
            orderBy: "startTime",
            maxResults: 25,
          });
          return {
            ok: true as const,
            events: r.data.items?.map(briefWithId) ?? [],
          };
        });
      },
    }),

    calendar_week: tool({
      description: "Week-view of upcoming calendar events (next 7 days). Use for 'what's my week look like' / 'organize my calendar' questions.",
      inputSchema: z.object({ fromEmail: z.string().email().optional() }),
      execute: async ({ fromEmail }) => {
        return withGoogleClient(userId, fromEmail, [CAL_READ_SCOPE], async ({ client }) => {
          const calendar = google.calendar({ version: "v3", auth: client });
          const start = new Date();
          const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
          const r = await calendar.events.list({
            calendarId: "primary",
            timeMin: start.toISOString(),
            timeMax: end.toISOString(),
            singleEvents: true,
            orderBy: "startTime",
            maxResults: 50,
          });
          return {
            ok: true as const,
            events: r.data.items?.map(briefWithId) ?? [],
          };
        });
      },
    }),

    calendar_find_free_time: tool({
      description: "Find free time slots on the user's calendar within a date range. Use for 'when am I free' / 'find me 1h slots tomorrow' / scheduling negotiations.",
      inputSchema: z.object({
        startISO: z.string().describe("Window start (ISO 8601)"),
        endISO: z.string().describe("Window end (ISO 8601)"),
        slotMinutes: z.number().int().min(15).max(480).default(30).describe("Required slot duration in minutes"),
        workdayStartHour: z.number().int().min(0).max(23).default(9),
        workdayEndHour: z.number().int().min(1).max(24).default(18),
        fromEmail: z.string().email().optional(),
      }),
      execute: async ({ startISO, endISO, slotMinutes, workdayStartHour, workdayEndHour, fromEmail }) => {
        return withGoogleClient(userId, fromEmail, [CAL_READ_SCOPE], async ({ client }) => {
          const calendar = google.calendar({ version: "v3", auth: client });
          const r = await calendar.freebusy.query({
            requestBody: {
              timeMin: startISO,
              timeMax: endISO,
              items: [{ id: "primary" }],
            },
          });
          const busy = (r.data.calendars?.primary?.busy ?? []).map((b) => ({
            start: new Date(b.start ?? "").getTime(),
            end: new Date(b.end ?? "").getTime(),
          }));
          const slots: { startISO: string; endISO: string; minutes: number }[] = [];
          const winStart = new Date(startISO).getTime();
          const winEnd = new Date(endISO).getTime();
          for (let dayStart = startOfDay(winStart); dayStart < winEnd; dayStart += 24 * 60 * 60 * 1000) {
            const day = new Date(dayStart);
            const wStart = new Date(day); wStart.setHours(workdayStartHour, 0, 0, 0);
            const wEnd = new Date(day); wEnd.setHours(workdayEndHour, 0, 0, 0);
            let cursor = Math.max(winStart, wStart.getTime());
            const dayEnd = Math.min(winEnd, wEnd.getTime());
            const busyToday = busy
              .filter((b) => b.end > cursor && b.start < dayEnd)
              .sort((a, b) => a.start - b.start);
            for (const b of busyToday) {
              if (b.start - cursor >= slotMinutes * 60_000) {
                slots.push({
                  startISO: new Date(cursor).toISOString(),
                  endISO: new Date(b.start).toISOString(),
                  minutes: Math.round((b.start - cursor) / 60_000),
                });
              }
              cursor = Math.max(cursor, b.end);
            }
            if (dayEnd - cursor >= slotMinutes * 60_000) {
              slots.push({
                startISO: new Date(cursor).toISOString(),
                endISO: new Date(dayEnd).toISOString(),
                minutes: Math.round((dayEnd - cursor) / 60_000),
              });
            }
          }
          return { ok: true as const, slots: slots.slice(0, 20) };
        });
      },
    }),
  };
}

/** Actually create a previously-confirmed calendar event. */
export async function createCalendarEvent(
  userId: string,
  args: {
    summary: string;
    startISO: string;
    endISO: string;
    description?: string;
    attendees?: string[];
    location?: string;
    fromEmail?: string;
  },
): Promise<{ htmlLink: string | null; from: string; eventId: string }> {
  const { client, email: from } = await getGoogleClient(userId, args.fromEmail);
  const calendar = google.calendar({ version: "v3", auth: client });
  return guardGoogleApiCall(async () => {
    const r = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: args.summary,
        description: args.description,
        location: args.location,
        start: { dateTime: args.startISO },
        end: { dateTime: args.endISO },
        attendees: args.attendees?.map((email) => ({ email })),
      },
      sendUpdates: args.attendees?.length ? "all" : "none",
    });
    const eventId = r.data.id ?? "";
    if (eventId) {
      const settings = await getSettings(userId);
      if (settings.preMeetingLeads.length > 0) {
        await schedulePreMeetingAlerts(
          userId,
          eventId,
          args.startISO,
          settings.preMeetingLeads,
        );
      }
    }
    return { htmlLink: r.data.htmlLink ?? null, from, eventId };
  });
}
