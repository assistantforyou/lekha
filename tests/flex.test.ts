import { describe, it, expect } from "vitest";
import {
  confirmCancelFlex,
  parsePostbackData,
  taskListFlex,
  listItemsFlex,
  gmailResultsFlex,
  calendarEventsFlex,
  briefingFlex,
  newsFlex,
  taskCheckinFlex,
  googleConnectFlex,
  factsListFlex,
} from "@/lib/line/flex";
import { validateFlexMessage } from "@/lib/line/flex/validate";

describe("confirmCancelFlex", () => {
  it("emits a flex message with altText derived from summary", () => {
    const msg = confirmCancelFlex("Email to mom@gmail.com: dinner at 7");
    expect(msg.type).toBe("flex");
    expect(msg.altText).toContain("Email to mom@gmail.com");
    expect(msg.altText.length).toBeLessThanOrEqual(400);
  });

  it("truncates long summaries in the body but keeps altText present", () => {
    const long = "x".repeat(5000);
    const msg = confirmCancelFlex(long);
    expect(msg.altText.length).toBeGreaterThan(0);
    const bodyText = JSON.stringify(msg.contents);
    expect(bodyText.length).toBeLessThan(4000);
  });

  it("has yes and no postback actions wired to confirm:yes / confirm:no", () => {
    const msg = confirmCancelFlex("draft");
    const json = JSON.stringify(msg.contents);
    expect(json).toContain('"data":"confirm:yes"');
    expect(json).toContain('"data":"confirm:no"');
  });

  it("supports custom labels", () => {
    const msg = confirmCancelFlex("draft", { yesLabel: "Ship it", noLabel: "Nah" });
    const json = JSON.stringify(msg.contents);
    expect(json).toContain('"label":"Ship it"');
    expect(json).toContain('"label":"Nah"');
  });
});

describe("taskListFlex", () => {
  it("renders empty state with a meaningful altText", () => {
    const msg = taskListFlex([]);
    expect(msg.type).toBe("flex");
    expect(msg.altText).toMatch(/nothing|none/i);
  });

  it("emits done postback for open tasks and reopen for done", () => {
    const msg = taskListFlex([
      { id: "t1", title: "Buy milk", done: false },
      { id: "t2", title: "Write report", done: true },
    ]);
    const json = JSON.stringify(msg.contents);
    expect(json).toContain('"data":"task:done:t1"');
    expect(json).toContain('"data":"task:reopen:t2"');
  });

  it("caps display rows to 10", () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ id: `t${i}`, title: `Task ${i}`, done: false }));
    const msg = taskListFlex(many);
    const json = JSON.stringify(msg.contents);
    // count "task:done:" occurrences
    const matches = json.match(/task:done:t\d+/g) ?? [];
    expect(matches.length).toBeLessThanOrEqual(10);
  });
});

describe("listItemsFlex", () => {
  it("renders empty state", () => {
    const msg = listItemsFlex("grocery list", []);
    expect(msg.altText).toMatch(/empty/i);
  });

  it("emits remove postbacks per row", () => {
    const msg = listItemsFlex("grocery list", ["milk", "eggs"]);
    const json = JSON.stringify(msg.contents);
    expect(json).toContain('"data":"list:rm:grocery list:0"');
    expect(json).toContain('"data":"list:rm:grocery list:1"');
  });
});

describe("gmailResultsFlex", () => {
  it("renders empty state", () => {
    const msg = gmailResultsFlex([]);
    expect(msg.altText).toMatch(/no results/i);
  });

  it("emits a header + Open in Gmail uri button per message", () => {
    const msg = gmailResultsFlex([
      { id: "m1", from: "a@b.com", subject: "hi", snippet: "test" },
    ]);
    const json = JSON.stringify(msg.contents);
    expect(json).toContain("a@b.com");
    expect(json).toContain("https://mail.google.com/mail/u/0/#all/m1");
    expect(json).toContain('"label":"Open in Gmail"');
    expect(json).toContain('"type":"uri"');
  });
});

describe("calendarEventsFlex", () => {
  it("renders empty state", () => {
    const msg = calendarEventsFlex([]);
    expect(msg.altText).toMatch(/nothing upcoming/i);
  });

  it("emits remind postback and uri button when htmlLink present", () => {
    const msg = calendarEventsFlex([
      { id: "e1", summary: "Lunch", start: "2026-06-01T12:00:00+07:00", end: "", htmlLink: "https://calendar.google.com/x" },
    ]);
    const json = JSON.stringify(msg.contents);
    expect(json).toContain('"data":"event:remind:e1"');
    expect(json).toContain("https://calendar.google.com/x");
  });
});

describe("briefingFlex", () => {
  it("renders morning briefing with header and footer rail", () => {
    const msg = briefingFlex("morning", "Weather: sunny\nTasks: 3 open\nCalendar: empty");
    expect(msg.altText).toMatch(/Morning briefing/);
    const json = JSON.stringify(msg.contents);
    expect(json).toContain("☀️");
    expect(json).toContain("list my tasks");
  });

  it("renders evening summary variant", () => {
    const msg = briefingFlex("evening", "Today you finished 4 tasks.");
    expect(msg.altText).toMatch(/Evening summary/);
    const json = JSON.stringify(msg.contents);
    expect(json).toContain("🌙");
  });
});

