import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("resolveActivityMode", () => {
  let tmpDir: string;
  let prev: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bc-obs-"));
    process.env.BRANDON_CODE_CONFIG_DIR = tmpDir;
    prev = process.env.BRANDON_ACTIVITY;
    delete process.env.BRANDON_ACTIVITY;
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.BRANDON_CODE_CONFIG_DIR;
    if (prev === undefined) delete process.env.BRANDON_ACTIVITY;
    else process.env.BRANDON_ACTIVITY = prev;
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("uses override when provided", async () => {
    const { resolveActivityMode } = await import("./observabilitySettings.js");
    expect(resolveActivityMode("verbose")).toBe("verbose");
  });

  it("respects BRANDON_ACTIVITY", async () => {
    process.env.BRANDON_ACTIVITY = "verbose";
    const { resolveActivityMode } = await import("./observabilitySettings.js");
    expect(resolveActivityMode()).toBe("verbose");
  });

  it("reads activity from config file", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "config.json"),
      JSON.stringify({
        activeModel: "gemini-3-pro",
        customModels: [],
        hiddenBuiltinIds: [],
        activity: "verbose",
      }),
      "utf8"
    );
    const { resetStoreForTests } = await import("./store.js");
    resetStoreForTests();
    const { resolveActivityMode } = await import("./observabilitySettings.js");
    expect(resolveActivityMode()).toBe("verbose");
  });
});
