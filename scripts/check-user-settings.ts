import { redis } from "../lib/memory/redis";

const USER_ID = process.argv[2] || process.env.EVAL_USER_ID || "U9b7215b2294a271c8c1d70be910a77cb";

async function main() {
  const r = redis();
  const settings = await r.get<Record<string, unknown>>(`user:${USER_ID}:settings`);
  console.log("Settings for", USER_ID);
  console.log(JSON.stringify(settings, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
