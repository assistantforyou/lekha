import { z } from "zod";
import { tool } from "ai";
import { google } from "googleapis";
import { Readable } from "node:stream";
import { withGoogleClient } from "./with-google";
import { listRecentMedia, clearRecentMedia } from "@/lib/memory/recent-media";
import { getMessageContent } from "@/lib/line/client";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

type DriveFileLite = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string | null;
  owners: string[];
};

function defaultDriveName(kind: "image" | "video" | "audio" | "file", mime: string): string {
  const m = mime.toLowerCase();
  const ext =
    m === "image/jpeg" || m === "image/jpg" ? ".jpg"
    : m === "image/png" ? ".png"
    : m === "image/gif" ? ".gif"
    : m === "image/webp" ? ".webp"
    : m === "video/mp4" ? ".mp4"
    : m === "video/quicktime" ? ".mov"
    : m === "audio/m4a" || m === "audio/x-m4a" || m === "audio/mp4" ? ".m4a"
    : m === "audio/mpeg" || m === "audio/mp3" ? ".mp3"
    : m === "application/pdf" ? ".pdf"
    : "";
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  return `${kind}-${stamp}${ext}`;
}

function summarize(file: {
  id?: string | null;
  name?: string | null;
  mimeType?: string | null;
  modifiedTime?: string | null;
  webViewLink?: string | null;
  owners?: { displayName?: string | null; emailAddress?: string | null }[] | null;
}): DriveFileLite {
  return {
    id: file.id ?? "",
    name: file.name ?? "(unnamed)",
    mimeType: file.mimeType ?? "",
    modifiedTime: file.modifiedTime ?? "",
    webViewLink: file.webViewLink ?? null,
    owners:
      file.owners?.map((o) => o.emailAddress ?? o.displayName ?? "?").filter(Boolean) ?? [],
  };
}

