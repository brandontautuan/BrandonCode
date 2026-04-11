# Slash Commands & Multi-Provider Plan

## Goal

Add a Claude Code-style slash command system to the agent REPL, starting with `/configure` as the first command. `/configure` opens an interactive picker that lets the user:

1. Choose from locally installed Ollama models (Phase A).
2. Add custom providers by pasting an API key — Groq, DeepSeek, MiniMax, and any other OpenAI-compatible endpoint (Phase B).
3. Pick which model powers the planner agent, the worker agent, or both.

Configuration persists globally in `~/.brandon-code/config.json` and applies across all directories on the same machine.

## Scope

**In scope (this plan):**
- Slash command registry that future commands plug into (`/help`, `/clear`, `/theme`, etc.).
- Live dropdown menu that appears as the user types `/` in the REPL.
- `/configure` interactive picker using `@inquirer/prompts`.
- `ChatProvider` abstraction so the pipeline is no longer hard-coupled to Ollama.
- OpenAI-compatible generic provider covering Groq, DeepSeek, MiniMax, OpenRouter, and any compatible endpoint.
- Secure credential storage outside of `config.json`.

**Out of scope (explicitly deferred):**
- Per-project model overrides via `.brandon-code/project.json` — global only for now.
- `/configure` sub-menus for banner themes, activity verbosity, or context settings.
- Anthropic / Gemini / native MiniMax SDKs (can be added later; the registry supports them).
- Tool-call translation between different provider tool-call shapes (Phase B1 keeps tools Ollama-only, Phase B2 adds OpenAI-compatible tool calls).

## Answered Decisions (from planning conversation)

| Question | Answer |
|---|---|
| A-then-B staging split? | Yes. Ship slash UX first with Ollama-only. Add providers after. |
| Live `/` menu vs tab completion only? | Live menu. User indifferent; picking the richer UX since it was the original ask. |
| Which providers? | Open-ended. Must support arbitrary OpenAI-compatible endpoints. Primary targets: Groq, DeepSeek, MiniMax. |
| API key storage | Anywhere, as long as never committed. → `~/.brandon-code/credentials.json` with `chmod 600`. Outside the repo by construction. |
| `/configure` scope | Model picking only for now. |
| Global vs per-project | Global per machine. Writes go to `~/.brandon-code/config.json` via existing Conf store. |

## Architecture Overview

```
REPL input
   │
   ▼
promptWithSlashMenu()   ◄── raw-mode reader; draws dropdown when buffer starts with "/"
   │
   ├── line starts with "/"  ──► dispatchSlash() ──► SlashCommand.handler()
   │                                                        │
   │                                                        ▼
   │                                               @inquirer/prompts picker
   │                                                        │
   │                                                        ▼
   │                                               writes to Conf store /
   │                                               credentials.json
   │
   └── plain text  ──► runPipeline()
                            │
                            ▼
                    planner → worker (both use a ChatProvider, not `new Ollama(...)`)
```

Two cleanly separated subsystems:

1. **Slash UX layer** (`src/agent/slash/`) — registry + live menu widget + command handlers.
2. **Provider layer** (`src/providers/`) — provider-agnostic chat interface used by planner, worker, streamChat, and pipeline.

Neither subsystem leaks into the other: the slash UX writes to config; the provider layer reads from config. They meet at `/configure`, which is a slash command that mutates provider state.

---

# Part A — Slash Command System (Ollama-only `/configure`)

## Dependencies to add

- **`@inquirer/prompts`** — modern interactive prompt library (`select`, `input`, `password`, `confirm`). Replaces ad-hoc `rl.question` inside slash handlers. MIT, pure JS, no native deps.

## New files

