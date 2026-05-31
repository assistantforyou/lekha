/** Strip markdown syntax that LINE renders as raw punctuation. Model-independent guarantee. */
export function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/^#{1,6} /gm, "")
    .replace(/^[ \t]*\*[ \t]+/gm, "• ")
    .replace(/^[ \t]*-[ \t]+/gm, "• ")
    .replace(/`([^`\n]+)`/g, "$1")
    .trim();
}