export function buildDriveTools(userId: string) {
  return {
    drive_create_folder: tool({
      description:
        "Create a new folder in the user's Google Drive. Returns the folder's id — pass it as folderId to drive_upload_recent_media to upload into it. If a folder with the same name already exists under the same parent, reuses it instead of creating a duplicate. Use this BEFORE drive_upload_recent_media when the user asks to upload into a NEW/named folder (e.g. 'create a folder called X and put it there').",
      inputSchema: z.object({
        name: z.string().min(1).max(200),
        parentId: z.string().optional().describe("Parent Drive folder id to nest inside. Omit for Drive root."),
        fromEmail: z.string().email().optional(),
      }),
      execute: async ({ name, parentId, fromEmail }) => {
        return withGoogleClient(userId, fromEmail, [DRIVE_SCOPE], async ({ client }) => {
          const drive = google.drive({ version: "v3", auth: client });
          const escaped = name.replace(/'/g, "\\'");
          const q =
            `name = '${escaped}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false` +
            (parentId ? ` and '${parentId}' in parents` : "");
          const existing = await drive.files.list({ q, fields: "files(id,name,webViewLink)", pageSize: 1 });
          const found = existing.data.files?.[0];
          if (found) {
            return {
              ok: true as const,
              id: found.id,
              name: found.name,
              webViewLink: found.webViewLink ?? null,
              reused: true,
            };
          }
          const r = await drive.files.create({
            requestBody: {
              name,
              mimeType: "application/vnd.google-apps.folder",
              ...(parentId ? { parents: [parentId] } : {}),
            },
            fields: "id,name,webViewLink",
          });
          return {
            ok: true as const,
            id: r.data.id,
            name: r.data.name,
            webViewLink: r.data.webViewLink ?? null,
            reused: false,
          };
        });
      },
    }),

    drive_search: tool({
      description:
        "Search the user's Google Drive. Pass a natural language query and it will be matched against file names AND full-text content. Returns metadata + share links. Use this when the user names a file by description ('that doc about X') or by full/partial filename.",
      inputSchema: z.object({
        query: z.string().min(2).max(200),
        limit: z.number().min(1).max(20).default(8),
        fromEmail: z.string().email().optional(),
      }),
      execute: async ({ query, limit, fromEmail }) => {
        return withGoogleClient(userId, fromEmail, [DRIVE_SCOPE], async ({ client }) => {
          const drive = google.drive({ version: "v3", auth: client });
          const escaped = query.replace(/'/g, "\\'");
          const q = `(name contains '${escaped}' or fullText contains '${escaped}') and trashed = false`;
          const r = await drive.files.list({
            q,
            pageSize: limit,
            fields:
              "files(id,name,mimeType,modifiedTime,webViewLink,owners(emailAddress,displayName))",
            orderBy: "modifiedTime desc",
          });
          return { ok: true as const, files: (r.data.files ?? []).map(summarize) };
        });
      },
    }),

    drive_list_recent: tool({
      description:
        "List the user's most recently modified Drive files. Use when the user says 'what did I work on recently' or wants a snapshot.",
      inputSchema: z.object({
        limit: z.number().min(1).max(20).default(10),
        fromEmail: z.string().email().optional(),
      }),
      execute: async ({ limit, fromEmail }) => {
        return withGoogleClient(userId, fromEmail, [DRIVE_SCOPE], async ({ client }) => {
          const drive = google.drive({ version: "v3", auth: client });
          const r = await drive.files.list({
            q: "trashed = false",
            pageSize: limit,
            orderBy: "modifiedTime desc",
            fields:
              "files(id,name,mimeType,modifiedTime,webViewLink,owners(emailAddress,displayName))",
          });
          return { ok: true as const, files: (r.data.files ?? []).map(summarize) };
        });
      },
    }),

    drive_get_link: tool({
      description:
        "Get the share link for a specific Drive file by its ID. Use as a follow-up after drive_search/drive_list_recent.",
      inputSchema: z.object({
        fileId: z.string().min(1),
        fromEmail: z.string().email().optional(),
      }),
      execute: async ({ fileId, fromEmail }) => {
        return withGoogleClient(userId, fromEmail, [DRIVE_SCOPE], async ({ client }) => {
          const drive = google.drive({ version: "v3", auth: client });
          const r = await drive.files.get({
            fileId,
            fields: "id,name,webViewLink,mimeType",
          });
          return {
            ok: true as const,
            id: r.data.id,
            name: r.data.name,
            mimeType: r.data.mimeType,
            link: r.data.webViewLink,
          };
        });
      },
    }),

    drive_upload_recent_media: tool({
      description:
        "Upload one or all of the user's staged LINE media (image/video/audio/file) to their Google Drive. Use when the user says 'save this to my Drive'. Optional folderId places it inside a specific EXISTING Drive folder — if the user names a NEW folder to create, call drive_create_folder first and pass its returned id here.",
      inputSchema: z.object({
        indexes: z
          .array(z.number().int().min(1))
          .max(10)
          .optional()
          .describe("1-indexed staged-media positions; omit to upload ALL staged."),
        filenames: z
          .array(z.string().max(120))
          .max(10)
          .optional()
          .describe("Optional filename overrides aligned with indexes."),
        folderId: z.string().optional().describe("Drive folder id to upload into. Omit for root."),
        fromEmail: z.string().email().optional(),
      }),
      execute: async ({ indexes, filenames, folderId, fromEmail }) => {
        const staged = await listRecentMedia(userId);
        if (!staged.length) {
          return { ok: false, error: "No staged LINE media. Send the file(s) first." };
        }
        const badIndex = (indexes ?? staged.map((_, i) => i + 1)).find(
          (i) => i < 1 || i > staged.length,
        );
        if (badIndex !== undefined) {
          return { ok: false, error: `Index ${badIndex} out of range (only ${staged.length} staged).` };
        }
        const targets = (indexes ?? staged.map((_, i) => i + 1)).map((i) => staged[i - 1]!);

        // Fetch LINE media bytes BEFORE opening the Google client — a LINE-side
        // fetch failure (staged content expired, LINE API hiccup) is not a Google
        // error and must not be mislabeled as one by withGoogleClient's catch-all
        // (mirrors the fetch-then-send split already used in email.ts's sendEmail).
        let fetched: { bytes: Uint8Array; contentType: string; name: string }[];
        try {
          fetched = await Promise.all(
            targets.map(async (item, i) => {
              const { bytes, contentType } = await getMessageContent(item.messageId);
              const overrideName = filenames?.[i];
              const name =
                (overrideName && overrideName.length > 0 ? overrideName : null) ??
                item.fileName ??
                defaultDriveName(item.kind, contentType);
              return { bytes, contentType, name };
            }),
          );
        } catch (err) {
          return {
            ok: false as const,
            error: `Couldn't fetch the staged LINE file(s): ${err instanceof Error ? err.message : String(err)}. Ask the user to resend if it's been a while.`,
          };
        }

        return withGoogleClient(userId, fromEmail, [DRIVE_SCOPE], async ({ client }) => {
          const drive = google.drive({ version: "v3", auth: client });
          const uploaded: { id: string; name: string; webViewLink: string | null }[] = [];
          for (const item of fetched) {
            const r = await drive.files.create({
              requestBody: {
                name: item.name,
                ...(folderId ? { parents: [folderId] } : {}),
              },
              media: {
                mimeType: item.contentType,
                body: Readable.from(Buffer.from(item.bytes)),
              },
              fields: "id,name,webViewLink",
            });
            uploaded.push({
              id: r.data.id ?? "",
              name: r.data.name ?? item.name,
              webViewLink: r.data.webViewLink ?? null,
            });
          }
          // Clear staged after a clean upload, mirroring email-send behavior.
          if (!indexes) await clearRecentMedia(userId);
          return { ok: true as const, uploaded };
        });
      },
    }),

    drive_read_text: tool({
      description:
        "Read the text content of a Drive file. Works on Google Docs (auto-converts to plain text) and on plain-text/markdown/CSV files. Returns up to ~50KB. Use after a search to actually read a doc.",
      inputSchema: z.object({
        fileId: z.string().min(1),
        fromEmail: z.string().email().optional(),
      }),
      execute: async ({ fileId, fromEmail }) => {
        return withGoogleClient(userId, fromEmail, [DRIVE_SCOPE], async ({ client }) => {
          const drive = google.drive({ version: "v3", auth: client });
          const meta = await drive.files.get({ fileId, fields: "id,name,mimeType" });
          const mime = meta.data.mimeType ?? "";
          let text = "";
          if (mime === "application/vnd.google-apps.document") {
            const r = await drive.files.export(
              { fileId, mimeType: "text/plain" },
              { responseType: "text" },
            );
            text = String(r.data ?? "");
          } else if (
            mime.startsWith("text/") ||
            mime === "application/json" ||
            mime === "application/xml"
          ) {
            const r = await drive.files.get(
              { fileId, alt: "media" },
              { responseType: "text" },
            );
            text = String(r.data ?? "");
          } else {
            return {
              ok: false as const,
              error: `Can't read mime type "${mime}" as text. Try drive_get_link for the share URL instead.`,
              name: meta.data.name,
            };
          }
          const truncated = text.length > 50_000;
          return {
            ok: true as const,
            name: meta.data.name,
            mimeType: mime,
            truncated,
            text: text.slice(0, 50_000),
          };
        });
      },
    }),

    drive_delete_file: tool({
      description:
        "Move a Drive file or folder to Trash — recoverable within Google's default retention, same as deleting in the Drive UI (not a permanent delete). Use when the user says 'delete that file from my drive'. Call drive_search first if you need the fileId.",
      inputSchema: z.object({
        fileId: z.string().min(1),
        fromEmail: z.string().email().optional(),
      }),
      execute: async ({ fileId, fromEmail }) => {
        return withGoogleClient(userId, fromEmail, [DRIVE_SCOPE], async ({ client }) => {
          const drive = google.drive({ version: "v3", auth: client });
          await drive.files.update({ fileId, requestBody: { trashed: true } });
          return { ok: true as const, fileId, trashed: true };
        });
      },
    }),

    drive_move_file: tool({
      description:
        "Move a Drive file into a different folder. Pass the target folderId — use drive_search to find an existing folder or drive_create_folder to make a new one first.",
      inputSchema: z.object({
        fileId: z.string().min(1),
        folderId: z.string().min(1),
        fromEmail: z.string().email().optional(),
      }),
      execute: async ({ fileId, folderId, fromEmail }) => {
        return withGoogleClient(userId, fromEmail, [DRIVE_SCOPE], async ({ client }) => {
          const drive = google.drive({ version: "v3", auth: client });
          const meta = await drive.files.get({ fileId, fields: "parents" });
          const prevParents = (meta.data.parents ?? []).join(",");
          const r = await drive.files.update({
            fileId,
            addParents: folderId,
            removeParents: prevParents || undefined,
            fields: "id,name,parents",
          });
          return { ok: true as const, fileId: r.data.id, name: r.data.name };
        });
      },
    }),

    drive_rename_file: tool({
      description: "Rename a Drive file or folder.",
      inputSchema: z.object({
        fileId: z.string().min(1),
        name: z.string().min(1).max(200),
        fromEmail: z.string().email().optional(),
      }),
      execute: async ({ fileId, name, fromEmail }) => {
        return withGoogleClient(userId, fromEmail, [DRIVE_SCOPE], async ({ client }) => {
          const drive = google.drive({ version: "v3", auth: client });
          const r = await drive.files.update({ fileId, requestBody: { name }, fields: "id,name" });
          return { ok: true as const, fileId: r.data.id, name: r.data.name };
        });
      },
    }),

    drive_share_file: tool({
      description:
        "Share a Drive file/folder with a specific email address, or enable link-sharing for 'anyone with the link'. Returns the share link. Set anyone=true for link-sharing instead of passing an email.",
      inputSchema: z.object({
        fileId: z.string().min(1),
        email: z.string().email().optional().describe("Grant access to this specific email. Omit and set anyone=true for link-sharing instead."),
        role: z.enum(["reader", "commenter", "writer"]).default("reader"),
        anyone: z.boolean().default(false).describe("Share with 'anyone with the link' instead of a specific email."),
        fromEmail: z.string().email().optional(),
      }),
      execute: async ({ fileId, email, role, anyone, fromEmail }) => {
        if (!email && !anyone) {
          return { ok: false as const, error: "Provide an email to share with, or set anyone=true for link-sharing." };
        }
        return withGoogleClient(userId, fromEmail, [DRIVE_SCOPE], async ({ client }) => {
          const drive = google.drive({ version: "v3", auth: client });
          await drive.permissions.create({
            fileId,
            requestBody: anyone ? { type: "anyone", role } : { type: "user", role, emailAddress: email },
            sendNotificationEmail: false,
          });
          const meta = await drive.files.get({ fileId, fields: "webViewLink" });
          return {
            ok: true as const,
            fileId,
            sharedWith: anyone ? "anyone with the link" : email,
            role,
            link: meta.data.webViewLink ?? null,
          };
        });
      },
    }),
  };
}