```
src/agent/slash/
├── types.ts                  # SlashCommand, SlashContext
├── registry.ts               # register(), lookup(name), list()
├── dispatcher.ts             # routes a raw "/foo bar baz" line to the right handler
├── promptWithSlashMenu.ts    # raw-mode line reader with live dropdown overlay
├── renderMenu.ts             # ANSI cursor helpers (save/restore, clear lines, write row)
├── commands/
│   ├── configure.ts          # Phase A: Ollama-only picker
│   └── help.ts               # tiny built-in command; validates the registry works end-to-end
├── dispatcher.test.ts
├── registry.test.ts
└── promptWithSlashMenu.test.ts
```

## Slash registry shape

```ts
// src/agent/slash/types.ts
import type { Ollama } from "ollama";
import type { Interface as ReadlineInterface } from "node:readline/promises";

export type SlashContext = {
  /** The Ollama client the REPL already created. Phase B will generalize this. */
  ollama: Ollama;
  /** Readline interface, if the command needs to pause raw-mode input. */
  rl?: ReadlineInterface;
};

export type SlashCommand = {
  name: string;                  // "configure" (no leading slash)
  description: string;           // one-liner shown in the dropdown
  aliases?: string[];            // e.g. ["config", "cfg"]
  /** Optional arg hints shown in the dropdown after the name. */
  argsHint?: string;
  handler(args: string[], ctx: SlashContext): Promise<void>;
};
```

```ts
// src/agent/slash/registry.ts
const commands = new Map<string, SlashCommand>();

export function register(cmd: SlashCommand): void { /* reject duplicate name/alias */ }
export function lookup(name: string): SlashCommand | undefined { /* name or alias */ }
export function list(): SlashCommand[] { /* stable order by registration */ }
export function filter(prefix: string): SlashCommand[] { /* for dropdown suggestions */ }
```

Register commands from a single entry point so future commands drop in by adding one import:

```ts
// src/agent/slash/index.ts
import { register } from "./registry.js";
import { configureCommand } from "./commands/configure.js";
import { helpCommand } from "./commands/help.js";

register(configureCommand);
register(helpCommand);

export * from "./registry.js";
export * from "./dispatcher.js";
export * from "./promptWithSlashMenu.js";
```

## Live `/` menu widget

**Problem.** The current REPL uses `rl.question("you> ")` at `src/agent/loop.ts:119`, which reads a full line at once. A live dropdown needs per-keystroke input.

**Solution.** Replace that single call with `promptWithSlashMenu(opts)`. It:

1. Puts stdin into raw mode (`process.stdin.setRawMode(true)`).
2. Enables keypress events (`readline.emitKeypressEvents(process.stdin)`).
3. Buffers characters itself; echoes them after the prompt.
4. On every keystroke, if the buffer starts with `/`, it computes the filtered command list (`filter(buffer.slice(1))`) and redraws a dropdown overlay below the cursor line.
5. Handles:
   - **Backspace** (`\x7f` and `\x08`) — shrink buffer.
   - **Enter** — clear menu, restore cooked mode, return the line.
   - **Escape** — if menu is open, close it (keep typing); if buffer empty, ignore.
   - **Up / Down arrows** — if menu is open, move selection; otherwise do nothing.
   - **Tab** — if menu is open, complete to selected command + space.
   - **Ctrl+C** — print `^C` and re-emit as if the user typed nothing; loop continues.
   - **Paste** (chunks arriving as one big string, often with `\r`) — split on newlines, take first line, submit.
6. Exposes a testable pure renderer: `renderMenu({ buffer, cursor, suggestions, selectedIndex })` returns the ANSI byte string.

**Rendering strategy.** Each frame:

```
\x1b[s                 save cursor
\n                     drop to the line below
\x1b[J                 clear from cursor to end of screen (wipes prior menu)
<menu lines>           write each suggestion, highlight selected
\x1b[u                 restore cursor (back to the prompt line, correct column)
```

Menu cell format: `  /configure   Open model & provider picker` with the selected row inverted via `chalk.inverse`.

**Why not `ink`?** `ink` owns the whole screen and would require rewriting streaming output (`streamChat.ts`) to use its declarative model. Too invasive for a single widget.

