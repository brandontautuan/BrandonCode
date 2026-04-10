import chalk from "chalk";
import { createInterface } from "node:readline/promises";
import { mergeModels, setActiveModel } from "../config/store.js";

export type ModelPickOptions = {
  stdin?: NodeJS.ReadStream;
  stdout?: NodeJS.WriteStream;
};

/**
 * Interactive numbered model picker. On non-TTY stdin, prints guidance and sets exit code 1.
 */
export async function cmdModelPick(opts: ModelPickOptions = {}): Promise<void> {
  const stdin = opts.stdin ?? process.stdin;
  const stdout = opts.stdout ?? process.stdout;

  if (!stdin.isTTY || !stdout.isTTY) {
    console.error(
      chalk.yellow(
        "Interactive model picker requires a TTY. Use non-interactive commands instead:"
      )
    );
    console.error(chalk.dim("  brandon model list"));
    console.error(chalk.dim("  brandon model switch <id>"));
    console.error(
      chalk.dim("  npm run pick-model   # when attached to a terminal")
    );
    process.exitCode = 1;
    return;
  }

  const models = mergeModels().sort((a, b) => a.id.localeCompare(b.id));
  if (models.length === 0) {
    console.error(chalk.red("No models available."));
    process.exitCode = 1;
    return;
  }

  stdout.write(chalk.cyan("Pick a model by number:\n\n"));
  for (let i = 0; i < models.length; i++) {
    const m = models[i]!;
    const tag = m.builtin ? chalk.dim("built-in") : chalk.cyan("custom");
    stdout.write(
      `${chalk.bold(String(i + 1))}. ${chalk.bold(m.id)}  ${tag}  ${m.label}\n`
    );
  }
  stdout.write("\n");

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const line = (await rl.question("Enter number (or q to cancel): ")).trim();
    if (line.toLowerCase() === "q") {
      stdout.write(chalk.dim("Cancelled.\n"));
      return;
    }
    if (line === "") {
      stdout.write(chalk.dim("Cancelled.\n"));
      return;
    }
    const n = parseInt(line, 10);
    if (!Number.isFinite(n) || n < 1 || n > models.length) {
      console.error(chalk.red(`Invalid choice: ${line}`));
      process.exitCode = 1;
      return;
    }
    const chosen = models[n - 1]!;
    setActiveModel(chosen.id);
    stdout.write(chalk.green(`Active model: ${chosen.id}\n`));
  } finally {
    rl.close();
  }
}
