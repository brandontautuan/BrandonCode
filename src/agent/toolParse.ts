import type { ToolCall } from "ollama";

export const ALLOWED_TOOL_NAMES = new Set(["read_file", "write_file", "run_bash"]);

export function parseInlineToolCallContent(
  content: string
): ToolCall[] | undefined {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{")) return undefined;

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const name = parsed.name;
    const args = parsed.arguments;
    if (
      typeof name === "string" &&
      args != null &&
      typeof args === "object" &&
      !Array.isArray(args)
    ) {
      return [
        {
          function: {
            name,
            arguments: args as Record<string, unknown>,
          },
        },
      ];
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export function splitToolCalls(
  calls: ToolCall[]
): { runnable: ToolCall[]; unknownNames: string[] } {
  const runnable: ToolCall[] = [];
  const unknownNames: string[] = [];
  for (const tc of calls) {
    const name = tc.function?.name ?? "";
    if (!name) continue;
    if (ALLOWED_TOOL_NAMES.has(name)) {
      runnable.push(tc);
    } else {
      unknownNames.push(name);
    }
  }
  return { runnable, unknownNames };
}
