import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import type { FlexMessage } from "@/lib/line/client";
import { env } from "@/lib/env";
import { broadcast, formatSla } from "@/lib/github-notify/notify";
import { githubEventFlex, COLORS } from "@/lib/github-notify/flex";

function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ─── event handlers ──────────────────────────────────────────────────────────

function handlePush(p: Record<string, unknown>): FlexMessage | null {
  const commits = p.commits as unknown[];
  const ref = p.ref as string;
  if (!ref.startsWith("refs/heads/")) return null;
  if (commits.length === 0) return null;
  // skip branch-create pushes — the create event covers those
  if ((p.before as string) === "0000000000000000000000000000000000000000") return null;

  const branch = ref.replace("refs/heads/", "");
  const pusher = (p.pusher as { name: string }).name;
  const count = commits.length;
  const head = p.head_commit as { message: string; url: string } | null;
  const firstLine = head?.message.split("\n")[0] ?? head?.message ?? "";
  const compare = p.compare as string;

  return githubEventFlex({
    eventLabel: "📤  Push",
    color: COLORS.push,
    title: firstLine || `${count} commit${count === 1 ? "" : "s"}`,
    rows: [
      { key: "Branch", val: branch },
      { key: "Author", val: pusher },
      { key: "Commits", val: String(count) },
    ],
    url: compare,
  });
}

function handlePullRequest(p: Record<string, unknown>): FlexMessage | null {
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
    const toMain = pr.base.ref === "main";
    return githubEventFlex({
      eventLabel: toMain ? "🎉  PR merged to main" : "🎉  PR merged",
      color: toMain ? COLORS.prMergedMain : COLORS.prMerged,
      title: `#${pr.number}: ${pr.title}`,
      rows: [
        { key: "Author", val: pr.merged_by?.login ?? pr.user.login },
        { key: "Branch", val: `${pr.head.ref} → ${pr.base.ref}` },
        { key: "Time taken", val: timeTaken },
        { key: "Commits", val: String(pr.commits) },
      ],
      url: pr.html_url,
    });
  }

  return null;
}

function handleIssue(p: Record<string, unknown>): FlexMessage | null {
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
    return githubEventFlex({
      eventLabel: "🐛  Issue opened",
      color: "#F59E0B",
      title: `#${issue.number}: ${issue.title}`,
      rows: [{ key: "Opened by", val: issue.user.login }],
      url: issue.html_url,
    });
  }

  if (action === "closed") {
    const timeTaken = formatSla(issue.created_at, issue.closed_at ?? new Date().toISOString());
    return githubEventFlex({
      eventLabel: "✅  Issue closed",
      color: COLORS.issueClosed,
      title: `#${issue.number}: ${issue.title}`,
      rows: [
        { key: "Closed by", val: closer },
        { key: "Time taken", val: timeTaken },
      ],
      url: issue.html_url,
    });
  }

  return null;
}

function handleBranchLifecycle(event: string, p: Record<string, unknown>): FlexMessage | null {
  if ((p.ref_type as string) !== "branch") return null;
  const branch = p.ref as string;
  const actor = (p.sender as { login: string }).login;
  const repoUrl = (p.repository as { html_url: string }).html_url;

  if (event === "create") {
    return githubEventFlex({
      eventLabel: "🌿  Branch created",
      color: COLORS.branchCreated,
      title: branch,
      rows: [{ key: "By", val: actor }],
      url: `${repoUrl}/tree/${branch}`,
    });
  }

  if (event === "delete") {
    return githubEventFlex({
      eventLabel: "🗑  Branch deleted",
      color: COLORS.branchDeleted,
      title: branch,
      rows: [{ key: "By", val: actor }],
      url: repoUrl,
    });
  }

  return null;
}

function handleWorkflowRun(p: Record<string, unknown>): FlexMessage | null {
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
  const firstLine = head_commit.message.split("\n")[0] ?? "";

  if (conclusion === "success") {
    return githubEventFlex({
      eventLabel: "✅  CI passed",
      color: COLORS.ciPassed,
      title: name,
      rows: [
        { key: "Branch", val: head_branch },
        { key: "Author", val: actor.login },
        { key: "Commit", val: firstLine },
      ],
      url: html_url,
    });
  }

  if (conclusion === "failure") {
    return githubEventFlex({
      eventLabel: "🚨  CI failed",
      color: COLORS.ciFailed,
      title: name,
      rows: [
        { key: "Branch", val: head_branch },
        { key: "Author", val: actor.login },
        { key: "Commit", val: firstLine },
      ],
      url: html_url,
    });
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

  let message: FlexMessage | null = null;
  if (event === "push") message = handlePush(payload);
  else if (event === "pull_request") message = handlePullRequest(payload);
  else if (event === "issues") message = handleIssue(payload);
  else if (event === "create" || event === "delete") message = handleBranchLifecycle(event, payload);
  else if (event === "workflow_run") message = handleWorkflowRun(payload);

  if (message) await broadcast(message);

  return NextResponse.json({ ok: true });
}
