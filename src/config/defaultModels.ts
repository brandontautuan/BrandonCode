import type { ModelEntry } from "../types.js";

/** Built-in registry; cannot be removed without `--force-default`. */
export const BUILTIN_MODELS: readonly ModelEntry[] = [
  { id: "gemini-3-pro", label: "Gemini 3 Pro", builtin: true, provider: "google", mode: "cloud" },
  { id: "minimax-m2.5", label: "MiniMax M2.5", builtin: true, provider: "minimax", mode: "cloud" },
  { id: "minimax-m2.7", label: "MiniMax M2.7", builtin: true, provider: "minimax", mode: "cloud" },
  {
    id: "ollama/qwen2.5-coder:14b",
    label: "Ollama Qwen2.5 Coder 14B (local)",
    builtin: true,
    provider: "ollama",
    mode: "local",
  },
  {
    id: "ollama/qwen2.5-coder:7b",
    label: "Ollama Qwen2.5 Coder 7B (local)",
    builtin: true,
    provider: "ollama",
    mode: "local",
  },
  {
    id: "ollama/glm-4.7:cloud",
    label: "Ollama GLM 4.7 Cloud",
    builtin: true,
    provider: "ollama",
    mode: "cloud",
  },
] as const;

export const DEFAULT_ACTIVE_MODEL_ID = "gemini-3-pro";
