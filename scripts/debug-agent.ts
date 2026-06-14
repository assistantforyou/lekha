import { generateText } from "ai";
import { chatModel, GEMINI_PROVIDER_OPTIONS } from "../lib/llm/provider";
import { buildMemoryTools } from "../lib/tools/memory";
import { buildSystemPrompt, buildTimeContext } from "../lib/llm/prompts";
import { getOrCreateProfile } from "../lib/memory/profile";
import { getSettings } from "../lib/memory/settings";

async function main() {
  const userId = process.env.EVAL_USER_ID || "Udebug";
  const [profile, settings] = await Promise.all([
    getOrCreateProfile(userId),
    getSettings(userId),
  ]);
  const tools = buildMemoryTools(userId);
  const tz = settings.timezone ?? "Asia/Bangkok";
  const system = buildSystemPrompt("", profile, settings) + "\n\n" + buildTimeContext(tz);
  let ok = 0;
  for (let i = 0; i < 10; i++) {
    const result = await generateText({
      model: chatModel(),
      system,
      messages: [{ role: "user", content: "what do you remember about my preferences" }],
      tools,
      temperature: 0.6,
      providerOptions: GEMINI_PROVIDER_OPTIONS,
    });
    const calls = result.steps[0]?.toolCalls?.map((c) => c.toolName);
    if (calls?.includes("list_memories")) ok++;
    console.log("run", i, "calls", calls);
  }
  console.log("ok", ok, "/ 10");
}

main().catch((e) => {
  console.error("error:", e);
  process.exit(1);
});
