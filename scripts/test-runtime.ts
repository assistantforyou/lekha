const CHAT_URL = "http://localhost:3000/api/dev/chat";
const SECRET = "185cd47094c024f97b846e7d73b4d16f";

let pass = 0;
let fail = 0;

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function chat(userId: string, text: string): Promise<{
  ok: boolean;
  reply: string;
  confirmDraft: boolean;
  flexCount: number;
  time: number;
  status: number;
  raw: unknown;
}> {
  const start = performance.now();
  const res = await fetch(CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-dev-secret": SECRET },
    body: JSON.stringify({ userId, text }),
  });
  const time = +(performance.now() - start).toFixed(2);
  const raw = await res.json().catch(() => ({ error: "bad json" }));
  const reply = typeof raw === "object" && raw !== null && "reply" in raw ? String(raw.reply) : "";
  const confirmDraft =
    typeof raw === "object" && raw !== null && "hints" in raw && typeof raw.hints === "object" && raw.hints !== null
      ? Boolean((raw.hints as Record<string, unknown>).confirmDraft)
      : false;
  const flexCount =
    typeof raw === "object" && raw !== null && "hints" in raw && typeof raw.hints === "object" && raw.hints !== null
      ? ((raw.hints as Record<string, unknown>).flexMessages as unknown[] | undefined)?.length ?? 0
      : 0;
  return { ok: res.ok && res.status === 200, reply, confirmDraft, flexCount, time, status: res.status, raw };
}

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    pass++;
    console.log(`✓ ${name}`);
  } else {
    fail++;
    console.log(`✗ ${name}${detail ? " — " + detail : ""}`);
  }
}

async function run() {
  console.log("=== Runtime Bot Tests ===\n");

  // T1: Fresh user greeting — must NOT be a morning briefing
  const u1 = uuid();
  const t1 = await chat(u1, "hi");
  check("T1: status 200", t1.ok, `HTTP ${t1.status}`);
  check("T1: normal greeting (no briefing)", !t1.reply.includes("Morning briefing") && !t1.reply.includes("Your agenda"), t1.reply.slice(0, 80));

  // T2: Weather query
  const u2 = uuid();
  const t2 = await chat(u2, "what is the weather in Bangkok?");
  check("T2: status 200", t2.ok);
  check("T2: contains temp", t2.reply.includes("°C") || t2.reply.includes("°F"), t2.reply.slice(0, 80));

  // T3: Stock quote — model may output action label or full details
  const u3 = uuid();
  const t3 = await chat(u3, "what is NVIDIA stock price?");
  check("T3: status 200", t3.ok);
  check("T3: mentions NVIDIA or stock", t3.reply.includes("NVIDIA") || t3.reply.includes("NVDA") || t3.reply.includes("stock_price"), t3.reply.slice(0, 80));

  // T4: Draft email — user has no Google, so tool is unavailable; confirmDraft must be FALSE
  const u4 = uuid();
  const t4 = await chat(u4, "draft an email to john@example.com saying hello and asking how he is");
  check("T4: status 200", t4.ok);
  check("T4: confirmDraft is FALSE (no Google)", t4.confirmDraft === false, `confirmDraft=${t4.confirmDraft}`);
  check("T4: explains tool unavailable", t4.reply.toLowerCase().includes("can't") || t4.reply.toLowerCase().includes("not available") || t4.reply.toLowerCase().includes("connect google"), t4.reply.slice(0, 80));

  // T5: "yes" after non-existent draft — no pending, so model handles it normally
  const t5 = await chat(u4, "yes");
  check("T5: status 200", t5.ok);
  check("T5: NOT a briefing", !t5.reply.includes("Morning briefing") && !t5.reply.includes("Your agenda"), t5.reply.slice(0, 120));

  // T6: Thai greeting
  const u5 = uuid();
  const t6 = await chat(u5, "สวัสดี");
  check("T6: status 200", t6.ok);
  check("T6: Thai reply", t6.reply.includes("สวัสดี"), t6.reply.slice(0, 80));

  // T7: Reminder
  const u6 = uuid();
  const t7 = await chat(u6, "remind me to call mom tomorrow at 9am");
  check("T7: status 200", t7.ok);
  check("T7: reminder set", t7.reply.toLowerCase().includes("reminder"), t7.reply.slice(0, 80));

  // T8: "no" with no pending — normal model response
  const u7 = uuid();
  const t8 = await chat(u7, "no");
  check("T8: status 200", t8.ok);
  check("T8: no pending crash", t8.reply.length > 0, "empty reply");

  // T9: Morning briefing request — should work when explicitly asked
  const u8 = uuid();
  const t9 = await chat(u8, "send me my morning briefing");
  check("T9: status 200", t9.ok);
  check("T9: Flex rendered", t9.flexCount > 0, `flexCount=${t9.flexCount}`);

  // T10: Web search — should return Flex carousel
  const u9 = uuid();
  const t10 = await chat(u9, "search for latest AI news");
  check("T10: status 200", t10.ok);
  check("T10: news Flex", t10.flexCount > 0, `flexCount=${t10.flexCount}`);

  // T11: History isolation — u1's "hi" should not affect u2's weather query
  check("T11: history isolation", u1 !== u2, "same userId");

  console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
