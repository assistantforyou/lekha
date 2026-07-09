import { NextRequest, NextResponse } from "next/server";
import { getMessageContent } from "@/lib/line/client";
import { verifyMediaProxySignature } from "@/lib/line/media-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public but signed proxy for LINE message content.
 * Used by Flex Message image components so LINE servers can render a preview
 * of an attached photo without exposing the raw content API to the world.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const messageId = searchParams.get("messageId");
  const userId = searchParams.get("userId");
  const exp = searchParams.get("exp");
  const sig = searchParams.get("sig");

  if (!messageId || !userId || !exp || !sig) {
    return new NextResponse("Missing parameters", { status: 400 });
  }

  if (!verifyMediaProxySignature(messageId, userId, exp, sig)) {
    return new NextResponse("Invalid signature", { status: 403 });
  }

  if (Number(exp) < Math.floor(Date.now() / 1000)) {
    return new NextResponse("Link expired", { status: 403 });
  }

  try {
    const { bytes, contentType } = await getMessageContent(messageId, userId);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    console.warn("[media-proxy] fetch failed", { messageId, userId, err });
    return new NextResponse("Not found", { status: 404 });
  }
}
