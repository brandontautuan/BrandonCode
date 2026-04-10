import chalk from "chalk";
import { Ollama } from "ollama";
import type { ChatResponse, Message, ToolCall } from "ollama";
import { createInterface } from "node:readline/promises";
import { getOllamaSettings } from "../config/ollamaSettings.js";
import { loadContext } from "../context/loader.js";
import { runContextFinishFlow } from "../context/contextUpdater.js";
import { AGENT_TOOLS } from "./ollamaTools.js";
import { executeToolCalls } from "./toolRunner.js";

const ALLOWED_TOOL_NAMES = new Set(["read_file", "write_file", "run_bash"]);
const MAX_TOOL_ROUNDS_PER_TURN = 8;

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

function buildSystemPrompt(): string {
  const ctx = loadContext().trim();
  const base =
    "You are BrandonCode, a local coding CLI agent. Prefer small edits and clear explanations. " +
    "When you need files or shell, call the provided tools.";
  return ctx ? `${ctx}\n\n---\n\n${base}` : base;
}

function maybeParseInlineToolCall(content: string): ToolCall[] | undefined {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{")) return undefined;

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const name = parsed.name;
    const args = parsed.arguments;
    if (
      typeof name === "string" &&
      args != null &&
      typeof args === "object" &&
      !Array.isArray(args)
    ) {
      return [
        {
          function: {
            name,
            arguments: args as Record<string, unknown>,
          },
        },
      ];
    }
  } catch {
    return undefined;
  }

  return undefined;
}

async function streamOneTurn(
  ollama: Ollama,
  model: string,
  messages: Message[]
): Promise<Message | undefined> {
  const stream = (await ollama.chat({
    model,
    messages,
    tools: AGENT_TOOLS,
    stream: true,
  })) as AsyncIterable<ChatResponse>;

  let assistantRole: Message["role"] = "assistant";
  let fullContent = "";
  let latestToolCalls: Message["tool_calls"] | undefined;

  for await (const part of stream) {
    const msg = part.message;
    if (!msg) continue;
    assistantRole = msg.role ?? assistantRole;

    // Ollama streams content in chunks; occasionally providers send cumulative text.
    // Handle both forms without duplicating/truncating terminal output.
    const chunk = msg.content ?? "";
    if (chunk) {
      if (chunk.startsWith(fullContent)) {
        const next = chunk.slice(fullContent.length);
        if (next) {
          fullContent += next;
          process.stdout.write(next);
        }
      } else {
        fullContent += chunk;
        process.stdout.write(chunk);
      }
    }

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      latestToolCalls = msg.tool_calls;
    }
  }
  process.stdout.write("\n");
  return {
    role: assistantRole,
    content: fullContent,
    ...(latestToolCalls ? { tool_calls: latestToolCalls } : {}),
  } as Message;
}

async function runChatUntilNoTools(
  ollama: Ollama,
  model: string,
  messages: Message[]
): Promise<void> {
  let toolRounds = 0;
  while (true) {
    if (toolRounds >= MAX_TOOL_ROUNDS_PER_TURN) {
      console.log(
        chalk.yellow(
          `Stopped after ${MAX_TOOL_ROUNDS_PER_TURN} tool rounds to avoid loops.`
        )
      );
      break;
    }

    const assistant = await streamOneTurn(ollama, model, messages);
    if (!assistant) break;
    messages.push(assistant);
    const parsedCalls =
      assistant.tool_calls ??
      maybeParseInlineToolCall(String(assistant.content ?? ""));
    if (!parsedCalls?.length) break;

    const runnableCalls = parsedCalls.filter((tc) => {
      const name = tc.function?.name ?? "";
      return ALLOWED_TOOL_NAMES.has(name);
    });
    const unknownNames = parsedCalls
      .map((tc) => tc.function?.name ?? "")
      .filter((name) => name && !ALLOWED_TOOL_NAMES.has(name));

    if (unknownNames.length > 0) {
      console.log(
        chalk.yellow(
          `Ignored unknown tool call(s): ${unknownNames.join(", ")}.`
        )
      );
    }
    if (runnableCalls.length === 0) {
      break;
    }

    toolRounds += 1;
    const combined = await executeToolCalls(runnableCalls);
    messages.push({
      role: "tool",
      content: combined,
    });
  }
}

export type AgentLoopOptions = {
  /** Skip `context finish` flow on exit (non-interactive / scripting). */
  skipContextFinish?: boolean;
};

export async function runAgentLoop(opts: AgentLoopOptions = {}): Promise<void> {
  const { host, model } = getOllamaSettings();
  const ollama = new Ollama({ host });

  try {
    await ollama.list();
  } catch (e) {
    console.error(chalk.red(formatOllamaError(e, host, model)));
    process.exitCode = 1;
    return;
  }

  console.log(
    chalk.dim(
      `Ollama: ${chalk.bold(model)} @ ${host} — type ${chalk.bold("exit")} to quit.\n`
    )
  );

  const messages: Message[] = [
    { role: "system", content: buildSystemPrompt() },
  ];

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    while (true) {
      const line = await rl.question(chalk.cyan("you> "));
      const input = line.trim();
      if (!input) continue;
      if (input === "exit" || input === "quit") break;

      messages.push({ role: "user", content: input });

      try {
        await runChatUntilNoTools(ollama, model, messages);
      } catch (e) {
        console.error(chalk.red(formatOllamaError(e, host, model)));
      }
    }
  } finally {
    rl.close();
  }

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
