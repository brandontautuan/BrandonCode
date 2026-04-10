import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("store", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bc-cli-"));
    process.env.BRANDON_CODE_CONFIG_DIR = tmpDir;
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.BRANDON_CODE_CONFIG_DIR;
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("mergeModels includes built-ins", async () => {
    const { mergeModels, resetStoreForTests } = await import("./store.js");
    resetStoreForTests();
    const ids = mergeModels().map((m) => m.id);
    expect(ids).toContain("gemini-3-pro");
    expect(ids).toContain("ollama/qwen2.5-coder:14b");
  });

  it("addCustomModel rejects duplicate id", async () => {
    const { addCustomModel, resetStoreForTests } = await import("./store.js");
    resetStoreForTests();
    addCustomModel({ id: "my-model", label: "Mine" });
    expect(() => addCustomModel({ id: "my-model", label: "Again" })).toThrow(
      /already exists/
    );
  });

  it("removeModel hides built-in with force", async () => {
    const { mergeModels, removeModel, resetStoreForTests } = await import(
      "./store.js"
    );
    resetStoreForTests();
    expect(mergeModels().some((m) => m.id === "minimax-m2.5")).toBe(true);
    removeModel("minimax-m2.5", true);
    expect(mergeModels().some((m) => m.id === "minimax-m2.5")).toBe(false);
  });

  it("ensureValidActiveModel resets invalid active id", async () => {
    const {
      ensureValidActiveModel,
      getActiveModelId,
      getStore,
      resetStoreForTests,
    } = await import("./store.js");
    resetStoreForTests();
    getStore().set("activeModel", "not-a-real-id");
    ensureValidActiveModel();
    expect(getActiveModelId()).toBe("gemini-3-pro");
  });
});
