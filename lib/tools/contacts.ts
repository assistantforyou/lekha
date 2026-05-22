import { z } from "zod";
import { tool } from "ai";
import { google } from "googleapis";
import { withGoogleClient } from "./with-google";

/**
 * Contacts tools backed by the Google People API.
 *
 * Required OAuth scopes:
 *   - contacts (read+write) for create/list
 *   - contacts.readonly + contacts.other.readonly for search across both
 *     the user's personal directory and "Other contacts" (people they've
 *     emailed but not added).
 *
 * Requires the "People API" to be enabled in the user's Google Cloud project.
 */
const WRITE_SCOPES = ["https://www.googleapis.com/auth/contacts"];
const READ_SCOPES = [
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/contacts.other.readonly",
];

export function buildContactsTools(userId: string) {
  return {
    contacts_search: tool({
      description:
        "Search the user's Google Contacts (and Other Contacts they've emailed) by name or email. Use this BEFORE asking the user for someone's email if they refer to a person by name (mom, Bob, John, etc.).",
      inputSchema: z.object({
        query: z.string().min(1).max(120),
        fromEmail: z.string().email().optional(),
      }),
      execute: async ({ query, fromEmail }) =>
        withGoogleClient(userId, fromEmail, READ_SCOPES, async ({ client }) => {
          const people = google.people({ version: "v1", auth: client });
          const [personal, other] = await Promise.all([
            people.people.searchContacts({
              query,
              pageSize: 10,
              readMask: "names,emailAddresses,phoneNumbers",
            }).catch(() => ({ data: { results: [] } })),
            people.otherContacts.search({
              query,
              pageSize: 10,
              readMask: "names,emailAddresses",
            }).catch(() => ({ data: { results: [] } })),
          ]);
          const out = [
            ...(personal.data.results ?? []).map((r) => formatPerson(r.person, "personal")),
            ...(other.data.results ?? []).map((r) => formatPerson(r.person, "other")),
          ].filter(Boolean);
          return { ok: true as const, results: out };
        }),
    }),

    contacts_remember: tool({
      description:
        "Create a new contact in the user's Google Contacts. Use when the user says things like 'remember my mom's email is mom@gmail.com' or 'add Bob: bob@example.com'. Stores name + email (and optionally phone) durably in Google People — survives any local memory wipe.",
      inputSchema: z.object({
        name: z.string().min(1).max(120),
        email: z.string().email().optional(),
        phone: z.string().min(3).max(40).optional(),
        relation: z
          .string()
          .max(80)
          .optional()
          .describe("e.g. 'mom', 'brother Bob', 'work — Acme'"),
        fromEmail: z.string().email().optional(),
      }),
      execute: async ({ name, email, phone, relation, fromEmail }) => {
        if (!email && !phone) {
          return { ok: false as const, error: "Need at least an email or a phone number to create a contact." };
        }
        return withGoogleClient(userId, fromEmail, WRITE_SCOPES, async ({ client }) => {
          const people = google.people({ version: "v1", auth: client });
          const body: {
            names: Array<{ givenName: string }>;
            emailAddresses?: Array<{ value: string }>;
            phoneNumbers?: Array<{ value: string }>;
            biographies?: Array<{ value: string; contentType: "TEXT_PLAIN" }>;
          } = { names: [{ givenName: name }] };
          if (email) body.emailAddresses = [{ value: email }];
          if (phone) body.phoneNumbers = [{ value: phone }];
          if (relation) body.biographies = [{ value: relation, contentType: "TEXT_PLAIN" }];
          const r = await people.people.createContact({ requestBody: body });
          return {
            ok: true as const,
            resourceName: r.data.resourceName ?? null,
            name,
            email: email ?? null,
            phone: phone ?? null,
          };
        });
      },
    }),
  };
}

type PersonShape = {
  names?: Array<{ displayName?: string | null }> | null;
  emailAddresses?: Array<{ value?: string | null }> | null;
  phoneNumbers?: Array<{ value?: string | null }> | null;
} | undefined;

function formatPerson(p: PersonShape, source: "personal" | "other") {
  if (!p) return null;
  const name = p.names?.[0]?.displayName ?? "";
  const email = p.emailAddresses?.[0]?.value ?? null;
  const phone = p.phoneNumbers?.[0]?.value ?? null;
  if (!email && !phone && !name) return null;
  return { name, email, phone, source };
}
