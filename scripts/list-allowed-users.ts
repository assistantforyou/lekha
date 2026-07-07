import { redis } from "../lib/memory/redis";
import { listAllowed } from "../lib/memory/allowlist";

async function main() {
  const allowed = await listAllowed();
  console.log(`Found ${allowed.length} allowed user(s):`);
  for (const userId of allowed) {
    const profile = await redis().get<{ displayName: string }>(`user:${userId}:profile`);
    console.log(`- ${profile?.displayName ?? "(unknown)"}: ${userId}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
