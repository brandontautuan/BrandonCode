import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("projectModelResolver", () => {
  let tmpDir: string;
  let cwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bc-proj-"));
    process.env.BRANDON_CODE_CONFIG_DIR = tmpDir;
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "bc-cwd-"));
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.BRANDON_CODE_CONFIG_DIR;
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(cwd, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("readProjectModelOverride reads .brandon-code/project.json", async () => {
    const projDir = path.join(cwd, ".brandon-code");
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(
      path.join(projDir, "project.json"),
      JSON.stringify({ activeModel: "minimax-m2.7" }),
      "utf8"
    );

    const { readProjectModelOverride } = await import(
      "./projectModelResolver.js"
    );
    expect(readProjectModelOverride(cwd)).toBe("minimax-m2.7");
  });

  it("resolveActiveModelWithProject uses override when id is known", async () => {
    const { resetStoreForTests } = await import("./store.js");
    const { resolveActiveModelWithProject } = await import(
      "./projectModelResolver.js"
    );
    resetStoreForTests();

    const projDir = path.join(cwd, ".brandoncode");
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(
      path.join(projDir, "project.json"),
      JSON.stringify({ activeModel: "gemini-3-pro" }),
      "utf8"
    );

    expect(resolveActiveModelWithProject("minimax-m2.5", cwd)).toBe(
      "gemini-3-pro"
    );
  });

  it("resolveActiveModelWithProject ignores unknown override", async () => {
    const { resetStoreForTests } = await import("./store.js");
    const { resolveActiveModelWithProject } = await import(
      "./projectModelResolver.js"
    );
    resetStoreForTests();

    const projDir = path.join(cwd, ".brandon-code");
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(
      path.join(projDir, "project.json"),
      JSON.stringify({ activeModel: "not-a-real-model-id-xyz" }),
      "utf8"
    );

    expect(resolveActiveModelWithProject("minimax-m2.5", cwd)).toBe(
      "minimax-m2.5"
    );
  });
});
