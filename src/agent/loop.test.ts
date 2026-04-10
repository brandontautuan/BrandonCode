import fs from "node:fs";
import { describe, expect, it } from "vitest";
import type { ToolCall } from "ollama";
import {
  MAX_TOOL_ROUNDS_PER_TURN,
  parseInlineToolCallContent,
  shouldEnableToolsForInput,
  splitToolCalls,
} from "./loop.js";

describe("agent loop helpers", () => {
  it("parses inline tool-call JSON content", () => {
    const calls = parseInlineToolCallContent(
      '{"name":"run_bash","arguments":{"command":"echo hi"}}'
    );
    expect(calls).toBeDefined();
    expect(calls?.[0]?.function?.name).toBe("run_bash");
    expect(calls?.[0]?.function?.arguments).toEqual({ command: "echo hi" });
  });

  it("returns undefined for non-tool JSON content", () => {
    expect(parseInlineToolCallContent("hello world")).toBeUndefined();
    expect(parseInlineToolCallContent('{"foo":"bar"}')).toBeUndefined();
  });

  it("splits runnable and unknown tool names", () => {
    const calls: ToolCall[] = [
      { function: { name: "read_file", arguments: { path: "a.txt" } } },
      { function: { name: "agent", arguments: {} } },
      { function: { name: "run_bash", arguments: { command: "pwd" } } },
    ];

    const { runnable, unknownNames } = splitToolCalls(calls);
    expect(runnable.map((c) => c.function.name)).toEqual([
      "read_file",
      "run_bash",
    ]);
    expect(unknownNames).toEqual(["agent"]);
  });

  it("keeps a sane per-turn tool safety cap", () => {
    expect(MAX_TOOL_ROUNDS_PER_TURN).toBeGreaterThan(0);
    expect(MAX_TOOL_ROUNDS_PER_TURN).toBeLessThanOrEqual(16);
  });

  it("enables tools only for explicit tool-like requests", () => {
    expect(shouldEnableToolsForInput("yo hello")).toBe(false);
    expect(shouldEnableToolsForInput("please run `ls -la`")).toBe(true);
    expect(shouldEnableToolsForInput("read file src/index.ts")).toBe(true);
  });

  it("routes normal turns through runPipeline (no legacy chat path)", () => {
    const url = new URL("./loop.ts", import.meta.url);
    const src = fs.readFileSync(url, "utf8");
    expect(src).toContain('from "./pipeline.js"');
    expect(src).toContain("runPipeline(");
    expect(src).not.toContain("runChatUntilNoTools");
    expect(src).not.toContain("streamOneTurn");
  });
});
