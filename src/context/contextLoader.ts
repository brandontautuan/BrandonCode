import fs from "node:fs";
import { agentMdPath } from "./paths.js";

let lastLoaded = "";

/**
 * Read `context/agent.md` from the current working tree (or `BRANDON_CODE_CONTEXT_ROOT`).
 * Returns empty string if missing or unreadable — never throws for “no file”.
 */
export function loadContext(): string {
  try {
    const p = agentMdPath();
    if (!fs.existsSync(p)) {
      lastLoaded = "";
      return "";
    }
    const text = fs.readFileSync(p, "utf8");
    lastLoaded = text;
    return text;
  } catch {
    lastLoaded = "";
    return "";
  }
}

/** Last successful `loadContext()` result (may be empty). */
export function getLoadedContext(): string {
  return lastLoaded;
}
