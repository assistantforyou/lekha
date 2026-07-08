export function logError(module: string, message: string, error?: unknown): void {
  const detail = error instanceof Error ? error.message : error !== undefined ? String(error) : undefined;
  console.error(`[${module}] ${message}`, detail !== undefined ? detail : "");
}

export function logWarn(module: string, message: string, extra?: Record<string, unknown>): void {
  console.warn(`[${module}] ${message}`, extra ?? "");
}
