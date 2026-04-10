import chalk from "chalk";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import type { ToolCall } from "ollama";
import { resolveActivityMode } from "../config/observabilitySettings.js";
import { createActivitySink, type ActivityMode } from "./activitySink.js";
import { buildPlan } from "./planner.js";
import type { WorkerResult } from "./worker.js";
import { executeplan } from "./worker.js";
import { writeFileTool } from "./tools.js";

function parseToolArgs(tc: ToolCall): Record<string, unknown> {
  const raw = tc.function?.arguments as unknown;
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") return raw as Record<string, unknown>;
  return {};
}

function parseWorkerJson(json: string): WorkerResult {
  try {
    const o = JSON.parse(json) as WorkerResult;
    return {
      content: typeof o.content === "string" ? o.content : "",
      toolCalls: Array.isArray(o.toolCalls) ? o.toolCalls : [],
    };
  } catch {
    return { content: "", toolCalls: [] };
  }
}

async function applyWriteProposals(toolCalls: ToolCall[]): Promise<void> {
  for (const tc of toolCalls) {
    if (tc.function?.name !== "write_file") continue;
    const args = parseToolArgs(tc);
    const p = String(args.path ?? "");
    const content = String(args.content ?? "");
    if (!p) continue;
    await writeFileTool(p, content, { skipConfirm: true });
  }
}

function parseApproval(line: string): "y" | "n" | "e" {
  const first = line.trim().toLowerCase()[0];
  if (first === "e") return "e";
  if (first === "y") return "y";
  return "n";
}

async function defaultPromptApproval(): Promise<"y" | "n" | "e"> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const line = await rl.question(chalk.cyan("Apply? [y/n/e]: "));
    return parseApproval(line);
  } finally {
    rl.close();
  }
}

function shouldRunWorkerForInput(userInput: string): boolean {
  const s = userInput.trim().toLowerCase();
  if (!s) return false;
  const reportIntent =
    /\b(report|review|summary|summarize|overview|describe|explain)\b/.test(s) ||
    /\bwhat does\b/.test(s);
  const executionIntent =
    /\b(fix|implement|code|edit|update|refactor|create|add|remove|delete|patch|write|run|execute|command|tool|apply|change)\b/.test(
      s
    );
  if (reportIntent && !executionIntent) return false;
  return true;
}

function editPlanInEditor(plan: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bc-plan-"));
  const fp = path.join(dir, "PLAN.md");
  fs.writeFileSync(fp, plan, "utf8");
  const editor = process.env.EDITOR?.trim() || "nano";
  const quoted = fp.replace(/'/g, "'\\''");
  if (/\s/.test(editor)) {
    spawnSync("sh", ["-c", `${editor} '${quoted}'`], {
      stdio: "inherit",
    });
  } else {
    const r = spawnSync(editor, [fp], { stdio: "inherit" });
    if (r.error) {
      console.error(
        chalk.red(
          `Could not launch editor (${editor}): ${r.error.message}`
        )
      );
    }
  }
  try {
    return fs.readFileSync(fp, "utf8");
  } catch {
    return plan;
  } finally {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

export type RunPipelineOptions = {
  enableThinking?: boolean;
  buildPlanFn?: typeof buildPlan;
  executeplanFn?: typeof executeplan;
  promptApproval?: () => Promise<"y" | "n" | "e">;
  /** Test hook: replace `$EDITOR` flow. */
  editPlanInEditorFn?: (plan: string) => string;
  /** Override error sink (default: activity sink with concise/verbose rules). */
  logError?: (message: string) => void;
  /** Force verbose activity + full errors (e.g. `brandon agent --activity-diagnostics`). */
  activityDiagnostics?: boolean;
  /** Override config/env activity mode (for tests). */
  activityMode?: ActivityMode;
};

export async function runPipeline(
  userInput: string,
  opts: RunPipelineOptions = {}
): Promise<void> {
  const mode: ActivityMode =
    opts.activityDiagnostics === true
      ? "verbose"
      : (opts.activityMode ?? resolveActivityMode());
  const sink = createActivitySink(mode);

  try {
    const enableThinking = opts.enableThinking !== false;
    const build = opts.buildPlanFn ?? buildPlan;
    const runWorker = opts.executeplanFn ?? executeplan;
    const ask = opts.promptApproval ?? defaultPromptApproval;
    const editPlan = opts.editPlanInEditorFn ?? editPlanInEditor;

    console.log(chalk.dim("── planner ──"));
    let plan = await build(userInput, {
      enableThinking,
      onStage: sink.stage,
    });
    if (plan.trim()) {
      console.log(plan + "\n");
    } else {
      console.log(chalk.yellow("(planner returned empty plan)\n"));
    }

    if (!shouldRunWorkerForInput(userInput)) {
      return;
    }

    while (true) {
      console.log(chalk.dim("── worker ──"));
      const raw = await runWorker(plan, {
        enableThinking,
        onStage: sink.stage,
      });
      const parsed = parseWorkerJson(raw);

      const action = await ask();
      if (action === "y") {
        await applyWriteProposals(parsed.toolCalls);
        return;
      }
      if (action === "n") {
        return;
      }
      plan = editPlan(plan);
    }
  } catch (e) {
    if (opts.logError) {
      const msg =
        e instanceof Error ? e.message : `Pipeline error: ${String(e)}`;
      opts.logError(msg);
    } else {
      sink.reportError(e);
    }
  }
}
