import fs from "node:fs";
import path from "node:path";
import { getBrandonConfigDir } from "./configPaths.js";
import {
  parseProviderProfilesJson,
  type ProviderProfilesFile,
} from "./providerProfiles.js";

const FILE_NAME = "provider-profiles.json";

export function getProviderProfilesPath(): string {
  return path.join(getBrandonConfigDir(), FILE_NAME);
}

/**
 * Read optional `provider-profiles.json` from the config directory.
 */
export function loadProviderProfilesFromDisk():
  | { ok: true; data: ProviderProfilesFile }
  | { ok: false; errors: string[] } {
  const p = getProviderProfilesPath();
  try {
    if (!fs.existsSync(p)) {
      return { ok: true, data: { profiles: {} } };
    }
    const raw = fs.readFileSync(p, "utf8");
    return parseProviderProfilesJson(raw);
  } catch (e) {
    return {
      ok: false,
      errors: [e instanceof Error ? e.message : String(e)],
    };
  }
}
