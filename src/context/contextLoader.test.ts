import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("contextLoader", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bc-ctx-"));
    process.env.BRANDON_CODE_CONTEXT_ROOT = tmp;
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.BRANDON_CODE_CONTEXT_ROOT;
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("loadContext returns empty string when agent.md is missing", async () => {
    const { loadContext } = await import("./contextLoader.js");
    expect(loadContext()).toBe("");
  });

  it("loadContext reads agent.md when present", async () => {
    const dir = path.join(tmp, "context");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "agent.md"), "# Hello\n", "utf8");
    vi.resetModules();
    const { loadContext } = await import("./contextLoader.js");
    expect(loadContext().trim()).toBe("# Hello");
  });
});
