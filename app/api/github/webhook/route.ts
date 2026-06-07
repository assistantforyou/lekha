import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@/lib/env";
import { notifyMerge } from "@/lib/github-notify/notify";

function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

interface PullRequestPayload {
  action: string;
  pull_request: {
    merged: boolean;
    number: number;
    title: string;
    html_url: string;
    commits: number;
    base: { ref: string };
    merged_by: { login: string } | null;
    user: { login: string };
  };
}

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

  if (event !== "pull_request") {
    return NextResponse.json({ ok: true });
  }

  const payload = JSON.parse(body) as PullRequestPayload;
  const { action, pull_request: pr } = payload;

  if (action === "closed" && pr.merged && pr.base.ref === "main") {
    await notifyMerge({
      prTitle: pr.title,
      prNumber: pr.number,
      author: pr.merged_by?.login ?? pr.user.login,
      prUrl: pr.html_url,
      commits: pr.commits,
    });
  }

  return NextResponse.json({ ok: true });
}
