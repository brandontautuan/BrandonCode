import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("worker", () => {
  it("does not reference loadContext (no hidden context load)", () => {
    const url = new URL("./worker.ts", import.meta.url);
    const src = fs.readFileSync(url, "utf8");
    expect(src).not.toMatch(/\bloadContext\b/);
  });
});
