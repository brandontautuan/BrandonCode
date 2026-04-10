import fs from "node:fs";
import path from "node:path";
import { getBrandonConfigDir } from "../config/configPaths.js";

/**
 * Resolve preset id: `BRANDON_BANNER_THEME` env, then optional `~/.brandon-code/banner-theme.json` `{ "preset": "ocean" }`.
 */
export function resolveBannerThemeName(): string {
  const env = process.env.BRANDON_BANNER_THEME?.trim();
  if (env) return env;
  try {
    const p = path.join(getBrandonConfigDir(), "banner-theme.json");
    if (!fs.existsSync(p)) return "default";
    const raw = fs.readFileSync(p, "utf8");
    const o = JSON.parse(raw) as { preset?: string };
    if (typeof o.preset === "string" && o.preset.trim()) return o.preset.trim();
  } catch {
    /* ignore malformed optional file */
  }
  return "default";
}
