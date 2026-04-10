import path from "node:path";
import { mergeModels } from "./store.js";
import { projectModelJsonPaths, readJsonFileIfExists } from "./configPaths.js";

export type ProjectModelFile = {
  /** When set, overrides global active model for this project directory. */
  activeModel?: string;
};

function parseProjectFile(data: unknown): ProjectModelFile {
  if (!data || typeof data !== "object") return {};
  const o = data as Record<string, unknown>;
  const activeModel =
    typeof o.activeModel === "string" ? o.activeModel.trim() : undefined;
  return activeModel ? { activeModel } : {};
}

/**
 * Read optional per-project model id from `.brandon-code/project.json` (or legacy `.brandoncode`).
 */
export function readProjectModelOverride(cwd: string = process.cwd()): string | undefined {
  const resolved = path.resolve(cwd);
  for (const p of projectModelJsonPaths(resolved)) {
    const raw = readJsonFileIfExists(p);
    if (raw === undefined) continue;
    const { activeModel } = parseProjectFile(raw);
    if (activeModel) return activeModel;
  }
  return undefined;
}

/**
 * If project override exists and matches a known model id, return it; otherwise `globalActiveId`.
 */
export function resolveActiveModelWithProject(
  globalActiveId: string,
  cwd: string = process.cwd()
): string {
  const override = readProjectModelOverride(cwd);
  if (!override) return globalActiveId;
  const known = mergeModels().some((m) => m.id === override);
  return known ? override : globalActiveId;
}
