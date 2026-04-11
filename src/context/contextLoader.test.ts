import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("ensureAgentContextFile", () => {
  let tmp: string;
  let prevRoot: string | undefined;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bc-ctx-"));
    prevRoot = process.env.BRANDON_CODE_CONTEXT_ROOT;
    process.env.BRANDON_CODE_CONTEXT_ROOT = tmp;
    vi.resetModules();
  });

  afterEach(() => {
    if (prevRoot === undefined) delete process.env.BRANDON_CODE_CONTEXT_ROOT;
    else process.env.BRANDON_CODE_CONTEXT_ROOT = prevRoot;
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("creates context/agent.md with What NOT to do when missing", async () => {
    const { ensureAgentContextFile, loadContext } = await import(
      "./contextLoader.js"
    );
    expect(ensureAgentContextFile()).toBe(true);
    const p = path.join(tmp, "context", "agent.md");
    expect(fs.existsSync(p)).toBe(true);
    const text = loadContext();
    expect(text).toMatch(/What NOT to do/);
    expect(text).toMatch(/Don't commit API keys/i);
    expect(ensureAgentContextFile()).toBe(false);
  });
});
