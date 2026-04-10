import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function runCli(args: string[], env: NodeJS.ProcessEnv): string {
  const cli = path.join(projectRoot, "dist/index.js");
  return execFileSync(process.execPath, [cli, ...args], {
    cwd: projectRoot,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

describe("CLI integration", () => {
  let tmpDir: string;

  beforeAll(() => {
    execSync("npm run build", { cwd: projectRoot, stdio: "pipe" });
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bc-int-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("model list with --no-banner does not print boxed banner", () => {
    const out = runCli(["--no-banner", "model", "list"], {
      BRANDON_CODE_CONFIG_DIR: tmpDir,
    });
    const first = out.trim().split("\n")[0] ?? "";
    expect(first).not.toMatch(/^\+-+\+$/);
    expect(out).toContain("gemini-3-pro");
  });

  it("model list without --no-banner starts with boxed banner top border", () => {
    const out = runCli(["model", "list"], {
      BRANDON_CODE_CONFIG_DIR: tmpDir,
    });
    const first = out.split("\n")[0] ?? "";
    expect(first.trim()).toMatch(/^\+-+\+$/);
  });

  it("model switch then model current persists active id", () => {
    const env = { BRANDON_CODE_CONFIG_DIR: tmpDir };
    runCli(["--no-banner", "model", "switch", "minimax-m2.5"], env);
    const out = runCli(["--no-banner", "model", "current"], env);
    expect(out).toContain("minimax-m2.5");
  });

  it("model add and list includes custom id", () => {
    const env = { BRANDON_CODE_CONFIG_DIR: tmpDir };
    runCli(
      ["--no-banner", "model", "add", "custom-x", "--label", "Custom X"],
      env
    );
    const out = runCli(["--no-banner", "model", "list"], env);
    expect(out).toContain("custom-x");
    expect(out).toContain("custom");
  });
});
