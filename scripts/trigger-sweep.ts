import { Client } from "@upstash/qstash";

const c = new Client({
  token: process.env.QSTASH_TOKEN!,
});

async function main() {
  const res = await c.publishJSON({
    url: `${process.env.APP_BASE_URL}/api/cron/sweep/fire`,
    body: {},
  });
  console.log(res);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
