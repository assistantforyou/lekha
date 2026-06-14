import { EVAL_CASES } from "../tests/eval/cases";

const URL = process.env.EVAL_URL || "https://lekha-iota.vercel.app/api/dev/chat";
const SECRET = process.env.DEV_CHAT_SECRET;
const USER_ID = process.env.EVAL_USER_ID;
const DELAY_MS = Number(process.env.EVAL_DELAY_MS || "1000");

if (!SECRET) {
  console.error("Set DEV_CHAT_SECRET");
  process.exit(1);
}
if (!USER_ID) {
  console.error("Set EVAL_USER_ID");
  process.exit(1);
}
const DEV_SECRET = SECRET;
const EVAL_USER = USER_ID;

async function send(text: string) {
  const res = await fetch(URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-dev-secret": DEV_SECRET },
    body: JSON.stringify({ userId: EVAL_USER, text }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  return res.json() as Promise<{ reply: string; toolCalls?: { toolName: string; input: unknown }[] }>;
}

function normalizeTools(toolCalls?: { toolName: string; input: unknown }[]) {
  return (toolCalls ?? []).map((c) => c.toolName);
}

async function main() {
  const results: {
    name: string;
    userText: string;
    reply: string;
    toolCalls: string[];
    expected: { shouldCall?: string[]; shouldNotCall?: string[] };
    passed: boolean;
    failures: string[];
  }[] = [];

  for (const c of EVAL_CASES) {
    try {
      const { reply, toolCalls } = await send(c.userText);
      const called = normalizeTools(toolCalls);
      const failures: string[] = [];
      for (const name of c.shouldCall ?? []) {
        if (!called.includes(name)) failures.push(`expected ${name}, got [${called.join(", ")}]`);
      }
      for (const name of c.shouldNotCall ?? []) {
        if (called.includes(name)) failures.push(`did not expect ${name}`);
      }
      const passed = failures.length === 0;
      results.push({ name: c.name, userText: c.userText, reply, toolCalls: called, expected: { shouldCall: c.shouldCall, shouldNotCall: c.shouldNotCall }, passed, failures });
      console.log(`${passed ? "✅" : "❌"} ${c.name}: ${reply.slice(0, 80).replace(/\n/g, " ")}`);
      if (!passed) console.log("   ", failures.join("; "));
      await new Promise((r) => setTimeout(r, DELAY_MS));
    } catch (err) {
      console.error(`❌ ${c.name}:`, err);
      results.push({ name: c.name, userText: c.userText, reply: String(err), toolCalls: [], expected: { shouldCall: c.shouldCall, shouldNotCall: c.shouldNotCall }, passed: false, failures: [String(err)] });
    }
  }

  const passed = results.filter((r) => r.passed).length;
  console.log(`\n${passed}/${results.length} passed`);

  const fs = await import("fs");
  const out = `/tmp/lekha-eval-${Date.now()}.json`;
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log(`results written to ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
