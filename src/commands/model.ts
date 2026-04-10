import chalk from "chalk";
import os from "node:os";
import type { ModelMode } from "../types.js";
import {
  addCustomModel,
  getActiveModelId,
  getModelById,
  mergeModels,
  removeModel,
  setActiveModel,
} from "../config/store.js";

function warnHeavyLocalIfNeeded(id: string, mode: string | undefined): void {
  const ram = os.totalmem();
  const roughlyUnder24G = ram < 24 * 1024 ** 3;
  if (!roughlyUnder24G || mode !== "local") return;
  const looksHeavy =
    /qwen3-coder/i.test(id) && !/:(7|8)b/i.test(id) && !/small/i.test(id);
  if (looksHeavy) {
    console.warn(
      chalk.yellow(
        "Tip: large local coder models often need 24GB+ VRAM/RAM headroom. Try `ollama/qwen2.5-coder:7b` if this feels slow."
      )
    );
  }
}

export function cmdModelList(): void {
  const models = mergeModels().sort((a, b) => a.id.localeCompare(b.id));
  for (const m of models) {
    const tag = m.builtin ? chalk.dim("built-in") : chalk.cyan("custom");
    const mode = m.mode ? chalk.dim(` ${m.mode}`) : "";
    console.log(`${chalk.bold(m.id)}${mode}  ${tag}  ${m.label}`);
  }
}

export function cmdModelCurrent(): void {
  const id = getActiveModelId();
  const m = getModelById(id);
  if (!m) {
    console.log(chalk.yellow(`Active model id "${id}" is unknown; reset to default on next command.`));
    return;
  }
  console.log(chalk.bold(m.id));
  console.log(m.label);
}

export function cmdModelSwitch(id: string): void {
  const m = getModelById(id);
  if (!m) {
    const ids = mergeModels()
      .map((x) => x.id)
      .sort()
      .join(", ");
    console.error(chalk.red(`Unknown model: ${id}`));
    console.error(chalk.dim(`Valid: ${ids}`));
    process.exitCode = 1;
    return;
  }
  setActiveModel(id);
  warnHeavyLocalIfNeeded(id, m.mode);
  console.log(chalk.green(`Active model: ${id}`));
}

export function cmdModelAdd(
  id: string,
  opts: { label?: string; provider?: string; mode?: ModelMode }
): void {
  const label = opts.label?.trim();
  if (!label) {
    console.error(chalk.red("Missing --label <name>"));
    process.exitCode = 1;
    return;
  }
  try {
    addCustomModel({
      id,
      label,
      builtin: false,
      ...(opts.provider ? { provider: opts.provider } : {}),
      ...(opts.mode ? { mode: opts.mode } : {}),
    });
    console.log(chalk.green(`Added model: ${id}`));
  } catch (e) {
    console.error(chalk.red(e instanceof Error ? e.message : String(e)));
    process.exitCode = 1;
  }
}

export function cmdModelRemove(id: string, forceDefault: boolean): void {
  try {
    removeModel(id, forceDefault);
    console.log(chalk.green(`Removed: ${id}`));
  } catch (e) {
    console.error(chalk.red(e instanceof Error ? e.message : String(e)));
    process.exitCode = 1;
  }
}
