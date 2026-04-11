import chalk from "chalk";
import { Ollama } from "ollama";
import { createInterface } from "node:readline/promises";
import { getPipelineModels } from "../config/ollamaSettings.js";
import {
  isContextEmpty,
  populateContextFromCodebase,
  printLoserExit,
  promptPopulateContext,
} from "../context/contextBootstrap.js";
import { loadContext, ensureAgentContextFile } from "../context/contextLoader.js";
import { runContextFinishFlow } from "../context/contextUpdater.js";
import { nextGreeting } from "./greetings.js";
import { runPipeline } from "./pipeline.js";

export {
  parseInlineToolCallContent,
  splitToolCalls,
} from "./toolParse.js";

export const MAX_TOOL_ROUNDS_PER_TURN = 8;

function parseApproval(line: string): "y" | "n" | "e" {
  const first = line.trim().toLowerCase()[0];
  if (first === "e") return "e";
  if (first === "y") return "y";
  return "n";
}

/** Undici often reports ECONNREFUSED as the unhelpful string "fetch failed". */
function formatOllamaError(err: unknown, host: string, model: string): string {
  const msg = err instanceof Error ? err.message : String(err);
  const isConn =
    msg === "fetch failed" ||
    /fetch failed/i.test(msg) ||
    /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN/i.test(msg);
  if (!isConn) return msg;
  return [
    `Cannot reach Ollama at ${host} (${msg}).`,
    `  • Start the Ollama app (or run \`ollama serve\`) so it listens on port 11434.`,
    `  • Pull the model if you have not: \`ollama pull ${model}\``,
  ].join("\n");
}

export function shouldEnableToolsForInput(input: string): boolean {
  const s = input.trim().toLowerCase();
  if (!s) return false;
  return (
    /\b(read|open|show|cat)\b/.test(s) ||
    /\b(write|create|edit|update|save)\b/.test(s) ||
    /\b(run|execute|bash|shell|terminal|command)\b/.test(s) ||
    /\bfile\b/.test(s) ||
    /[`$]/.test(s)
  );
}

export type AgentLoopOptions = {
  /** Skip `context finish` flow on exit (non-interactive / scripting). */
  skipContextFinish?: boolean;
  /** When false, do not request or print Ollama extended thinking. */
  enableThinking?: boolean;
  /** Verbose pipeline stages + full error diagnostics (see `brandon agent --activity-diagnostics`). */
  activityDiagnostics?: boolean;
  /** Testing mode: run planner only and skip worker stage. */
  plannerOnly?: boolean;
};

export async function runAgentLoop(opts: AgentLoopOptions = {}): Promise<void> {
  const enableThinking = opts.enableThinking !== false;
  const plannerOnly = opts.plannerOnly === true;
  ensureAgentContextFile();
  const contextText = loadContext();

  const { host, workerModel } = getPipelineModels();
  const ollama = new Ollama({ host });

  try {
    await ollama.list();
  } catch (e) {
    console.error(chalk.red(formatOllamaError(e, host, workerModel)));
    process.exitCode = 1;
    return;
  }

  console.log(
    chalk.dim(
      `Ollama: ${chalk.bold(workerModel)} @ ${host} — type ${chalk.bold("exit")} to quit.`
    )
  );
  if (plannerOnly) {
    console.log(chalk.dim("Mode: planner-only testing (worker disabled)."));
  }
  console.log("");

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let loserExit = false;
  try {
    if (isContextEmpty(contextText)) {
      const populate = await promptPopulateContext(rl);
      if (!populate) {
        printLoserExit();
        loserExit = true;
        return;
      }
      try {
        await populateContextFromCodebase({
          ollama,
          model: workerModel,
          enableThinking,
        });
        loadContext();
      } catch (e) {
        console.error(chalk.red(formatOllamaError(e, host, workerModel)));
        loserExit = true;
        return;
      }
    }

    console.log(chalk.green(nextGreeting()) + "\n");

    while (true) {
      const line = await rl.question(chalk.cyan("you> "));
      const input = line.trim();
      if (!input) continue;
      if (input === "exit" || input === "quit") break;

      try {
        await runPipeline(input, {
          enableThinking,
          plannerOnly,
          activityDiagnostics: opts.activityDiagnostics,
          promptApproval: async () =>
            parseApproval(await rl.question(chalk.cyan("Apply? [y/n/e]: "))),
        });
      } catch (e) {
        console.error(chalk.red(formatOllamaError(e, host, workerModel)));
      }
    }
  } finally {
    rl.close();
  }

  if (loserExit) return;

  if (opts.skipContextFinish) {
    console.log(chalk.dim("Skipping context update (--no-context-finish)."));
    return;
  }

  await runContextFinishFlow({
    sessionNote: "Agent REPL session end",
    bullets: {
      whatWasBuilt: "- (see chat in terminal)",
      whatChanged: "- Agent REPL session",
      whatsNext: "- Continue with Phase 8 hardening or model tuning",
    },
  });
}
