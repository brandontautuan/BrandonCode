import fs from "node:fs";
import { Ollama } from "ollama";
import type { Message } from "ollama";
import {
  getOllamaThinkForRequest,
  getPipelineModels,
} from "../config/ollamaSettings.js";
import { loadContext } from "../context/loader.js";
import { discoverRelevantFilePaths } from "./fileDiscovery.js";

const MAX_SNIPPET = 16_000;

function readBounded(filePath: string): string {
  try {
    const t = fs.readFileSync(filePath, "utf8");
    return t.length > MAX_SNIPPET
      ? t.slice(0, MAX_SNIPPET) + "\n… [truncated]"
      : t;
  } catch {
    return "(unreadable)";
  }
}

const SECTIONS = [
  "## Task",
  "## Relevant files",
  "## Current state",
  "## Exact requirements",
  "## Constraints",
  "## Expected output",
] as const;

function buildPlannerSystemPrompt(): string {
  const headings = SECTIONS.join("\n");
  return [
    "You are the planner for BrandonCode, a local coding CLI agent.",
    "You propose a structured implementation plan only — you do not edit files or run tools.",
    "",
    "Output Markdown with EXACTLY these section headings (in this order), each non-empty:",
    headings,
    "",
    "Under ## Relevant files, list the paths you relied on (from the provided file list).",
    "Be concise and actionable.",
  ].join("\n");
}

export type BuildPlanOptions = {
  enableThinking?: boolean;
  /** Optional status lines (concise or verbose detail) for REPL observability. */
  onStage?: (shortLabel: string, detail?: string) => void;
};

function isThinkUnsupportedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /does not support thinking/i.test(msg);
}

/**
 * Build a structured plan from user input: loads agent context, discovers up to 5 files, calls the planner model.
 */
export async function buildPlan(
  userInput: string,
  opts: BuildPlanOptions = {}
): Promise<string> {
  const enableThinking = opts.enableThinking !== false;
  const onStage = opts.onStage;
  onStage?.("Reading context & choosing relevant files…");
  const ctx = loadContext().trim();
  const paths = discoverRelevantFilePaths(userInput);
  onStage?.(
    "Loading file snippets for the planner",
    paths.length > 0 ? paths.join("\n") : "(no extra files)"
  );

  const fileBlocks: string[] = [];
  for (const p of paths) {
    fileBlocks.push(`### ${p}\n\n\`\`\`\n${readBounded(p)}\n\`\`\``);
  }

  const userPayload = [
    "## User request",
    userInput,
    "",
    "## Loaded context (context/agent.md)",
    ctx || "(empty)",
    "",
    "## Files (up to 5)",
    fileBlocks.join("\n\n"),
  ].join("\n");

  const { host, plannerModel, maxTokens, contextLimit } = getPipelineModels();
  const ollama = new Ollama({ host });
  const think = getOllamaThinkForRequest(enableThinking);
  const messages: Message[] = [
    { role: "system", content: buildPlannerSystemPrompt() },
    { role: "user", content: userPayload },
  ];

  const baseReq = {
    model: plannerModel,
    messages,
    keep_alive: 0,
    ...(maxTokens !== undefined ? { num_predict: maxTokens } : {}),
    ...(contextLimit !== undefined ? { num_ctx: contextLimit } : {}),
  };

  onStage?.("Calling planner model…", `model: ${plannerModel}`);

  let res;
  try {
    res = await ollama.chat({
      ...baseReq,
      ...(think !== undefined ? { think } : {}),
    });
  } catch (err) {
    if (think === undefined || !isThinkUnsupportedError(err)) {
      throw err;
    }
    // Mixed-model stacks are common; retry once without think.
    res = await ollama.chat(baseReq);
  }

  return res.message?.content?.trim() ?? "";
}

/** @internal Test helper — required planner section headings. */
export const PLAN_SECTION_HEADINGS = SECTIONS;
