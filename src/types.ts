export type ModelMode = "local" | "cloud";

export interface ModelEntry {
  id: string;
  label: string;
  builtin?: boolean;
  provider?: string;
  mode?: ModelMode;
}

export interface ConfigSchema {
  activeModel: string;
  customModels: ModelEntry[];
  /** Built-in IDs suppressed via `model remove <id> --force-default`. */
  hiddenBuiltinIds?: string[];
  /** Ollama API base URL (e.g. `http://127.0.0.1:11434`). */
  ollamaHost?: string;
  /** Ollama model name for the agent REPL (e.g. `qwen2.5-coder:7b`). */
  ollamaModel?: string;
}
