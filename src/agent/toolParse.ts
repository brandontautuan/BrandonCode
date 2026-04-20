import type { ToolCall } from "ollama";

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
