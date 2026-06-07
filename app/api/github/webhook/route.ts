import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@/lib/env";
import { broadcast, formatSla } from "@/lib/github-notify/notify";

const REPO = "assistantforyou/lekha";

function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ─── event handlers ──────────────────────────────────────────────────────────

function handlePush(p: Record<string, unknown>): string | null {
  const commits = p.commits as unknown[];
  const ref = p.ref as string;
  // skip tag pushes and empty pushes
  if (!ref.startsWith("refs/heads/")) return null;
  if (commits.length === 0) return null;
  // skip branch-create pushes (before is all zeros — create event handles those)
  if ((p.before as string) === "0000000000000000000000000000000000000000") return null;

  const branch = ref.replace("refs/heads/", "");
  const pusher = (p.pusher as { name: string }).name;
  const count = commits.length;
  const head = p.head_commit as { message: string; url: string } | null;
  const firstLine = head?.message.split("\n")[0] ?? "";
  const compare = p.compare as string;

  return [
    `📤 Push — ${REPO}`,
    `🌿 ${branch}  ·  👤 ${pusher}`,
    `📝 ${count} commit${count === 1 ? "" : "s"}: "${firstLine}"`,
    compare,
  ].join("\n");
}

function handlePullRequest(p: Record<string, unknown>): string | null {
  const action = p.action as string;
  const pr = p.pull_request as {
    number: number;
    title: string;
    html_url: string;
    commits: number;
    merged: boolean;
    created_at: string;
    closed_at: string | null;
    merged_at: string | null;
    base: { ref: string };
    head: { ref: string };
    merged_by: { login: string } | null;
    user: { login: string };
  };

  if (action === "closed" && pr.merged) {
    const timeTaken = formatSla(pr.created_at, pr.merged_at ?? pr.closed_at ?? new Date().toISOString());
    const toMain = pr.base.ref === "main" ? " to main ✅" : "";
    return [
      `🎉 PR merged${toMain} — ${REPO}`,
      `#${pr.number}: ${pr.title}`,
      `👤 ${pr.merged_by?.login ?? pr.user.login}  ·  ⏱ ${timeTaken}  ·  📝 ${pr.commits} commit${pr.commits === 1 ? "" : "s"}`,
      pr.html_url,
    ].join("\n");
  }

  return null;
}

function handleIssue(p: Record<string, unknown>): string | null {
  const action = p.action as string;
  const issue = p.issue as {
    number: number;
    title: string;
    html_url: string;
    created_at: string;
    closed_at: string | null;
    user: { login: string };
  };
  const closer = (p.sender as { login: string }).login;

  if (action === "opened") {
    return [
      `🐛 Issue opened — ${REPO}`,
      `#${issue.number}: ${issue.title}`,
      `👤 ${issue.user.login}`,
      issue.html_url,
    ].join("\n");
  }

  if (action === "closed") {
    const timeTaken = formatSla(issue.created_at, issue.closed_at ?? new Date().toISOString());
    return [
      `✅ Issue closed — ${REPO}`,
      `#${issue.number}: ${issue.title}`,
      `👤 ${closer}  ·  ⏱ ${timeTaken}`,
      issue.html_url,
    ].join("\n");
  }

  return null;
}

function handleBranchLifecycle(event: string, p: Record<string, unknown>): string | null {
  if ((p.ref_type as string) !== "branch") return null;
  const branch = p.ref as string;
  const actor = (p.sender as { login: string }).login;

  if (event === "create") {
    return `🌿 Branch created — ${REPO}\n${branch}  ·  👤 ${actor}`;
  }
  if (event === "delete") {
    return `🗑 Branch deleted — ${REPO}\n${branch}  ·  👤 ${actor}`;
  }
  return null;
}

function handleWorkflowRun(p: Record<string, unknown>): string | null {
  if ((p.action as string) !== "completed") return null;

  const run = p.workflow_run as {
    name: string;
    conclusion: string;
    head_branch: string;
    html_url: string;
    head_commit: { message: string };
    actor: { login: string };
  };

  const { conclusion, head_branch, name, html_url, head_commit, actor } = run;
  const firstLine = head_commit.message.split("\n")[0];

  if (conclusion === "success") {
    return [
      `✅ CI passed — ${REPO}`,
      `${name}  ·  🌿 ${head_branch}`,
      `👤 ${actor.login}  ·  "${firstLine}"`,
      html_url,
    ].join("\n");
  }

  if (conclusion === "failure") {
    return [
      `🚨 CI failed — ${REPO}`,
      `${name}  ·  🌿 ${head_branch}`,
      `👤 ${actor.login}  ·  "${firstLine}"`,
      html_url,
    ].join("\n");
  }

  return null;
}

// ─── main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = env().GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const signature = req.headers.get("x-hub-signature-256") ?? "";
  const event = req.headers.get("x-github-event") ?? "";
  const body = await req.text();

  if (!verifySignature(body, signature, secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(body) as Record<string, unknown>;

  let message: string | null = null;
  if (event === "push") message = handlePush(payload);
  else if (event === "pull_request") message = handlePullRequest(payload);
  else if (event === "issues") message = handleIssue(payload);
  else if (event === "create" || event === "delete") message = handleBranchLifecycle(event, payload);
  else if (event === "workflow_run") message = handleWorkflowRun(payload);

  if (message) await broadcast(message);

  return NextResponse.json({ ok: true });
}
