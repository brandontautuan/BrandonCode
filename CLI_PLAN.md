# Brandon Code CLI Plan

## Goal (Current Scope)
- Build a custom CLI that can switch between multiple AI models.
- Show a cool `Brandon Code` banner in the terminal when the CLI starts.
- Keep everything else minimal until these two requirements are stable.

## Runtime Decision
- Chosen runtime: **Node.js**.
- Language recommendation: **TypeScript** (safer refactors + better autocomplete).
- Minimum target: Node `20+`.

## Confirmed Inputs
- Initial model families: `Gemini 3 Pro`, `MiniMax M2.5`, `MiniMax M2.7`, `Ollama`.
- Banner style: **ASCII art + color gradient**.
- Config location: `~/.brandon-code/config.json`.
- Ollama strategy: support **both local-only and cloud-backed** model IDs.

## Phase 1: Define the MVP
**Status: implemented** (see repo root `package.json`, `src/`, run `npm run dev` or `npm run build && npm start`).

### Features in scope
- `model switch`: change active model quickly.
- `model list`: display available models.
- `model current`: show current active model.
- `model add`: add new model entries without code changes.
- `model remove`: remove model entries you do not want.
- Startup banner: render `Brandon Code` on launch.

### Default model list for first build
- `gemini-3-pro`
- `minimax-m2.5`
- `minimax-m2.7`
- `ollama/qwen2.5-coder:14b` (quality-first local default for M2 Pro 16GB)
- `ollama/qwen2.5-coder:7b` (faster local fallback)
- `ollama/glm-4.7:cloud` (cloud-backed quality option)

### Node.js starter stack
- CLI framework: `commander`
- Terminal styling: `chalk`
- Optional ASCII art: `figlet`
- Config persistence: `conf` (stores local CLI config safely)
- Dev tooling: `typescript`, `tsx`
- Testing: `vitest`

## Phase 2: CLI Architecture
### Suggested structure
- `src/commands/model/switch`
- `src/commands/model/list`
- `src/commands/model/current`
- `src/ui/banner`
- `src/config/store`

### Core concepts
- **Model Registry**: one place that defines model IDs and labels.
- **Active Model State**: persisted current model in user config.
- **Command Router**: maps terminal commands to handlers.
- **Banner Renderer**: prints branded header with safe terminal colors.
- **Node Entrypoint**: `src/index.ts` bootstraps commands + banner.
- **User Extendability**: merge default models + user-defined models from config.

## Phase 3: Model Switching Design
### Data model
- `availableModels`: array of model identifiers (for example `gpt-5`, `gpt-4.1`, `o4-mini`).
- `activeModel`: single string key that must exist in `availableModels`.

### Switching behavior
- Validate requested model exists.
- Save selected model to config.
- Confirm success in terminal output.
- If invalid model is provided, show allowed values and keep current model unchanged.

### Add/remove model behavior
- `model add <id> --label <name>`: appends a custom model to config.
- `model remove <id>`: removes a custom model from config.
- Protect default built-in models from accidental removal unless `--force-default` is passed.
- Allow optional metadata on add (provider + locality): `--provider ollama --mode local|cloud`.

### Safety checks
- Never save an empty or unknown model value.
- On first run, auto-select a default model.
- If config is corrupted, recover gracefully with a default and warning.
- Reject duplicates during `model add`.
- Warn if a selected local model is likely too heavy for available memory and suggest a lighter fallback.

## Phase 4: Brandon Code Terminal Branding
### Startup behavior
- Render `Brandon Code` at app start.
- Use color + spacing so it looks intentional but still readable.
- Add a `--no-banner` flag for clean scripting use.

### Selected banner style
- **Option C: ASCII art + subtle color gradient**
- Use `figlet` to generate `Brandon Code` ASCII text.
- Apply per-character gradient with `chalk` for a smooth terminal look.
- Keep `--no-banner` as a bypass for scripts and automation.

