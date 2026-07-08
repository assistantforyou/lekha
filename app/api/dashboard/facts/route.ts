import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/dashboard-auth";
import {
  loadFacts,
  appendFact,
  removeFact,
  FACT_CATEGORIES,
  type FactCategory,
} from "@/lib/memory/facts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const facts = await loadFacts(session.userId);
  return NextResponse.json({ facts: facts.facts });
}

function isValidCategory(s: unknown): s is FactCategory {
  return typeof s === "string" && (FACT_CATEGORIES as string[]).includes(s);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const action = typeof raw.action === "string" ? raw.action : "";

  if (action === "add") {
    const content = typeof raw.content === "string" ? raw.content : "";
    const category = isValidCategory(raw.category) ? raw.category : "other";
    if (raw.category !== undefined && !isValidCategory(raw.category)) {
      return NextResponse.json(
        { error: "invalid category", valid: FACT_CATEGORIES },
        { status: 400 },
      );
    }
    if (!content.trim()) {
      return NextResponse.json({ error: "content required" }, { status: 400 });
    }
    await appendFact(session.userId, content.trim(), { category });
    const facts = await loadFacts(session.userId);
    return NextResponse.json({ facts: facts.facts });
  }

  if (action === "delete") {
    const id = typeof raw.id === "string" ? raw.id : "";
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const facts = await loadFacts(session.userId);
    const ordered = [...facts.facts].sort((a, b) => b.updatedAt - a.updatedAt);
    const displayIdx = ordered.findIndex((f) => f.id === id);
    if (displayIdx >= 0) {
      await removeFact(session.userId, displayIdx + 1);
    }
    const next = await loadFacts(session.userId);
    return NextResponse.json({ facts: next.facts });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