**Why not `@inquirer/prompts` for the main input?** Inquirer takes over stdin and doesn't support "input mode that also shows a dropdown when the first char is `/`". It's the right tool for the `/configure` picker itself, but not for the main REPL line reader.

## Dispatcher

```ts
// src/agent/slash/dispatcher.ts
export async function dispatchSlashCommand(
  line: string,
  ctx: SlashContext
): Promise<void> {
  const trimmed = line.trim();
  if (!trimmed.startsWith("/")) return;
  const [rawName, ...args] = trimmed.slice(1).split(/\s+/);
  const name = rawName.toLowerCase();
  if (!name) {
    // User submitted bare "/" — list commands inline.
    printCommandList();
    return;
  }
  const cmd = lookup(name);
  if (!cmd) {
    console.error(chalk.yellow(`Unknown command: /${name}. Type /help.`));
    return;
  }
  try {
    await cmd.handler(args, ctx);
  } catch (e) {
    console.error(chalk.red(`/${name} failed: ${e instanceof Error ? e.message : String(e)}`));
  }
}
```

## `/configure` command (Phase A)

```ts
// src/agent/slash/commands/configure.ts
import { select } from "@inquirer/prompts";
import { getStore } from "../../../config/store.js";
import type { SlashCommand } from "../types.js";

export const configureCommand: SlashCommand = {
  name: "configure",
  aliases: ["config", "cfg"],
  description: "Pick planner / worker models and manage providers.",
  async handler(_args, ctx) {
    const store = getStore();
    const { models } = await ctx.ollama.list();
    if (!models.length) {
      console.log("No local Ollama models found. Run `ollama pull <model>` first.");
      return;
    }

    // Step 1 — which role?
    const role = await select({
      message: "Configure which model?",
      choices: [
        { name: "Planner agent", value: "planner" },
        { name: "Worker agent", value: "worker" },
        { name: "Both (planner + worker)", value: "both" },
      ],
    });

    // Step 2 — pick model.
    const model = await select({
      message: "Select a model",
      choices: models.map((m) => ({ name: m.name, value: m.name })),
    });

    // Step 3 — persist.
    if (role === "planner" || role === "both") store.set("plannerModel", model);
    if (role === "worker"  || role === "both") store.set("workerModel",  model);

    console.log(`Saved. Planner=${store.get("plannerModel")}, Worker=${store.get("workerModel")}`);
  },
};
```

**UX notes:**
- If running in a non-TTY, `@inquirer/prompts` throws; catch it and print a hint to run `/configure` interactively.
- After the picker returns, the REPL returns to the normal `you>` prompt; no restart needed because `ollama` is created fresh per turn by pipeline code that reads the store.

## Integration with `loop.ts`

Minimal surgical edit at `src/agent/loop.ts:118-134`:

```ts
import { dispatchSlashCommand, promptWithSlashMenu } from "./slash/index.js";

// …inside the while loop, replace rl.question(...):
const line = await promptWithSlashMenu({
  prompt: chalk.cyan("you> "),
  registry: slashRegistryListForMenu(),
});

const input = line.trim();
if (!input) continue;
if (input === "exit" || input === "quit") break;

if (input.startsWith("/")) {
  await dispatchSlashCommand(input, { ollama, rl });
  continue;
}

// existing runPipeline call unchanged
```

**Important:** `promptWithSlashMenu` owns stdin in raw mode while reading. When a slash handler calls `@inquirer/prompts`, inquirer needs cooked-mode stdin. The widget must **restore cooked mode before returning the line** and the dispatcher must run after that restoration. Design the widget so it fully releases stdin in its `finally` block.

## Phase A tests

