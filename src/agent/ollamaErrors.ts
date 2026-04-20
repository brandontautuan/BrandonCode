/** True when Ollama rejects a request because the model does not support `think`. */
export function isThinkUnsupportedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /does not support thinking/i.test(msg);
}
