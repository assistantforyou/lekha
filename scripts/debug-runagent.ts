import { runAgent } from "../lib/llm/agent";
import { loadFacts } from "../lib/memory/facts";
import { getOrCreateProfile } from "../lib/memory/profile";
import { getSettings } from "../lib/memory/settings";
import { historyForPrompt } from "../lib/memory/history";
import { classifyIntent } from "../lib/intent";
import { toolsForUser } from "../lib/tools";
import { listAccounts } from "../lib/tools/google-auth";

async function main() {
  const userId = process.env.EVAL_USER_ID || "Udebug";
  const userText = process.argv[2] || "show me everything I need to do";

  const [historyMsgs, facts, profile, settings] = await Promise.all([
    historyForPrompt(userId),
    loadFacts(userId),
    getOrCreateProfile(userId),
    getSettings(userId),
  ]);

  const messages = [...historyMsgs, { role: "user" as const, content: userText }];
  const intentResult = await classifyIntent(userText);
  const accounts = await listAccounts(userId);
  const userHasGoogle = accounts.accounts.length > 0;
  const intent = intentResult.isMulti || intentResult.confidence === "low" ? undefined : intentResult.primary;
  const tools = await toolsForUser(userId, { userHasGoogle, disabledCategories: settings.disabledCategories, intent });

  console.log("intent:", intentResult);

  const result = await runAgent(userId, profile, facts, messages, `debug_${Date.now()}`, { tools, intent });
  console.log("reply:", JSON.stringify(result.text));
  console.log("toolCalls:", result.toolCalls);
}

main().catch((e) => {
  console.error("error:", e);
  process.exit(1);
});
