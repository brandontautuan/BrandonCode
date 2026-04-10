import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetStoreForTests } from "../config/store.js";

describe("greetings", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bc-greet-"));
    process.env.BRANDON_CODE_CONFIG_DIR = tmpDir;
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.BRANDON_CODE_CONFIG_DIR;
    resetStoreForTests();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("cycles through GREETINGS across separate imports (persisted index)", async () => {
    const { GREETINGS, nextGreeting } = await import("./greetings.js");
    expect(GREETINGS.length).toBeGreaterThan(1);
    expect(nextGreeting()).toBe(GREETINGS[0]);

    vi.resetModules();
    resetStoreForTests();
    const { nextGreeting: next2 } = await import("./greetings.js");
    expect(next2()).toBe(GREETINGS[1]);

    vi.resetModules();
    resetStoreForTests();
    const { nextGreeting: next3, resetGreetingRotationForTests } = await import(
      "./greetings.js"
    );
    resetGreetingRotationForTests();
    expect(next3()).toBe(GREETINGS[0]);
  });
});
