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
  /** Planner step model; defaults to `workerModel` when unset. */
  plannerModel?: string;
  /** Worker step model; defaults to `ollamaModel` when unset. */
  workerModel?: string;
  /** Next index into `GREETINGS` for rotating agent REPL welcome lines (persisted). */
  greetingRotationIndex?: number;
  /**
   * Ollama extended thinking: `true` or a level if the model supports it; `false` to disable.
   * See https://github.com/ollama/ollama-js — `think` on chat requests.
   */
  ollamaThink?: boolean | "high" | "medium" | "low";
  /**
   * REPL pipeline activity: concise (default) = short stage lines; verbose = extra detail + full errors.
   * Override with `BRANDON_ACTIVITY=verbose` or `--activity-diagnostics` on `brandon agent`.
   */
  activity?: "concise" | "verbose";
}
