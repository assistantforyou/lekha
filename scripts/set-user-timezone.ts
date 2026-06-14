import { updateSettings } from "../lib/memory/settings";

const USER_ID = process.argv[2] || process.env.EVAL_USER_ID || "U9b7215b2294a271c8c1d70be910a77cb";
const TIMEZONE = process.argv[3] || "Asia/Bangkok";

async function main() {
  await updateSettings(USER_ID, { timezone: TIMEZONE });
  console.log(`Set timezone for ${USER_ID} to ${TIMEZONE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
