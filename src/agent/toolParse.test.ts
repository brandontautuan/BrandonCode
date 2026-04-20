import { describe, expect, it } from "vitest";
import { parseInlineToolCallContent } from "./toolParse.js";

describe("parseInlineToolCallContent", () => {
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
});
