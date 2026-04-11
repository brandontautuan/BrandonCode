#!/usr/bin/env node
import { Command } from "commander";
import { DEFAULT_ACTIVE_MODEL_ID } from "./config/defaultModels.js";
import { ensureValidActiveModel, getStore } from "./config/store.js";
import {
  cmdModelAdd,
  cmdModelCurrent,
  cmdModelList,
  cmdModelRemove,
  cmdModelSwitch,
} from "./commands/model.js";
import { loadContext } from "./context/contextLoader.js";
import { runContextFinishFlow } from "./context/contextUpdater.js";
import { showBanner } from "./ui/banner.js";
import { runAgentLoop } from "./agent/loop.js";

const program = new Command();

program
  .name("brandon")
  .description("Brandon Code CLI — switch models and show a branded banner")
  .version("0.1.0")
  .option("--no-banner", "skip the startup banner")
  .hook("preAction", async () => {
    const opts = program.opts() as { banner?: boolean };
    if (opts.banner !== false) {
      await showBanner();
    }
    loadContext();
    getStore();
    ensureValidActiveModel();
  });

const model = program
  .command("model")
  .description("Manage AI models")
  .action(() => {
    model.help();
  });

model
  .command("list")
  .description("List available models")
  .action(() => {
    cmdModelList();
  });

model
  .command("current")
  .description("Show the active model")
  .action(() => {
    cmdModelCurrent();
  });

model
  .command("switch")
  .description("Set the active model")
  .argument("<id>", "model id, e.g. gemini-3-pro")
  .action((id: string) => {
    cmdModelSwitch(id);
  });

model
  .command("add")
  .description("Add a custom model id")
  .argument("<id>", "unique model id")
  .requiredOption("--label <name>", "display label")
  .option("--provider <name>", "provider hint, e.g. ollama")
  .option("--mode <local|cloud>", "local or cloud")
  .action(
    (
      id: string,
      opts: { label?: string; provider?: string; mode?: string }
    ) => {
      let mode: "local" | "cloud" | undefined;
      if (opts.mode) {
        if (opts.mode !== "local" && opts.mode !== "cloud") {
          console.error("--mode must be local or cloud");
          process.exitCode = 1;
          return;
        }
        mode = opts.mode;
      }
      cmdModelAdd(id, { label: opts.label, provider: opts.provider, mode });
    }
  );

model
  .command("remove")
  .description("Remove a custom model, or hide a built-in with --force-default")
  .argument("<id>", "model id")
  .option("--force-default", "hide a built-in model from your list")
  .action((id: string, opts: { forceDefault?: boolean }) => {
    cmdModelRemove(id, Boolean(opts.forceDefault));
  });

program
  .command("hello")
  .description("Show banner + default model id (sanity check)")
  .action(() => {
    console.log(`Default built-in id: ${DEFAULT_ACTIVE_MODEL_ID}`);
  });

const ctxRoot = program
  .command("context")
  .description("Persistent agent context (Phase 7)")
  .action(() => {
    ctxRoot.help();
  });

program
  .command("agent")
  .description("Interactive Ollama agent REPL (default when no subcommand)")
  .option("--no-context-finish", "skip context update proposal on exit")
  .option(
    "--planner-only",
    "testing mode: planner stage only; skip worker execution and tool apply"
  )
  .option(
    "--no-think",
    "disable Ollama extended thinking (no think request / trace)"
  )
  .option(
    "--activity-diagnostics",
    "verbose pipeline stage detail and full error diagnostics (or set activity: verbose in config)"
  )
  .action(
    async (opts: {
      noContextFinish?: boolean;
      plannerOnly?: boolean;
      noThink?: boolean;
      activityDiagnostics?: boolean;
    }) => {
      await runAgentLoop({
        skipContextFinish: Boolean(opts.noContextFinish),
        plannerOnly: Boolean(opts.plannerOnly),
        enableThinking: !opts.noThink,
        activityDiagnostics: Boolean(opts.activityDiagnostics),
      });
    }
  );

ctxRoot
  .command("finish")
  .description("Propose updating context/agent.md and append a session log")
  .argument("[note]", "Short note for **Last updated**")
  .option("--built <text>", "Session log: what was built")
  .option("--changed <text>", "Session log: what changed")
  .option("--next <text>", "Session log: what's next")
  .action(
    async (
      note: string | undefined,
      opts: { built?: string; changed?: string; next?: string }
    ) => {
      const sessionNote = note?.trim() || "Session end";
      await runContextFinishFlow({
        sessionNote,
        bullets: {
          whatWasBuilt: opts.built ?? `- ${sessionNote}`,
          whatChanged: opts.changed ?? "- Ran `brandon-code context finish`",
          whatsNext: opts.next ?? "- Harden agent + tool UX",
        },
      });
    }
  );

function injectDefaultAgentWhenNoSubcommand(): void {
  const rest = process.argv.slice(2);
  const wantsHelp =
    rest.includes("-h") ||
    rest.includes("--help") ||
    rest.includes("-V") ||
    rest.includes("--version");
  if (wantsHelp) return;
  const positional = rest.filter((t) => !t.startsWith("-"));
  if (positional.length === 0) {
    process.argv.push("agent");
  }
}

async function main(): Promise<void> {
  injectDefaultAgentWhenNoSubcommand();
  await program.parseAsync(process.argv);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
