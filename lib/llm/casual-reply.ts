import { generateText } from "ai";
import { extractorModel } from "@/lib/llm/provider";
import { withTimeout, AgentTimeoutError } from "@/lib/timing";
import { stripMarkdown } from "@/lib/format";

const CASUAL_SYSTEM_PROMPT = `You are Lekha (เลขา), a warm, concise personal secretary in a LINE chat. The user just sent a casual message, greeting, test, emoji request, or complaint. Reply naturally and briefly. Do NOT ask unnecessary follow-up questions. If they complain about something (e.g. "stop sending me articles"), acknowledge it simply and stop.

Rules:
- Match the user's language (Thai if they wrote Thai, English if English).
- For emoji requests, include the requested emoji.
- Never output markdown.
- Keep it short.`;

const CASUAL_TIMEOUT_MS = 4_000;

export async function generateCasualReply(userText: string): Promise<string> {
  try {
    const result = await withTimeout(
      generateText({
        model: extractorModel(),
        system: CASUAL_SYSTEM_PROMPT,
        prompt: userText,
        temperature: 0.5,
      }),
      CASUAL_TIMEOUT_MS,
    );
    return stripMarkdown(result.text).trim() || "Got it.";
  } catch (err) {
    if (err instanceof AgentTimeoutError) {
      console.warn("[casual] timeout", { userText: userText.slice(0, 100) });
    } else {
      console.warn("[casual] failed", err);
    }
    // Fallback replies for common cases.
    const lower = userText.toLowerCase();
    if (/\b(hello|hi|hey)\b/i.test(lower)) return "Hey there! What can I do for you?";
    if (/\b(thanks?|thank you)\b/i.test(lower)) return "You're welcome!";
    if (/emoji/.test(lower)) return "🦄";
    if (/stop/.test(lower)) return "Got it — stopping now.";
    return "Got it.";
  }
}