## Phase 5: Validation + Test Plan
**Status: implemented** — `vitest` covers store (`src/config/store.test.ts`), banner (`src/ui/banner.test.ts`), model command handlers (`src/commands/model.test.ts`), and CLI integration (`src/cli.integration.test.ts`, builds then runs `dist/index.js`). Run `npm test`.

- Unit tests for model validation and config persistence.
- Command tests for `switch`, `list`, `current`, `add`, and `remove`.
- Startup test to verify banner prints and `--no-banner` suppresses output.
- Manual test (optional sanity pass on your machine):
  1. Start CLI.
  2. Confirm `Brandon Code` appears.
  3. Run `model list`.
  4. Run `model switch <model-id>`.
  5. Run `model add custom-model --label "Custom Model"`.
  6. Run `model current` and verify persistence across restarts.

## Phase 6: Future Enhancements (Not in MVP)
- Interactive model picker menu.
- Per-project model overrides.
- Provider-specific profiles (temperature, max tokens, tools).
- Theme presets for banner colors and style.

## Phase 7: Persistent Context System
**Status: implemented (MVP).**

- `context/agent.md` — lean agent-facing context (≤ 100 lines; currently condensed from this plan).
- `src/context/contextLoader.ts` — `loadContext()` (empty string if missing); `src/context/loader.ts` re-exports for Phase 8.
- `src/context/contextUpdater.ts` — `brandon-code context finish` proposes a patch with **`Proposed context update (N/100 lines)`**, overflow rules (compress checklist → move phase-tagged decisions → archive full Active decisions block → interactive line drop), **`y`/`n`** apply; writes `context/sessions/YYYY-MM-DD.md` on approval.
- `src/index.ts` — calls `loadContext()` on every command startup (after optional banner). **Session-end updater:** use `brandon-code context finish` until Phase 8 REPL wires exit → updater.

### Objective
- Add a persistent context layer for BrandonCode so each agent session can load and maintain a lean, up-to-date project context.

### Requirements to implement (next build step)
1. Create `context/agent.md` by condensing `CLI_PLAN.md` into fewer than 100 lines with:
   - One-line project summary
   - Stack (runtime, language, key libs, constraints)
   - Project structure (file tree + one-line descriptions)
   - Current state checklist (done / in-progress / todo)
   - Active decisions (not to re-debate)
   - Patterns to follow (conventions, interfaces, error handling)
   - What NOT to do
   - Last updated (date + one-line session note)
2. Create `src/context/contextLoader.ts`:
   - Read `context/agent.md` at agent startup
   - If `context/agent.md` does **not** exist yet, `loadContext()` returns an **empty string** (do not throw); the system prompt then has no prepended project context until the file exists
   - Prepend non-empty context text to the system prompt of every model call
   - Export `loadContext(): string`
3. Create `src/context/contextUpdater.ts`:
   - Generate a proposed diff for `context/agent.md` at session end
   - Print it clearly labeled with line budget, e.g. `Proposed context update (87/100 lines)`
   - Ask user confirmation (`y` apply / `n` skip) before writing to disk
   - Auto-update the `Last updated` line on approval
   - **Overflow handling (must never silently truncate):** if applying the proposed update would push `context/agent.md` over **100 lines**, the updater must:
     - Compress any **completed** checklist phases into a **single summary line**
     - Move any decisions **older than the current phase** into `context/decisions.md` (see **File formats** below)
     - Log the session summary to `context/sessions/YYYY-MM-DD.md` (see **File formats** below)
     - If it **still** cannot fit within 100 lines after those steps, **warn** the user and **ask what to archive** (no silent truncation)
4. Wire into `src/index.ts`:
   - Call `loadContext()` before any model initialization
   - Call the updater at end of each session
5. Keep `CLI_PLAN.md` unchanged as the historical record; `context/agent.md` is the lean runtime context.

### File formats (`context/`)
So the updater writes consistently, use these shapes:

- **`context/decisions.md`:** append-only Markdown. Each decision is a section:
  - Heading: `## YYYY-MM-DD — <decision title>`
  - Body: **2–3 lines** explaining the decision (what was chosen and why)