describe("newsFlex", () => {
  it("renders empty state", () => {
    const msg = newsFlex([]);
    expect(msg.altText).toMatch(/no results/i);
  });

  it("emits a Read uri button per story", () => {
    const msg = newsFlex([{ title: "Headline", url: "https://news.example/1" }]);
    const json = JSON.stringify(msg.contents);
    expect(json).toContain("https://news.example/1");
    expect(json).toContain('"label":"Read"');
  });
});

describe("taskCheckinFlex", () => {
  it("emits done + skip postbacks per row", () => {
    const msg = taskCheckinFlex([
      { id: "t1", title: "Buy milk" },
      { id: "t2", title: "Write report" },
    ]);
    const json = JSON.stringify(msg.contents);
    expect(json).toContain('"data":"checkin:done:t1"');
    expect(json).toContain('"data":"checkin:skip:t1"');
    expect(json).toContain('"data":"checkin:done:t2"');
  });

  it("emits done:all footer button", () => {
    const msg = taskCheckinFlex([{ id: "t1", title: "Task A" }]);
    const json = JSON.stringify(msg.contents);
    expect(json).toContain('"data":"checkin:confirm-all"');
  });

  it("caps rows at 10", () => {
    const tasks = Array.from({ length: 20 }, (_, i) => ({ id: `t${i}`, title: `Task ${i}` }));
    const msg = taskCheckinFlex(tasks);
    const json = JSON.stringify(msg.contents);
    const matches = json.match(/checkin:done:t\d+/g) ?? [];
    expect(matches.length).toBeLessThanOrEqual(10);
  });
});

describe("googleConnectFlex", () => {
  it("carries the connect URL on a uri button, not as bare text", () => {
    const url = "https://lekha-iota.vercel.app/connect/abc123";
    const msg = googleConnectFlex(url);
    expect(msg.type).toBe("flex");
    const json = JSON.stringify(msg.contents);
    expect(json).toContain(`"type":"uri"`);
    expect(json).toContain(`"uri":"${url}"`);
    // The URL must not appear inside any "text" node — a bare URL in a Flex
    // text component isn't auto-linkified by LINE and isn't tappable.
    const textNodes = JSON.stringify(msg.contents).match(/"type":"text","text":"[^"]*"/g) ?? [];
    for (const node of textNodes) {
      expect(node).not.toContain(url);
    }
  });

  it("supports a custom reason", () => {
    const msg = googleConnectFlex("https://example.com/connect/x", { reason: "Reconnect to keep email working." });
    expect(JSON.stringify(msg.contents)).toContain("Reconnect to keep email working.");
  });
});

describe("parsePostbackData", () => {
  it("parses simple verb:arg", () => {
    expect(parsePostbackData("confirm:yes")).toEqual({ verb: "confirm", args: ["yes"] });
    expect(parsePostbackData("confirm:no")).toEqual({ verb: "confirm", args: ["no"] });
  });

  it("parses verb:arg:arg payloads", () => {
    expect(parsePostbackData("task:done:t_abc123")).toEqual({ verb: "task", args: ["done", "t_abc123"] });
    expect(parsePostbackData("reminder:cancel:r_xyz")).toEqual({ verb: "reminder", args: ["cancel", "r_xyz"] });
  });

  it("handles verb only", () => {
    expect(parsePostbackData("ping")).toEqual({ verb: "ping", args: [] });
  });

  it("empty string yields empty verb", () => {
    expect(parsePostbackData("")).toEqual({ verb: "", args: [] });
  });
});

describe("factsListFlex", () => {
  it("renders empty state", () => {
    const msg = factsListFlex([]);
    expect(msg.type).toBe("flex");
    expect(msg.altText).toMatch(/nothing saved yet/i);
  });

  it("groups facts by category and includes timestamps", () => {
    const msg = factsListFlex([
      { content: "Likes espresso", category: "preferences", updatedAt: Date.now() - 60_000 },
      { content: "Mom = mom@gmail.com", category: "people", updatedAt: Date.now() - 120_000 },
    ]);
    const json = JSON.stringify(msg.contents);
    expect(json).toContain("PREFERENCES");
    expect(json).toContain("PEOPLE");
    expect(json).toContain("Likes espresso");
    expect(json).toContain("mom@gmail.com");
    expect(json).toContain("1m ago");
  });

  it("caps displayed facts and notes the total", () => {
    const facts = Array.from({ length: 25 }, (_, i) => ({
      content: `fact ${i}`,
      category: "other" as const,
      updatedAt: Date.now() - i * 1000,
    }));
    const msg = factsListFlex(facts);
    const json = JSON.stringify(msg.contents);
    expect(json).toContain("Showing 15 of 25 memories");
  });
});

describe("validateFlexMessage", () => {
  it("strips invalid 'wrap' from box components", () => {
    const msg = {
      type: "flex",
      altText: "Test",
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "box", layout: "horizontal", wrap: true, contents: [] },
          ],
        },
      },
    };
    const v = validateFlexMessage(msg);
    expect(v.ok).toBe(true);
    expect(JSON.stringify(v.message.contents)).not.toContain('"wrap"');
    expect(v.errors.some((e) => e.includes("wrap"))).toBe(true);
  });
});
