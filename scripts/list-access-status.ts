import { redis } from "../lib/memory/redis";
import { listAllowed, listPending } from "../lib/memory/allowlist";
import { listAllUsers } from "../lib/memory/user-registry";
import { env } from "../lib/env";

async function main() {
  const admins = new Set(
    (env().ADMIN_LINE_USER_ID ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  const active = await listAllUsers();
  const allowed = new Set(await listAllowed());
  const pending = new Set(await listPending());
  const trial = new Set(await redis().smembers("users:trial"));

  console.log(`Active users: ${active.length}`);
  console.log(`Allowed: ${allowed.size} | Pending: ${pending.size} | Trial: ${trial.size} | Admins: ${admins.size}`);
  console.log("");

  for (const userId of active) {
    const profile = await redis().get<{ displayName: string }>(`user:${userId}:profile`);
    const name = profile?.displayName ?? "(unknown)";
    const flags: string[] = [];
    if (admins.has(userId)) flags.push("admin");
    if (allowed.has(userId)) flags.push("allowed");
    if (trial.has(userId)) flags.push("trial");
    if (pending.has(userId)) flags.push("pending");
    const access = admins.has(userId) || allowed.has(userId) || trial.has(userId);
    console.log(`${access ? "✓" : "✗"} ${name}: ${userId} [${flags.join(", ") || "none"}]`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
