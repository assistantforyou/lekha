import { redis } from "../lib/memory/redis";

const USER_ID = process.argv[2];

async function main() {
  if (!USER_ID) {
    console.error("Usage: npx tsx scripts/remove-active-user.ts <userId>");
    process.exit(1);
  }
  await redis().srem("users:active", USER_ID);
  console.log(`Removed ${USER_ID} from users:active`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