- `registry.test.ts` — register, lookup by name and alias, reject duplicates, `filter("con")` returns `/configure`.
- `dispatcher.test.ts` — unknown command prints yellow warning; known command runs handler; bare `/` lists commands; errors are caught.
- `promptWithSlashMenu.test.ts` — pure render function produces correct ANSI for a given state (buffer, suggestions, selected index). Mock stdin for key events: typing `/con` → menu filtered to `/configure`, Tab completes, Enter returns.
- `configure.test.ts` — given a mocked `Ollama.list()` and mocked `@inquirer/prompts.select`, verify `plannerModel` / `workerModel` are written to the Conf store correctly. Use `BRANDON_CODE_CONFIG_DIR` temp dir per your existing pattern.

## Phase A acceptance criteria

- Typing `/` in the REPL shows a dropdown below the prompt listing `/configure` and `/help`.
- Typing `/con` filters the dropdown to `/configure`.
- Pressing `Tab` completes to `/configure `.
- Pressing `Enter` on `/configure` opens the picker, lets the user pick a role + model, and writes to `~/.brandon-code/config.json`.
- Restarting `brandon` in a different directory on the same machine shows the new planner/worker in the startup `Ollama: …` line.
- `Ctrl+C` at the prompt does not kill the REPL.
- All previous tests still pass.

---

# Part B — Multi-Provider Support

## Dependencies to add

- **`openai`** — official SDK. Used for Groq, DeepSeek, MiniMax, OpenRouter, and any other OpenAI-compatible endpoint via `baseURL`.
- *(Optional later)* `@anthropic-ai/sdk`, `@google/generative-ai` — skip for now; the provider interface supports them when added.

## New files

```
src/providers/
├── types.ts                  # ChatProvider interface + shared types
├── registry.ts               # list/get providers by id, backed by config + credentials
├── ollama.ts                 # wraps the existing Ollama usage behind ChatProvider
├── openaiCompatible.ts       # generic OpenAI-compatible provider (Groq, DeepSeek, MiniMax, ...)
└── providers.test.ts

src/config/
├── credentials.ts            # read/write ~/.brandon-code/credentials.json (mode 0600)
└── credentials.test.ts
```

## `ChatProvider` interface

Pull the shape the pipeline actually needs from `streamChat.ts`, not the full Ollama type surface:

```ts
// src/providers/types.ts
export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatMessage = {
  role: ChatRole;
  content: string;
  tool_calls?: ChatToolCall[];
  tool_call_id?: string;
  name?: string;
};

export type ChatToolCall = {
  id?: string;
  function: { name: string; arguments: Record<string, unknown> };
};

export type ChatTool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>; // JSON schema
  };
};

export type ChatStreamChunk = {
  content?: string;
  thinking?: string;
  toolCalls?: ChatToolCall[];
  done?: boolean;
};

export type StreamChatOptions = {
  model: string;
  messages: ChatMessage[];
  tools?: ChatTool[];
  think?: boolean | "high" | "medium" | "low";
  maxTokens?: number;
  contextLimit?: number;
};

export interface ChatProvider {
  /** Stable id, e.g. "ollama", "groq", "deepseek", "minimax-openai". */
  id: string;
  /** Human label shown in the picker. */
  label: string;
  /** Returns available model ids for this provider. */
  listModels(): Promise<string[]>;
  /** Streams one assistant turn. */
  streamChat(opts: StreamChatOptions): AsyncIterable<ChatStreamChunk>;
}
```

Important: `ChatStreamChunk` is **provider-neutral**. The job of `openaiCompatible.ts` is to translate between OpenAI's `choices[].delta` shape and this shape. `ollama.ts` does the same for Ollama's `part.message`.

## Rewriting `streamChat.ts`

`src/agent/streamChat.ts` currently takes `ollama: Ollama` and calls `ollama.chat(...)` directly. Rewrite it to take a `ChatProvider`:

```ts
export async function streamChatCompletion(
  provider: ChatProvider,
  model: string,
  messages: ChatMessage[],
  opts: Omit<StreamChatOptions, "model" | "messages"> = {}
): Promise<ChatMessage | undefined> {
  const stream = provider.streamChat({ model, messages, ...opts });
  // existing chunk accumulation + thinking + tool-call handling,
  // operating on ChatStreamChunk instead of Ollama's ChatResponse
}
```

