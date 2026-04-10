# BrandonCode — agent context

One-line summary: **Private Node.js + TypeScript CLI for model switching, terminal branding, persistent context, and an Ollama-powered agent REPL with tools.**

## Stack

- **Runtime:** Node 20+
- **Language:** TypeScript (ESM, `NodeNext`)
- **CLI:** `commander`, `chalk`, `figlet`, `conf`
- **Tests:** `vitest`
- **Constraints:** Config under `~/.brandon-code/config.json`; lean `context/agent.md` ≤ **100 lines**; `CLI_PLAN.md` is the full historical spec

## Project structure

```
BrandonCode/
├── CLI_PLAN.md           # Full plan & phases
├── context/
│   ├── agent.md          # This file — runtime agent context
│   ├── decisions.md      # Archived decisions (updater)
│   └── sessions/         # Daily session logs (updater)
├── src/
│   ├── index.ts          # CLI entry, banner, model + context commands
│   ├── config/           # default models, Conf store
│   ├── commands/model.ts # model list|current|switch|add|remove
│   ├── agent/            # REPL loop, tools, Ollama tool runner
│   ├── ui/banner.ts      # Figlet + boxed banner
│   └── context/          # loader + updater (Phase 7)
└── dist/                 # `tsc` output
```

## Current state

- [x] **Phase 1 — MVP:** model registry, switch/list/current/add/remove, banner, config
- [x] **Phase 2–4:** architecture in code; branding (`--no-banner`)
- [x] **Phase 5:** vitest (store, banner, model cmds, CLI integration)
- [ ] **Phase 6:** future (picker, per-project models, provider profiles)
- [x] **Phase 7:** persistent `context/` loader + session-end updater (`context finish`)
- [x] **Phase 8:** Ollama agent REPL (`brandon-code` / `agent`), tools (`read_file`, `write_file`, `run_bash`), `ollama` SDK

## Active decisions

- Primary config **`~/.brandon-code/config.json`**; optional **`~/.brandoncode/config.json`** may supply `ollamaHost` / `ollamaModel` if keys are absent in the primary file.
- **Context overflow:** never silently truncate `agent.md`; compress checklist → archive decisions → session log → prompt if still over 100 lines.
- **Secrets:** `.env*` and key files gitignored; no keys in repo.

## Patterns

- Match existing style: small modules, `chalk` for UX, Commander subcommands.
- Errors: set `process.exitCode = 1` for CLI failures; don’t throw for expected validation errors.
- Tests: temp config via `BRANDON_CODE_CONFIG_DIR`; integration tests build `dist/` first.

## What NOT to do

- Don’t delete or replace `CLI_PLAN.md` with `agent.md`.
- Don’t commit API keys or `.env` secrets.
- Don’t silently truncate `context/agent.md`.

**Last updated:** 2026-04-10 — Phase 8 agent REPL; set `ollamaHost` / `ollamaModel` in `~/.brandon-code/config.json`.
