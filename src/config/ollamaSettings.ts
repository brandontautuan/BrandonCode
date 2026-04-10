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
}> {
  try {
    const p = path.join(os.homedir(), ".brandoncode", "config.json");
    if (!fs.existsSync(p)) return {};
    const raw = fs.readFileSync(p, "utf8");
    const o = JSON.parse(raw) as Record<string, unknown>;
    return {
      ...(typeof o.ollamaHost === "string" ? { ollamaHost: o.ollamaHost } : {}),
      ...(typeof o.ollamaModel === "string" ? { ollamaModel: o.ollamaModel } : {}),
    };
  } catch {
    return {};
  }
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
