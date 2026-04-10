import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getStore } from "./store.js";

const DEFAULT_HOST = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "qwen2.5-coder:7b";

/** Optional legacy file from Phase 8 plan (`~/.brandoncode/config.json`). */
function readLegacyBrandoncodeFile(): Partial<{
  ollamaHost: string;
  ollamaModel: string;
  plannerModel: string;
  workerModel: string;
  ollamaThink: boolean | "high" | "medium" | "low";
}> {
  try {
    const p = path.join(os.homedir(), ".brandoncode", "config.json");
    if (!fs.existsSync(p)) return {};
    const raw = fs.readFileSync(p, "utf8");
    const o = JSON.parse(raw) as Record<string, unknown>;
    let ollamaThink: boolean | "high" | "medium" | "low" | undefined;
    if (typeof o.ollamaThink === "boolean") {
      ollamaThink = o.ollamaThink;
    } else if (
      o.ollamaThink === "high" ||
      o.ollamaThink === "medium" ||
      o.ollamaThink === "low"
    ) {
      ollamaThink = o.ollamaThink;
    }
    return {
      ...(typeof o.ollamaHost === "string" ? { ollamaHost: o.ollamaHost } : {}),
      ...(typeof o.ollamaModel === "string" ? { ollamaModel: o.ollamaModel } : {}),
      ...(typeof o.plannerModel === "string" ? { plannerModel: o.plannerModel } : {}),
      ...(typeof o.workerModel === "string" ? { workerModel: o.workerModel } : {}),
      ...(ollamaThink !== undefined ? { ollamaThink } : {}),
    };
  } catch {
    return {};
  }
}

/**
 * Value for Ollama `chat({ think })` when extended thinking is enabled.
 * Returns `undefined` to omit `think` (disabled in config or REPL flag).
 */
export function getOllamaThinkForRequest(
  enableThinking: boolean
): boolean | "high" | "medium" | "low" | undefined {
  if (!enableThinking) return undefined;
  const store = getStore();
  const legacy = readLegacyBrandoncodeFile();
  const v = store.get("ollamaThink") ?? legacy.ollamaThink ?? true;
  if (v === false) return undefined;
  if (v === true) return true;
  if (v === "high" || v === "medium" || v === "low") return v;
  return true;
}

/** Resolved Ollama host + model for the agent REPL. Primary: `~/.brandon-code/config.json`; fallback: `~/.brandoncode/config.json`. */
export function getOllamaSettings(): { host: string; model: string } {
  const store = getStore();
  const legacy = readLegacyBrandoncodeFile();
  const host =
    store.get("ollamaHost") ?? legacy.ollamaHost ?? DEFAULT_HOST;
  const model =
    store.get("ollamaModel") ?? legacy.ollamaModel ?? DEFAULT_MODEL;
  return { host, model };
}

/**
 * Planner + worker model names. `workerModel` defaults to `ollamaModel`;
 * `plannerModel` defaults to `workerModel`.
 */
export function getPipelineModels(): {
  host: string;
  plannerModel: string;
  workerModel: string;
} {
  const store = getStore();
  const legacy = readLegacyBrandoncodeFile();
  const host =
    store.get("ollamaHost") ?? legacy.ollamaHost ?? DEFAULT_HOST;
  const ollamaModel =
    store.get("ollamaModel") ?? legacy.ollamaModel ?? DEFAULT_MODEL;
  const workerModel =
    store.get("workerModel") ?? legacy.workerModel ?? ollamaModel;
  const plannerModel =
    store.get("plannerModel") ?? legacy.plannerModel ?? workerModel;
  return { host, plannerModel, workerModel };
}
