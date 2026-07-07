import { createTool } from "@mastra/core/tools";
import type { Tool as AiSdkTool } from "ai";

/**
 * Convert an existing Vercel AI SDK v6 tool into a Mastra tool.
 *
 * The existing Lekha tool builders already close over `userId`, settings, and
 * other per-user state, so we only need to bridge the execution shape and
 * assign a stable id.
 */
export function wrapAiTool<TInput, TOutput>(
  id: string,
  aiTool: AiSdkTool<TInput, TOutput>,
) {
  return createTool({
    id,
    description: aiTool.description ?? id,
    inputSchema: aiTool.inputSchema as any,
    execute: (async (inputData: unknown, _context: any) => {
      if (!aiTool.execute) {
        throw new Error(`Tool ${id} has no execute function`);
      }
      return aiTool.execute(inputData as TInput, undefined as any);
    }) as any,
  });
}
