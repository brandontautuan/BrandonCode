import { Ollama } from "ollama";
import type { Message, ToolCall } from "ollama";
import {
  getOllamaThinkForRequest,
  getPipelineModels,
} from "../config/ollamaSettings.js";
import { AGENT_TOOLS } from "./ollamaTools.js";
import { streamChatCompletion } from "./streamChat.js";

function workerSystemPrompt(): string {
  return [
    "You are the worker for BrandonCode.",
    "You receive a single structured plan (Markdown) from the planner.",
    "Implement the plan using tool calls: read_file, write_file, run_bash as needed.",
    "Prefer small, clear edits. Stream your reasoning in normal text; use tools for real actions.",
    "Do not ask to load separate project context files — the plan already contains what you need.",
  ].join(" ");
}

export type WorkerResult = {
  /** Visible assistant text (excluding suppressed inline tool JSON). */
  content: string;
  toolCalls: ToolCall[];
};

export type ExecutePlanOptions = {
  enableThinking?: boolean;
  onStage?: (shortLabel: string, detail?: string) => void;
};

function isThinkUnsupportedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /does not support thinking/i.test(msg);
}

/**
 * Run the worker model on the planner output. Streams to the terminal; returns proposals (including tool calls).
 */
export async function executeplan(
  plan: string,
  opts: ExecutePlanOptions = {}
): Promise<string> {
  const enableThinking = opts.enableThinking !== false;
  const { host, workerModel } = getPipelineModels();
  const ollama = new Ollama({ host });
  const think = getOllamaThinkForRequest(enableThinking);

  opts.onStage?.("Running worker (stream + tools)…");

  const messages: Message[] = [
    { role: "system", content: workerSystemPrompt() },
    { role: "user", content: plan },
  ];

  let assistant;
  try {
    assistant = await streamChatCompletion(ollama, workerModel, messages, {
      tools: AGENT_TOOLS,
      ...(think !== undefined ? { think } : {}),
    });
  } catch (err) {
    if (think === undefined || !isThinkUnsupportedError(err)) {
      throw err;
    }
    // Fall back for models that reject `think` but still support tool-calling.
    assistant = await streamChatCompletion(ollama, workerModel, messages, {
      tools: AGENT_TOOLS,
    });
  }

  const toolCalls = assistant?.tool_calls ?? [];
  const content = String(assistant?.content ?? "");

  const payload: WorkerResult = { content, toolCalls };
  return JSON.stringify(payload);
}
