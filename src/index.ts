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
import { showBanner } from "./ui/banner.js";

const program = new Command();

program
  .name("brandon-code")
  .description("Brandon Code CLI — switch models and show a branded banner")
  .version("0.1.0")
  .option("--no-banner", "skip the startup banner")
  .hook("preAction", async () => {
    const opts = program.opts() as { banner?: boolean };
    if (opts.banner !== false) {
      await showBanner();
    }
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

program.parse();
