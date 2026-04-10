import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Config directory for `~/.brandon-code` (or `BRANDON_CODE_CONFIG_DIR`).
 * Duplicated from store logic intentionally so additive Phase 6 modules avoid editing `store.ts`.
 */
export function getBrandonConfigDir(): string {
  return process.env.BRANDON_CODE_CONFIG_DIR
    ? path.resolve(process.env.BRANDON_CODE_CONFIG_DIR)
    : path.join(os.homedir(), ".brandon-code");
}

/**
 * Optional per-project override file (primary `.brandon-code`, legacy `.brandoncode`).
 */
export function projectModelJsonPaths(cwd: string): string[] {
  return [
    path.join(cwd, ".brandon-code", "project.json"),
    path.join(cwd, ".brandoncode", "project.json"),
  ];
}

export function readJsonFileIfExists(filePath: string): unknown | undefined {
  try {
    if (!fs.existsSync(filePath)) return undefined;
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}