The streaming-accumulation loop in the current `streamChat.ts:52-90` is mostly provider-neutral already — it just expects `msg.content`, `msg.thinking`, and `msg.tool_calls`. Moving those field names onto `ChatStreamChunk` is a rename, not a rewrite.

Then update:
- `src/agent/planner.ts` — take a `ChatProvider`, not `new Ollama(...)`.
- `src/agent/worker.ts` — same.
- `src/agent/pipeline.ts` — build the provider once from config, pass to planner + worker.
- `src/agent/loop.ts` — construct the active provider via `getActiveProvider()` instead of `new Ollama({ host })`.

## Credential storage

```ts
// src/config/credentials.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type CredentialsFile = {
  /** Keyed by provider id, e.g. "groq", "deepseek", "minimax". */
  [providerId: string]: { apiKey: string; baseURL?: string; label?: string };
};

const FILE = path.join(os.homedir(), ".brandon-code", "credentials.json");

export function readCredentials(): CredentialsFile { /* return {} if missing */ }
export function writeCredential(id: string, entry: { apiKey: string; baseURL?: string; label?: string }): void {
  // 1. mkdir -p ~/.brandon-code
  // 2. merge with existing
  // 3. fs.writeFileSync(FILE, JSON.stringify(data, null, 2), { mode: 0o600 })
  // 4. fs.chmodSync(FILE, 0o600) in case it existed with looser perms
}
export function removeCredential(id: string): void { /* rewrite file without id */ }
export function getCredential(id: string): { apiKey: string; baseURL?: string } | undefined { /* */ }
```

**Rules:**
- Never log the full API key. Truncate to `sk-...last4` in any diagnostic output.
- Never write API keys to `~/.brandon-code/config.json`.
- Add a defensive entry to the repo `.gitignore` for `.brandon-code/` in case someone ever scaffolds a local project folder by that name.
- File mode is enforced on both create and update. On Windows, `mode` is advisory; accept that limitation.

## Provider registry

```ts
// src/providers/registry.ts
export type ConfiguredProvider = {
  id: string;                    // "ollama", "groq", "deepseek-coder", ...
  label: string;
  type: "ollama" | "openai-compatible";
  /** For openai-compatible: the base URL. */
  baseURL?: string;
  /** Present only at runtime (loaded from credentials.json). */
  apiKey?: string;
};

export function listConfiguredProviders(): ConfiguredProvider[] {
  // Merge: built-in "ollama" + every entry in credentials.json + metadata from config store.
}

export function getActiveProvider(): ChatProvider {
  const store = getStore();
  const activeId = store.get("activeProviderId") ?? "ollama";
  const meta = listConfiguredProviders().find((p) => p.id === activeId) ?? ollamaBuiltin();
  return buildProvider(meta);
}

function buildProvider(meta: ConfiguredProvider): ChatProvider {
  if (meta.type === "ollama") return new OllamaProvider({ host: ... });
  if (meta.type === "openai-compatible") {
    return new OpenAICompatibleProvider({
      id: meta.id,
      label: meta.label,
      baseURL: meta.baseURL!,
      apiKey: meta.apiKey!,
    });
  }
  throw new Error(`Unknown provider type: ${meta.type}`);
}
```

Config keys added to Conf store:
- `activeProviderId` — which provider powers planner/worker by default.
- `plannerProviderId` / `workerProviderId` — optional overrides if user wants planner on Groq and worker on local Ollama.
- Existing `plannerModel` / `workerModel` keys stay; they're now interpreted in the context of the active provider.

## OpenAI-compatible provider