- **`context/sessions/YYYY-MM-DD.md`:** one file per calendar day (create `context/sessions/` if missing). Content is a **bullet list** with three groups:
  - What was built
  - What changed
  - What’s next

### Execution rule for this phase
- Before writing code/files for this phase, show the proposed `context/agent.md` content first and wait for user approval.

## Phase 8: Core Agent REPL + Tooling
**Status: implemented (MVP).**

### Objective
- Add an interactive agent REPL so `npm run dev` or `brandon` starts a persistent terminal session that can chat, call tools, and continue until explicit exit.

### Requirements implemented
1. Create `src/agent/loop.ts`:
   - Readline-based input loop that runs until user types `exit`
   - Maintain full `messages[]` conversation history for the session
   - Load context via `loadContext()` from `src/context/loader.ts` and prepend to the system prompt
   - Stream model response tokens/chunks to stdout as they arrive
   - After each response, detect model tool-call requests and execute via `toolRunner.ts`
2. Create `src/agent/tools.ts`:
   - `readFile(path)`: read file contents
   - `writeFile(path, content)`: write file after user `y/n` confirmation
   - `runBash(command)`: run shell command with streamed stdout after user `y/n` confirmation
3. Create `src/agent/toolRunner.ts`:
   - Parse/receive tool-call requests from model outputs
   - Route each request to the correct tool function
   - Return tool output into message history so the model can continue
4. Wire into `src/index.ts`:
   - Show startup banner first
   - Start agent loop immediately after banner
   - On REPL exit, call context updater
5. Model/provider for this phase:
   - Use Ollama via `ollama` (ollama-js) SDK
   - Configure via `~/.brandon-code/config.json` keys `ollamaHost` / `ollamaModel` (defaults: `http://127.0.0.1:11434`, `qwen2.5-coder:7b`), with optional merge from `~/.brandoncode/config.json` if present
6. Tool safety UX:
   - Keep confirmations simple (`y` apply / `n` skip) in terminal prompts

### Scope note
- This phase defines runtime agent behavior; existing model-management commands remain available and should be reconciled with REPL startup flow during implementation.

## Phase 9: Planner + Worker Pipeline (Two-Agent Split)
**Status: implemented.**

### Objective
- Implement a two-agent pipeline with clean separation between planning and execution.

### Requirements implemented
1. `src/agent/planner.ts` — `buildPlan(userInput)` loads `context/agent.md`, discovers up to five files (always including `context/agent.md` and `src/index.ts` when present), calls the planner model, returns structured Markdown with the six required sections.
2. `src/agent/worker.ts` — `executeplan(plan)` runs the worker model with tools (streams to the terminal), returns JSON describing text + tool calls; does **not** use `loadContext()`.
3. `src/agent/pipeline.ts` — `runPipeline(userInput)` prints `── planner ──` / `── worker ──`, approval `y` / `n` / `e` (`e` re-runs worker after `$EDITOR`; default `nano`).
4. `src/agent/loop.ts` — REPL turns call `runPipeline` (startup Ollama check + greeting + context-finish unchanged).
5. Config — `plannerModel` and `workerModel` in `~/.brandon-code/config.json` with merge from `~/.brandoncode/config.json`; `workerModel` defaults to `ollamaModel`, `plannerModel` defaults to `workerModel`.

## Suggested First Build Order
1. Scaffold Node.js + TypeScript CLI project.
2. Add config store.
3. Add model registry + `list/current/switch`.
4. Add startup banner.
5. Add tests.
6. Iterate on UX.

## Confirmation Checklist
Confirmed:
- Runtime/language: Node.js + TypeScript
- Initial model list: Gemini 3 Pro, MiniMax M2.5, MiniMax M2.7, Ollama
- Banner style: Option C (ASCII + gradient)
- Config path: `~/.brandon-code/config.json`

## Quick Start Commands (when ready to build)
```bash
npm init -y
npm install commander chalk conf figlet
npm install -D typescript tsx vitest @types/node
npx tsc --init
```
