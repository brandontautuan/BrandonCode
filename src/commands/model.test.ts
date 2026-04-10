import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("model commands", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bc-model-cmd-"));
    process.env.BRANDON_CODE_CONFIG_DIR = tmpDir;
    vi.resetModules();
    process.exitCode = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.BRANDON_CODE_CONFIG_DIR;
    process.exitCode = undefined;
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("cmdModelList prints built-in ids", async () => {
    const { resetStoreForTests } = await import("../config/store.js");
    const { cmdModelList } = await import("./model.js");
    resetStoreForTests();

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    cmdModelList();

    const joined = logs.join("\n");
    expect(joined).toContain("gemini-3-pro");
    expect(joined).toContain("built-in");
  });

  it("cmdModelCurrent prints active model", async () => {
    const { resetStoreForTests, setActiveModel } = await import("../config/store.js");
    const { cmdModelCurrent } = await import("./model.js");
    resetStoreForTests();
    setActiveModel("minimax-m2.7");

    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });

    cmdModelCurrent();

    expect(logs[0]).toContain("minimax-m2.7");
    expect(logs[1]).toMatch(/MiniMax/i);
  });

  it("cmdModelSwitch sets active and logs success", async () => {
    const { getActiveModelId, resetStoreForTests } = await import("../config/store.js");
    const { cmdModelSwitch } = await import("./model.js");
    resetStoreForTests();

    vi.spyOn(console, "log").mockImplementation(() => {});
    cmdModelSwitch("ollama/qwen2.5-coder:7b");

    expect(getActiveModelId()).toBe("ollama/qwen2.5-coder:7b");
    expect(process.exitCode).toBeUndefined();
  });

  it("cmdModelSwitch unknown id sets exit code 1", async () => {
    const { resetStoreForTests } = await import("../config/store.js");
    const { cmdModelSwitch } = await import("./model.js");
    resetStoreForTests();

    vi.spyOn(console, "error").mockImplementation(() => {});
    cmdModelSwitch("not-a-real-model");

    expect(process.exitCode).toBe(1);
  });

  it("cmdModelAdd adds custom model", async () => {
    const { mergeModels, resetStoreForTests } = await import("../config/store.js");
    const { cmdModelAdd } = await import("./model.js");
    resetStoreForTests();

    vi.spyOn(console, "log").mockImplementation(() => {});
    cmdModelAdd("my-custom", {
      label: "My Custom",
      provider: "ollama",
      mode: "local",
    });

    const ids = mergeModels().map((m) => m.id);
    expect(ids).toContain("my-custom");
    expect(process.exitCode).toBeUndefined();
  });

  it("cmdModelAdd without label sets exit code 1", async () => {
    const { resetStoreForTests } = await import("../config/store.js");
    const { cmdModelAdd } = await import("./model.js");
    resetStoreForTests();

    vi.spyOn(console, "error").mockImplementation(() => {});
    cmdModelAdd("x", {});

    expect(process.exitCode).toBe(1);
  });

  it("cmdModelRemove removes custom model", async () => {
    const { addCustomModel, mergeModels, resetStoreForTests } = await import(
      "../config/store.js"
    );
    const { cmdModelRemove } = await import("./model.js");
    resetStoreForTests();
    addCustomModel({ id: "tmp-id", label: "Temp" });

    vi.spyOn(console, "log").mockImplementation(() => {});
    cmdModelRemove("tmp-id", false);

    expect(mergeModels().some((m) => m.id === "tmp-id")).toBe(false);
  });

  it("cmdModelRemove built-in without force errors", async () => {
    const { resetStoreForTests } = await import("../config/store.js");
    const { cmdModelRemove } = await import("./model.js");
    resetStoreForTests();

    vi.spyOn(console, "error").mockImplementation(() => {});
    cmdModelRemove("gemini-3-pro", false);

    expect(process.exitCode).toBe(1);
  });
});