```ts
// src/providers/openaiCompatible.ts
import OpenAI from "openai";

export class OpenAICompatibleProvider implements ChatProvider {
  readonly id: string;
  readonly label: string;
  private client: OpenAI;

  constructor(opts: { id: string; label: string; baseURL: string; apiKey: string }) {
    this.id = opts.id;
    this.label = opts.label;
    this.client = new OpenAI({ apiKey: opts.apiKey, baseURL: opts.baseURL });
  }

  async listModels(): Promise<string[]> {
    const res = await this.client.models.list();
    return res.data.map((m) => m.id);
  }

  async *streamChat(opts: StreamChatOptions): AsyncIterable<ChatStreamChunk> {
    const stream = await this.client.chat.completions.create({
      model: opts.model,
      stream: true,
      messages: toOpenAIMessages(opts.messages),
      ...(opts.tools?.length ? { tools: toOpenAITools(opts.tools) } : {}),
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    });
    for await (const part of stream) {
      const delta = part.choices[0]?.delta;
      if (!delta) continue;
      const chunk: ChatStreamChunk = {};
      if (delta.content) chunk.content = delta.content;
      if (delta.tool_calls?.length) chunk.toolCalls = fromOpenAIToolCalls(delta.tool_calls);
      if (Object.keys(chunk).length) yield chunk;
    }
    yield { done: true };
  }
}
```

**Known endpoint presets** (shown in `/configure` for one-click setup):

| Provider | Base URL | Notes |
|---|---|---|
| Groq | `https://api.groq.com/openai/v1` | OpenAI-compatible. Fast. |
| DeepSeek | `https://api.deepseek.com` | OpenAI-compatible. |
| MiniMax (OpenAI mode) | `https://api.minimaxi.chat/v1` | Verify current URL when wiring; MiniMax documents an OpenAI-compatible endpoint. |
| OpenRouter | `https://openrouter.ai/api/v1` | OpenAI-compatible gateway to many models. |
| OpenAI | `https://api.openai.com/v1` | Default, can omit. |
| Custom | (user-entered) | Any OpenAI-compatible endpoint. |

**Tool call compatibility warning.** Ollama and OpenAI-compatible providers both support function-style tool calls, but the JSON schemas of the call results differ slightly (`arguments` is a JSON string for OpenAI, an object for Ollama). The normalizer in `openaiCompatible.ts` must `JSON.parse` the arguments string before yielding. If a provider endpoint doesn't support tool calls at all (some Groq models), the provider must surface a clean error so the user can pick a different model.

## Ollama provider wrapper

Thin adapter around the existing behavior so nothing else needs to change on day one:

```ts
// src/providers/ollama.ts
import { Ollama } from "ollama";

export class OllamaProvider implements ChatProvider {
  readonly id = "ollama";
  readonly label = "Ollama (local)";
  private client: Ollama;
  constructor(opts: { host: string }) { this.client = new Ollama({ host: opts.host }); }

  async listModels(): Promise<string[]> {
    const { models } = await this.client.list();
    return models.map((m) => m.name);
  }

  async *streamChat(opts: StreamChatOptions): AsyncIterable<ChatStreamChunk> {
    // Reuse the exact request-building logic currently in streamChat.ts,
    // but yield normalized ChatStreamChunk objects instead of mutating locals.
  }
}
```

## `/configure` after Phase B — "Add custom provider" flow

The picker gains a branch:

```
? Configure which model?
  > Planner agent
    Worker agent
    Both
    ──────────────────
    Manage providers…

? Manage providers
  > Add a new provider
    Remove provider: groq
    Back

? Provider type
  > OpenAI-compatible (Groq, DeepSeek, MiniMax, OpenRouter, custom)
    Cancel

? Preset
  > Groq          https://api.groq.com/openai/v1
    DeepSeek      https://api.deepseek.com
    MiniMax       https://api.minimaxi.chat/v1
    OpenRouter    https://openrouter.ai/api/v1
    Custom…

? API key  ************************************
? Give this provider a name: groq-main
? Test connection now? (Y/n) y
  → listed 14 models. Saved.
```

