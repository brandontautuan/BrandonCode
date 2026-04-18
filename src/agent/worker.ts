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
    "Execute the plan using tool calls. Output tool calls as JSON: {\"name\": \"read_file\", \"arguments\": {\"path\": \"...\"}}, then {\"name\": \"write_file\", \"arguments\": {\"path\": \"...\", \"content\": \"...\"}}.",
    "For every file edit: (1) call read_file to get current content, (2) modify it, (3) call write_file with modified content.",
    "Reason in text before and after tool calls. Never skip the actual tool calls — always execute them.",
    "Do not ask for permission or describe steps. Just do the work.",
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
  const { host, workerModel, maxTokens, contextLimit } = getPipelineModels();
  const ollama = new Ollama({ host });
  const think = getOllamaThinkForRequest(enableThinking);

  opts.onStage?.("Running worker (stream + tools)…", `model: ${workerModel}`);

  const messages: Message[] = [
    { role: "system", content: workerSystemPrompt() },
    { role: "user", content: plan },
  ];

  let assistant;
  try {
    assistant = await streamChatCompletion(ollama, workerModel, messages, {
      tools: AGENT_TOOLS,
      ...(think !== undefined ? { think } : {}),
      maxTokens,
      contextLimit,
      keepAlive: 0,
    });
  } catch (err) {
    if (think === undefined || !isThinkUnsupportedError(err)) {
      throw err;
    }
    // Fall back for models that reject `think` but still support tool-calling.
    assistant = await streamChatCompletion(ollama, workerModel, messages, {
      tools: AGENT_TOOLS,
      maxTokens,
      contextLimit,
      keepAlive: 0,
    });
  }

  const toolCalls = assistant?.tool_calls ?? [];
  const content = String(assistant?.content ?? "");

  const payload: WorkerResult = { content, toolCalls };
  return JSON.stringify(payload);
}
