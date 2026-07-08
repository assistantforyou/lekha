import { unregisterUser } from "../lib/memory/user-registry";

const USER_ID = process.argv[2];

async function main() {
  if (!USER_ID) {
    console.error("Usage: npx tsx scripts/remove-active-user.ts <userId>");
    process.exit(1);
  }
  await unregisterUser(USER_ID);
  console.log(`Removed ${USER_ID} from users:active:window`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
