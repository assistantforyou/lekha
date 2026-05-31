import { Client as QStash } from "@upstash/qstash";

const token = process.env.QSTASH_TOKEN;
if (!token) { console.error("Set QSTASH_TOKEN"); process.exit(1); }

const client = new QStash({ token });
const schedules = await client.schedules.list();
console.log("Found", schedules.length, "schedule(s):\n");
for (const s of schedules) {
  const body = typeof s.body === "string" ? s.body : JSON.stringify(s.body);
  console.log("ID:   ", s.scheduleId);
  console.log("URL:  ", s.destination);
  console.log("Cron: ", s.cron ?? "(one-shot)");
  console.log("Body: ", body.slice(0, 200));
  console.log("---");
}
