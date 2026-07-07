import { mastra } from "@/mastra";
import { NextResponse } from "next/server";

export async function GET() {
  const agent = mastra.getAgent("lekha");
  return NextResponse.json({
    ok: true,
    agent: agent?.id ?? null,
  });
}
