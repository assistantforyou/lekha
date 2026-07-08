import { listActiveUsers } from "../lib/memory/user-registry";

async function main() {
  const users = await listActiveUsers();
  console.log(`Found ${users.length} active users:`);
  for (const u of users) {
    console.log(u);
  }
  const counts = new Map<string, number>();
  for (const u of users) counts.set(u, (counts.get(u) ?? 0) + 1);
  const dups = Array.from(counts.entries()).filter(([, n]) => n > 1);
  if (dups.length) console.log("Duplicates:", dups);
  else console.log("No duplicates.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
