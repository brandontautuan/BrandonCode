import Conf from "conf";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  BUILTIN_MODELS,
  DEFAULT_ACTIVE_MODEL_ID,
} from "./defaultModels.js";
import type { ConfigSchema, ModelEntry } from "../types.js";

function getConfigDir(): string {
  return process.env.BRANDON_CODE_CONFIG_DIR
    ? path.resolve(process.env.BRANDON_CODE_CONFIG_DIR)
    : path.join(os.homedir(), ".brandon-code");
}

function getConfigFile(): string {
  return path.join(getConfigDir(), "config.json");
}

function ensureDir(): void {
  fs.mkdirSync(getConfigDir(), { recursive: true });
}

function readFileConfig(): ConfigSchema | null {
  try {
    const raw = fs.readFileSync(getConfigFile(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    const activeModel =
      typeof o.activeModel === "string" ? o.activeModel : DEFAULT_ACTIVE_MODEL_ID;
    const customModels = Array.isArray(o.customModels)
      ? (o.customModels as ModelEntry[]).filter(
          (m) => m && typeof m.id === "string" && typeof m.label === "string"
        )
      : [];
    const hiddenBuiltinIds = Array.isArray(o.hiddenBuiltinIds)
      ? (o.hiddenBuiltinIds as string[]).filter((id) => typeof id === "string")
      : [];
    const ollamaHost =
      typeof o.ollamaHost === "string" ? o.ollamaHost : undefined;
    const ollamaModel =
      typeof o.ollamaModel === "string" ? o.ollamaModel : undefined;
    const plannerModel =
      typeof o.plannerModel === "string" ? o.plannerModel : undefined;
    const workerModel =
      typeof o.workerModel === "string" ? o.workerModel : undefined;
    const greetingRotationIndex =
      typeof o.greetingRotationIndex === "number" &&
      Number.isInteger(o.greetingRotationIndex) &&
      o.greetingRotationIndex >= 0
        ? o.greetingRotationIndex
        : undefined;
    let ollamaThink: ConfigSchema["ollamaThink"];
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
      activeModel,
      customModels,
      hiddenBuiltinIds,
      ...(ollamaHost !== undefined ? { ollamaHost } : {}),
      ...(ollamaModel !== undefined ? { ollamaModel } : {}),
      ...(plannerModel !== undefined ? { plannerModel } : {}),
      ...(workerModel !== undefined ? { workerModel } : {}),
      ...(greetingRotationIndex !== undefined
        ? { greetingRotationIndex }
        : {}),
      ...(ollamaThink !== undefined ? { ollamaThink } : {}),
    };
  } catch {
    return null;
  }
}

function writeFileConfig(data: ConfigSchema): void {
  ensureDir();
  fs.writeFileSync(getConfigFile(), JSON.stringify(data, null, 2), "utf8");
}

function createConf(): Conf<ConfigSchema> {
  const defaults: ConfigSchema = {
    activeModel: DEFAULT_ACTIVE_MODEL_ID,
    customModels: [],
    hiddenBuiltinIds: [],
    ollamaHost: "http://127.0.0.1:11434",
    ollamaModel: "qwen2.5-coder:7b",
    greetingRotationIndex: 0,
    ollamaThink: true,
  };

  try {
    return new Conf<ConfigSchema>({
      projectName: "brandon-code",
      cwd: getConfigDir(),
      configName: "config",
      defaults,
    });
  } catch {
    const existing = readFileConfig();
    const merged: ConfigSchema = existing ?? {
      activeModel: DEFAULT_ACTIVE_MODEL_ID,
      customModels: [],
      hiddenBuiltinIds: [],
      ollamaHost: "http://127.0.0.1:11434",
      ollamaModel: "qwen2.5-coder:7b",
      greetingRotationIndex: 0,
      ollamaThink: true,
    };
    writeFileConfig(merged);
    return new Conf<ConfigSchema>({
      projectName: "brandon-code",
      cwd: getConfigDir(),
      configName: "config",
      defaults,
    });
  }
}

let cached: Conf<ConfigSchema> | null = null;

/** Test helper: reset singleton so a new Conf is created (e.g. after env change). */
export function resetStoreForTests(): void {
  cached = null;
}

export function getStore(): Conf<ConfigSchema> {
  if (!cached) {
    try {
      cached = createConf();
    } catch {
      const fallback: ConfigSchema = readFileConfig() ?? {
        activeModel: DEFAULT_ACTIVE_MODEL_ID,
        customModels: [],
        hiddenBuiltinIds: [],
        ollamaHost: "http://127.0.0.1:11434",
        ollamaModel: "qwen2.5-coder:7b",
        greetingRotationIndex: 0,
        ollamaThink: true,
      };
      writeFileConfig(fallback);
      cached = createConf();
    }
  }
  return cached;
}

export function builtinIds(): Set<string> {
  return new Set(BUILTIN_MODELS.map((m) => m.id));
}

export function mergeModels(): ModelEntry[] {
  const store = getStore();
  const custom = store.get("customModels") ?? [];
  const hidden = new Set(store.get("hiddenBuiltinIds") ?? []);
  const byId = new Map<string, ModelEntry>();
  for (const m of BUILTIN_MODELS) {
    if (hidden.has(m.id)) continue;
    byId.set(m.id, { ...m });
  }
  for (const m of custom) {
    byId.set(m.id, { ...m, builtin: false });
  }
  return [...byId.values()];
}

export function getModelById(id: string): ModelEntry | undefined {
  return mergeModels().find((m) => m.id === id);
}

export function setActiveModel(id: string): void {
  const store = getStore();
  store.set("activeModel", id);
}

export function getActiveModelId(): string {
  return getStore().get("activeModel");
}

/** If active id is missing from merged list (e.g. hidden builtin), reset to default. */
export function ensureValidActiveModel(): void {
  const id = getActiveModelId();
  if (!getModelById(id)) {
    setActiveModel(DEFAULT_ACTIVE_MODEL_ID);
  }
}

export function addCustomModel(entry: ModelEntry): void {
  const store = getStore();
  const custom = [...(store.get("customModels") ?? [])];
  if (custom.some((m) => m.id === entry.id)) {
    throw new Error(`Model id already exists: ${entry.id}`);
  }
  const hidden = new Set(store.get("hiddenBuiltinIds") ?? []);
  if (builtinIds().has(entry.id) && !hidden.has(entry.id)) {
    throw new Error(`Model id already exists: ${entry.id}`);
  }
  custom.push({
    id: entry.id,
    label: entry.label,
    ...(entry.provider ? { provider: entry.provider } : {}),
    ...(entry.mode ? { mode: entry.mode } : {}),
  });
  store.set("customModels", custom);
}

export function removeModel(id: string, forceDefault: boolean): void {
  const store = getStore();
  const isBuiltin = builtinIds().has(id);

  if (isBuiltin && !forceDefault) {
    throw new Error(
      `Cannot remove built-in model "${id}". Pass --force-default to hide it from your list.`
    );
  }

  if (isBuiltin && forceDefault) {
    const hidden = new Set(store.get("hiddenBuiltinIds") ?? []);
    hidden.add(id);
    store.set("hiddenBuiltinIds", [...hidden]);
  } else {
    const custom = (store.get("customModels") ?? []).filter((m) => m.id !== id);
    store.set("customModels", custom);
  }

  if (getActiveModelId() === id) {
    store.set("activeModel", DEFAULT_ACTIVE_MODEL_ID);
  }
}

export function getConfigPath(): string {
  return getConfigFile();
}
