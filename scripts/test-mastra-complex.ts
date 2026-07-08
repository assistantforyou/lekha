import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { runMastraAgent } from "@/mastra/run";
import { loadFacts } from "@/lib/memory/facts";
import { listAccounts } from "@/lib/tools/google-auth";
import { getSettings } from "@/lib/memory/settings";
import { listRecentMedia } from "@/lib/memory/recent-media";
import type { ModelMessage } from "ai";

const userId = `U_test_${Date.now()}`;
const profile = { displayName: "Test User" };

const prompt =
  "I'm in Bangkok. Please: (1) check today's weather, " +
  "(2) search the web for the latest AI news, " +
  "(3) remember that I prefer Thai iced tea with less sugar, " +
  "(4) add a task to buy snacks for the office, and " +
  "(5) give me a quick USD/THB exchange rate.";

async function main() {
  const [facts, accounts, settings, staged] = await Promise.all([
    loadFacts(userId, 30),
    listAccounts(userId),
    getSettings(userId),
    listRecentMedia(userId),
  ]);

  const messages: ModelMessage[] = [{ role: "user", content: prompt }];

  const result = await runMastraAgent(messages, {
    userId,
    profile,
    facts,
    accounts,
    staged,
    hasStagedMedia: staged.length > 0,
    settings,
    hint: undefined,
    traceId: `test-${Date.now()}`,
  });

  console.log("\n=== FINAL REPLY ===\n");
  console.log(result.text || "(no text)");

  console.log("\n=== TOOL CALLS ===");
  for (const call of result.toolCalls ?? []) {
    console.log(`- ${call.toolName}:`, JSON.stringify(call.input).slice(0, 300));
  }

  console.log("\n=== FLEX MESSAGES ===");
  console.log(result.hints.flexMessages?.map((m) => m.type).join(", ") || "none");

  console.log("\n=== FOLLOW-UPS ===");
  console.log(result.hints.followUps?.map((f) => f.label).join(", ") || "none");

  const calledNames = new Set((result.toolCalls ?? []).map((c) => c.toolName));
  const requiredGroups = [
    ["weather"],
    ["web_search", "news_search"],
    ["remember"],
    ["add_task"],
    ["fx_rate"],
  ];
  const missing = requiredGroups
    .filter((group) => !group.some((name) => calledNames.has(name)))
    .map((group) => group.join("/"));
  const hasOutput = result.text.trim().length > 0 || (result.hints.flexMessages?.length ?? 0) > 0;

  if (missing.length > 0 || !hasOutput) {
    console.error("\n❌ Complex test failed:", { missing, hasOutput });
    process.exit(1);
  }

  console.log("\n✅ Complex multi-step test passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
