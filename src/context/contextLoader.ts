import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { buildDefaultAgentContextMarkdown } from "./defaultAgentContextTemplate.js";
import { agentMdPath } from "./paths.js";

let lastLoaded = "";

/**
 * Create `context/agent.md` with a generic template when missing (any project cwd).
 * Idempotent. Call when starting the agent REPL, not for every CLI subcommand.
 */
export function ensureAgentContextFile(): boolean {
  try {
    const p = agentMdPath();
    if (fs.existsSync(p)) return false;
    const dir = path.dirname(p);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, buildDefaultAgentContextMarkdown(), "utf8");
    const rel = path.relative(process.cwd(), p);
    console.log(
      chalk.dim(
        `⋯ Created ${rel || p} — starter rules + placeholders; edit for this project.`
      )
    );
    return true;
  } catch {
    return false;
  }
}

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
