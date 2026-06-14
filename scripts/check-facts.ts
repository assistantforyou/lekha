import { loadFacts } from "../lib/memory/facts";
import { getSettings } from "../lib/memory/settings";
import { getOrCreateProfile } from "../lib/memory/profile";

async function main() {
  const userId = process.env.EVAL_USER_ID || "Udebug";
  const [facts, settings, profile] = await Promise.all([
    loadFacts(userId),
    getSettings(userId),
    getOrCreateProfile(userId),
  ]);
  console.log("profile:", profile);
  console.log("settings:", settings);
  console.log("facts:", facts);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
