import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("cmdModelPick", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bc-pick-"));
    process.env.BRANDON_CODE_CONFIG_DIR = tmpDir;
    vi.resetModules();
    process.exitCode = undefined;
  });

  afterEach(() => {
    delete process.env.BRANDON_CODE_CONFIG_DIR;
    process.exitCode = undefined;
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("sets exit code 1 when stdin is not a TTY", async () => {
    const { resetStoreForTests } = await import("../config/store.js");
    const { cmdModelPick } = await import("./modelPicker.js");
    resetStoreForTests();

    const stdin = new PassThrough() as unknown as NodeJS.ReadStream;
    const stdout = new PassThrough() as unknown as NodeJS.WriteStream;
    stdin.isTTY = false;
    stdout.isTTY = true;

    vi.spyOn(console, "error").mockImplementation(() => {});

    await cmdModelPick({ stdin, stdout });
    expect(process.exitCode).toBe(1);
  });

  it("selects model by number on TTY streams", async () => {
    const { resetStoreForTests, getActiveModelId } = await import(
      "../config/store.js"
    );
    const { cmdModelPick } = await import("./modelPicker.js");
    resetStoreForTests();

    const stdin = new PassThrough() as unknown as NodeJS.ReadStream & {
      isTTY?: boolean;
    };
    const stdout = new PassThrough() as unknown as NodeJS.WriteStream & {
      isTTY?: boolean;
    };
    stdin.isTTY = true;
    stdout.isTTY = true;

    const pickPromise = cmdModelPick({ stdin, stdout });
    stdin.write("1\n");
    await pickPromise;

    const models = (await import("../config/store.js")).mergeModels();
    expect(getActiveModelId()).toBe(models.sort((a, b) => a.id.localeCompare(b.id))[0]?.id);
  });
});
