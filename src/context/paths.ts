import fs from "node:fs";
import path from "node:path";

/** Override for tests: absolute path to a directory containing `context/`. */
export function getContextBaseDir(): string {
  return process.env.BRANDON_CODE_CONTEXT_ROOT ?? process.cwd();
}

export function agentMdPath(): string {
  return path.join(getContextBaseDir(), "context", "agent.md");
}

export function decisionsMdPath(): string {
  return path.join(getContextBaseDir(), "context", "decisions.md");
}

export function sessionMdPath(date = todayIsoDate()): string {
  return path.join(getContextBaseDir(), "context", "sessions", `${date}.md`);
}

export function ensureContextDirs(): void {
  const sessionsDir = path.join(getContextBaseDir(), "context", "sessions");
  fs.mkdirSync(sessionsDir, { recursive: true });
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