Implementation uses `@inquirer/prompts`:
- `select` for type / preset / manage actions.
- `input` for custom base URL and provider nickname.
- `password` for the API key (never echoed).
- `confirm` for test-connection prompt.
- On save: `writeCredential(id, { apiKey, baseURL, label })` then attempt `provider.listModels()` — if it fails, roll back by calling `removeCredential(id)`.

Once a provider is added, the model picker step fans out per configured provider:

```
? Select a model
  Ollama (local):
  > qwen2.5-coder:7b
    qwen2.5-coder:14b
  Groq:
    llama-3.3-70b-versatile
    deepseek-r1-distill-llama-70b
  DeepSeek:
    deepseek-chat
    deepseek-reasoner
```

Selection writes both `plannerProviderId` (or `workerProviderId`) **and** `plannerModel` (or `workerModel`) to the Conf store.

## Migration steps (ordered)

1. Add `src/providers/types.ts` with the interface, unreferenced by anything else.
2. Add `src/providers/ollama.ts` that wraps existing logic.
3. Add `src/providers/registry.ts` that returns `new OllamaProvider(...)` for id `"ollama"` — the only configured provider at this point.
4. Rewrite `src/agent/streamChat.ts` to accept `ChatProvider` + `ChatMessage[]`. Update `streamChatCompletion` callers in `planner.ts`, `worker.ts`, `pipeline.ts`, `contextBootstrap.ts` to pass the active provider. All tests must still pass with only Ollama configured.
5. Add `src/config/credentials.ts` + tests.
6. Add `src/providers/openaiCompatible.ts` + unit tests against a mocked `openai` client.
7. Extend `src/agent/slash/commands/configure.ts` with the "Manage providers" branch.
8. Ship.

**Critical:** step 4 is the risky one. It's a rename refactor across five files and one rewrite (`streamChat.ts`). Do it on a branch with tests running green after each file. If anything changes behavior, it's almost certainly in the tool-call normalization path; compare `parseInlineToolCallContent` output before and after.

## Phase B tests

- `providers.test.ts`
  - `OllamaProvider.listModels()` wraps `ollama.list()`.
  - `OpenAICompatibleProvider.streamChat()` translates OpenAI delta chunks to `ChatStreamChunk` (mock the SDK).
  - Tool-call argument parsing: OpenAI returns string JSON → provider yields parsed object.
  - Non-tool-supporting model surfaces a clean error.
- `credentials.test.ts`
  - Write creates file with mode `0o600`.
  - Read merges correctly, missing file returns `{}`.
  - `removeCredential` rewrites without the removed entry.
  - Never writes to `config.json`.
- `configure.test.ts` — extend to cover the "Add provider" flow with mocked inquirer prompts; assert credentials are written and a failed `listModels` rolls back.
- `streamChat.test.ts` — update for new provider-based signature; add one test per provider type.

## Phase B acceptance criteria

- `/configure` → "Manage providers" → "Add a new provider" → pick "Groq" → paste key → name it → see a model list → pick a model and set it as worker.
- Restart `brandon`; worker now streams from Groq, planner still on Ollama.
- `~/.brandon-code/credentials.json` contains the Groq entry; file mode is `0600`; `~/.brandon-code/config.json` contains `workerProviderId: "groq-main"` + `workerModel: "llama-3.3-70b-versatile"` and no API key.
- Switching back to a local model works without restarting.
- Removing a provider deletes its credential and unsets any `*ProviderId` pointing to it (fall back to `"ollama"`).
- All existing tests still pass.

---

## Risks & things to watch

