/**
 * Edits deferred until `src/index.ts`, `src/config/store.ts`, and `src/agent/loop.ts` are safe to change.
 */
export const DEFERRED_PHASE6_INTEGRATION_HOOKS = [
  "Register `model pick` as `brandon model pick` in src/index.ts (mirror other model subcommands).",
  "Call resolveActiveModelWithProject(getActiveModelId(), process.cwd()) in the agent REPL / pipeline when store can be extended or loop imports this resolver.",
  "Optionally persist banner theme preset in global config.json via store once store.ts is editable.",
  "Wire provider profile selection into Ollama chat options when agent layer reads profiles from disk.",
] as const;
