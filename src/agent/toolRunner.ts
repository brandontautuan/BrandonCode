import type { ToolCall } from "ollama";
import { readFileTool, runBashTool, writeFileTool } from "./tools.js";

function parseToolArgs(tc: ToolCall): Record<string, unknown> {
  const raw = tc.function?.arguments as unknown;
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") return raw as Record<string, unknown>;
  return {};
}

/**
 * Execute a single tool call from the model and return text for the next chat turn.
 */
export async function executeToolCall(tc: ToolCall): Promise<string> {
  const name = tc.function?.name ?? "";
  const args = parseToolArgs(tc);

  try {
    switch (name) {
      case "read_file": {
        const p = String(args.path ?? "");
        if (!p) return "Error: read_file requires path";
        const text = await readFileTool(p);
        return text.length > 80_000
          ? text.slice(0, 80_000) + "\n… [truncated]"
          : text;
      }
      case "write_file": {
        const p = String(args.path ?? "");
        const content = String(args.content ?? "");
        if (!p) return "Error: write_file requires path and content";
        return await writeFileTool(p, content);
      }
      case "run_bash": {
        const cmd = String(args.command ?? "");
        if (!cmd) return "Error: run_bash requires command";
        return await runBashTool(cmd);
      }
      default:
        return `Error: unknown tool ${name}`;
    }
  } catch (e) {
    return `Error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

export async function executeToolCalls(calls: ToolCall[]): Promise<string> {
  const parts: string[] = [];
  for (const tc of calls) {
    const name = tc.function?.name ?? "tool";
    const out = await executeToolCall(tc);
    parts.push(`### ${name}\n${out}`);
  }
  return parts.join("\n\n");
}