1. **Raw-mode stdin lifecycle.** Mixing `promptWithSlashMenu` (raw) with `@inquirer/prompts` (cooked, owns stdin) is the likeliest source of bugs — dropped keystrokes, doubled echoes, orphaned handlers after errors. Defense: the widget must unconditionally restore cooked mode and remove its `keypress` listener in a `finally` block, and the dispatcher must await the handler so the widget isn't re-entered before the handler releases stdin.
2. **Terminal diversity.** ANSI escape codes behave differently on Windows Terminal, old cmd.exe, and tmux. Target: macOS Terminal, iTerm2, and Linux gnome-terminal. Document a `BRANDON_NO_SLASH_MENU=1` env fallback that skips the dropdown and uses tab completion only.
3. **Tool-call shape drift.** Different providers format tool calls differently enough that a naive passthrough corrupts arguments. Normalize at provider boundary, not in pipeline code.
4. **API key exfiltration.** Never log keys. Never embed them in error messages. Scrub them in `redactForLogs` (which already exists for secret patterns — extend it if needed).
5. **`listModels()` latency.** Remote providers can take seconds. Show a spinner, add a 10s timeout.
6. **Provider outage on REPL start.** Today, `ollama.list()` failure at `loop.ts:74-80` exits the REPL. With multiple providers, only block startup on the **active** provider; other providers are lazy.
7. **Paste handling.** Raw mode receives paste as one large chunk with embedded newlines. The widget should submit on the first newline and ignore the rest, or the user will accidentally submit multi-line input character by character.

## Open questions to revisit later

- Should planner and worker be able to use **different providers simultaneously**? Schema supports it (`plannerProviderId` / `workerProviderId`); UX for it is TBD. Current plan: yes, allowed, shown as advanced option.
- Per-provider system prompts / temperature overrides? Defer until we know which provider needs this.
- Should the slash menu show **recently used** commands first? Defer; alphabetical for now.
- `/model` as a shorthand alias that opens only the model picker step of `/configure`? Cheap to add; revisit once `/configure` works.

## Dependencies (summary)

**Phase A:**
- `@inquirer/prompts`

**Phase B:**
- `openai`
- *(optional)* `@anthropic-ai/sdk`, `@google/generative-ai`

## Build order (top-to-bottom checklist)

**Phase A**
1. Add `@inquirer/prompts` dep.
2. Create `src/agent/slash/types.ts` + `registry.ts` + tests.
3. Create `src/agent/slash/commands/help.ts` (trivial, validates end-to-end).
4. Create `src/agent/slash/dispatcher.ts` + tests.
5. Create `src/agent/slash/renderMenu.ts` (pure ANSI helpers) + tests.
6. Create `src/agent/slash/promptWithSlashMenu.ts` + tests (mock stdin).
7. Create `src/agent/slash/commands/configure.ts` (Ollama-only) + tests.
8. Create `src/agent/slash/index.ts` (registers all commands).
9. Edit `src/agent/loop.ts:118-134` to call `promptWithSlashMenu` + `dispatchSlashCommand`.
10. Manual smoke test: `npm run dev`, type `/configure`, pick a model, restart, confirm persistence.
11. Commit.

**Phase B**
1. Add `openai` dep.
2. Create `src/providers/types.ts`.
3. Create `src/providers/ollama.ts` wrapping current behavior.
4. Create `src/providers/registry.ts`.
5. Rewrite `src/agent/streamChat.ts` to take `ChatProvider`. Update `planner.ts`, `worker.ts`, `pipeline.ts`, `contextBootstrap.ts`. Run tests — green.
6. Create `src/config/credentials.ts` + tests.
7. Create `src/providers/openaiCompatible.ts` + tests.
8. Extend `/configure` with "Manage providers" branch.
9. Manual smoke test with a real Groq or DeepSeek key.
10. Commit.

## Acceptance summary

When both phases are done:
- User runs `brandon`, sees the banner, and types `/`.
- A dropdown appears listing `/configure` and `/help`.
- `/configure` opens an interactive picker, lets the user add Groq with one paste, pick a Groq model as the worker, and save.
- User exits, opens a different repo on the same machine, runs `brandon`, and the worker still runs on Groq without reconfiguration.
- User adds DeepSeek later with the same flow; both providers coexist in the picker.
- API keys live in `~/.brandon-code/credentials.json` (mode `0600`) and never appear in `config.json` or logs.
