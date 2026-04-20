import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("agent loop", () => {
  it("routes normal turns through runPipeline (no legacy chat path)", () => {
    const url = new URL("./loop.ts", import.meta.url);
    const src = fs.readFileSync(url, "utf8");
    expect(src).toContain('from "./pipeline.js"');
    expect(src).toContain("runPipeline(");
    expect(src).not.toContain("runChatUntilNoTools");
    expect(src).not.toContain("streamOneTurn");
  });
});
