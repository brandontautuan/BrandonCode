/**
 * Phase 8 expects `src/context/loader.ts`; Phase 7 names `contextLoader.ts`.
 * Re-export from a single implementation.
 */
export {
  getLoadedContext,
  loadContext,
} from "./contextLoader.js";
