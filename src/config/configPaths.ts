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
