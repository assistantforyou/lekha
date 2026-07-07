import { NextResponse } from "next/server";

export async function GET() {
  const { getMastra } = await import("@/mastra");
  const mastra = getMastra();
  const agent = mastra.getAgent("lekha");
  return NextResponse.json({
    ok: true,
    agent: agent?.id ?? null,
  });
}
