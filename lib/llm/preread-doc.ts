import { generateText } from "ai";
import { chatModel } from "@/lib/llm/provider";
import { getMessageContent } from "@/lib/line/client";
import { setDocContent } from "@/lib/memory/doc-cache";
import { normalizeMediaTypeFromBytes } from "@/lib/tools/media-ai";

const PREREAD_PROMPT = `Read this document completely and extract the following. Be thorough — this extraction will be used to answer follow-up questions without re-reading the file.

1. SUMMARY: 2-3 sentences — what this document is and its main purpose.
2. KEY FACTS: all important numbers, dates, names, measurements, prices, items. Include units.
3. STRUCTURE: list the main sections or topics covered.
4. DETAILS: any tables, specifications, or structured data worth preserving verbatim.
5. ACTION ITEMS / CONCLUSIONS: decisions, next steps, or outcomes.

Format with clear section labels. Be complete — do not omit specific values or figures.`;

/**
 * Download a LINE file and run a comprehensive Gemini extraction.
 * Called fire-and-forget from the file upload handler; result is cached for instant retrieval.
 */
export async function prereadDoc(
  userId: string,
  messageId: string,
  fileName: string | undefined,
  accessToken: string,
): Promise<void> {
  let bytes: Uint8Array;
  let mediaType: string;
  try {
    const fetched = await getMessageContent(messageId);
    bytes = fetched.bytes;
    mediaType = normalizeMediaTypeFromBytes(bytes, fetched.contentType, fileName, "file");
  } catch {
    return; // LINE content URL expired or network error — silent fail
  }

  try {
    const r = await generateText({
      model: chatModel(),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PREREAD_PROMPT },
            { type: "file", data: bytes, mediaType },
          ],
        },
      ],
    });
    const summary = r.text.trim();
    if (summary) {
      await setDocContent(userId, messageId, { summary, fileName, mediaType, ts: Date.now() });
    }
  } catch {
    // Gemini error (unsupported type, too large, etc.) — silent fail, tools will handle on demand
  }
}
