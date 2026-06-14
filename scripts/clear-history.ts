import { redis } from "@/lib/memory/redis";

const userId = process.argv[2] || process.env.EVAL_USER_ID;
if (!userId) {
  console.error("Usage: npx tsx scripts/clear-history.ts <userId>");
  process.exit(1);
}

async function main() {
  const r = redis();
  const keys = [
    `user:${userId}:history`,
    `user:${userId}:history:counter`,
    `history:running_summary:${userId}`,
  ];
  for (const key of keys) {
    await r.del(key);
  }
  console.log(`Cleared history for ${userId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
