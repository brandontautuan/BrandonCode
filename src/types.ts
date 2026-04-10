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
}
