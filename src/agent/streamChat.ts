import chalk from "chalk";
import { Ollama } from "ollama";
import type { ChatResponse, Message, Tool } from "ollama";
import {
  parseInlineToolCallContent,
} from "./toolParse.js";

export type StreamChatOptions = {
  tools?: Tool[];
  think?: boolean | "high" | "medium" | "low";
  maxTokens?: number;
  contextLimit?: number;
  keepAlive?: string | number;
};

/**
 * Stream one assistant turn. Returns the final assistant message (content + tool_calls).
 */
export async function streamChatCompletion(
  ollama: Ollama,
  model: string,
  messages: Message[],
  opts: StreamChatOptions = {}
): Promise<Message | undefined> {
  const enableTools = Boolean(opts.tools?.length);
  const stream = (await ollama.chat(
    enableTools
      ? {
          model,
          messages,
          tools: opts.tools,
          stream: true,
          ...(opts.think !== undefined ? { think: opts.think } : {}),
          ...(opts.maxTokens !== undefined ? { num_predict: opts.maxTokens } : {}),
          ...(opts.contextLimit !== undefined ? { num_ctx: opts.contextLimit } : {}),
          ...(opts.keepAlive !== undefined ? { keep_alive: opts.keepAlive } : {}),
        }
      : {
          model,
          messages,
          stream: true,
          ...(opts.think !== undefined ? { think: opts.think } : {}),
          ...(opts.maxTokens !== undefined ? { num_predict: opts.maxTokens } : {}),
          ...(opts.contextLimit !== undefined ? { num_ctx: opts.contextLimit } : {}),
          ...(opts.keepAlive !== undefined ? { keep_alive: opts.keepAlive } : {}),
        }
  )) as AsyncIterable<ChatResponse>;

  let assistantRole: Message["role"] = "assistant";
  let fullContent = "";
  let fullThinking = "";
  let latestToolCalls: Message["tool_calls"] | undefined;
  let thinkingHeaderPrinted = false;

  for await (const part of stream) {
    const msg = part.message;
    if (!msg) continue;
    assistantRole = msg.role ?? assistantRole;

    const chunkThink = msg.thinking ?? "";
    if (chunkThink) {
      if (!thinkingHeaderPrinted) {
        process.stdout.write(chalk.dim("\n── thinking ──\n"));
        thinkingHeaderPrinted = true;
      }
      if (chunkThink.startsWith(fullThinking)) {
        const next = chunkThink.slice(fullThinking.length);
        if (next) {
          fullThinking += next;
          process.stdout.write(chalk.gray(next));
        }
      } else {
        fullThinking += chunkThink;
        process.stdout.write(chalk.gray(chunkThink));
      }
    }

    const chunk = msg.content ?? "";
    if (chunk) {
      if (chunk.startsWith(fullContent)) {
        const next = chunk.slice(fullContent.length);
        if (next) {
          fullContent += next;
        }
      } else {
        fullContent += chunk;
      }
    }

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      latestToolCalls = msg.tool_calls;
    }
  }
  const inlineToolCalls = parseInlineToolCallContent(fullContent);
  const finalToolCalls = latestToolCalls ?? inlineToolCalls;

  if (fullContent.trim().length > 0) {
    if (thinkingHeaderPrinted) {
      process.stdout.write(chalk.dim("\n── reply ──\n"));
    }
    if (finalToolCalls?.length) {
      const names = finalToolCalls
        .map((tc) => tc.function?.name ?? "tool")
        .join(", ");
      process.stdout.write(chalk.dim(`[tool call: ${names}]`) + "\n");
    } else {
      process.stdout.write(fullContent + "\n");
    }
  } else {
    process.stdout.write("\n");
  }

  return {
    role: assistantRole,
    content: inlineToolCalls ? "" : fullContent,
    ...(finalToolCalls ? { tool_calls: finalToolCalls } : {}),
  } as Message;
}
