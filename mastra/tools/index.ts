import { z } from "zod";
import { toolsForUser } from "@/lib/tools";
import { wrapAiTool } from "./wrap-ai-tool";

/**
 * Per-request context that the LINE webhook injects into the Mastra agent.
 * These values are NOT visible in the LLM prompt; they are only available to
 * tool execute functions.
 */
export const lekhaRequestContextSchema = z.object({
  userId: z.string(),
  timezone: z.string().optional(),
  language: z.string().nullable().optional(),
  activeEmail: z.string().nullable().optional(),
  userHasGoogle: z.boolean().optional(),
  disabledCategories: z.array(z.string()).optional(),
  hasStagedMedia: z.boolean().optional(),
  hint: z.string().optional(),
});

export type LekhaRequestContext = z.infer<typeof lekhaRequestContextSchema>;

/**
 * Build the per-user tool registry for the Mastra agent.
 *
 * We reuse the existing `lib/tools/index.ts` registry (which already handles
 * env gating, disabled categories, staged media, and fastClassify hints) and
 * bridge each AI SDK tool into a Mastra tool.
 */
export async function buildLekhaTools(ctx: LekhaRequestContext) {
  const aiTools = await toolsForUser(ctx.userId, {
    userHasGoogle: ctx.userHasGoogle ?? false,
    disabledCategories: ctx.disabledCategories ?? [],
    hasStagedMedia: ctx.hasStagedMedia,
    hint: ctx.hint,
  });

  const out: Record<string, ReturnType<typeof wrapAiTool>> = {};
  for (const [name, aiTool] of Object.entries(aiTools)) {
    out[name] = wrapAiTool(name, aiTool as any);
  }
  return out;
}
