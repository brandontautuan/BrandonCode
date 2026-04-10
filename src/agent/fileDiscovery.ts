import fs from "node:fs";
import path from "node:path";
import { agentMdPath, getContextBaseDir } from "../context/paths.js";

const MAX_FILES = 5;

function safeExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function walkForBasename(
  dir: string,
  base: string,
  out: string[],
  depth: number
): void {
  if (out.length >= MAX_FILES || depth > 6) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (out.length >= MAX_FILES) break;
    if (ent.name === "node_modules" || ent.name === "dist") continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walkForBasename(full, base, out, depth + 1);
    } else if (ent.isFile() && ent.name === base) {
      out.push(full);
    }
  }
}

/**
 * Pick up to 5 relevant file paths: always `context/agent.md` and `src/index.ts` when present,
 * plus matches from user input (paths and basename search under `src/`).
 */
export function discoverRelevantFilePaths(userInput: string): string[] {
  const cwd = getContextBaseDir();
  const ordered: string[] = [];

  const always = [
    agentMdPath(),
    path.join(cwd, "src", "index.ts"),
  ];

  const seen = new Set<string>();
  function add(p: string): void {
    const resolved = path.resolve(p);
    if (!safeExists(resolved)) return;
    if (seen.has(resolved)) return;
    seen.add(resolved);
    ordered.push(resolved);
  }

  for (const p of always) {
    add(p);
    if (ordered.length >= MAX_FILES) return ordered;
  }

  const pathLike =
    userInput.match(
      /(?:\.{0,2}\/)?[\w./-]+\.(?:ts|tsx|js|jsx|json|md|mjs|cjs)/g
    ) ?? [];
  for (const t of pathLike) {
    const abs = path.resolve(cwd, t.replace(/^\.\//, ""));
    add(abs);
    if (ordered.length >= MAX_FILES) return ordered;
  }

  const words = userInput.split(/[^\w.-]+/).filter((w) => w.length >= 3);
  for (const w of words) {
    if (ordered.length >= MAX_FILES) break;
    const matches: string[] = [];
    const srcRoot = path.join(cwd, "src");
    if (fs.existsSync(srcRoot)) {
      walkForBasename(srcRoot, `${w}.ts`, matches, 0);
      walkForBasename(srcRoot, `${w}.tsx`, matches, 0);
    }
    for (const m of matches) {
      add(m);
      if (ordered.length >= MAX_FILES) return ordered;
    }
  }

  return ordered.slice(0, MAX_FILES);
}
