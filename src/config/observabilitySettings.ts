import type { ActivityMode } from "../agent/activitySink.js";
import { getStore } from "./store.js";

/**
 * Resolve REPL activity / diagnostics mode: explicit override, then `BRANDON_ACTIVITY`, then config `activity`.
 */
export function resolveActivityMode(override?: ActivityMode): ActivityMode {
  if (override) return override;
  const env = process.env.BRANDON_ACTIVITY?.trim().toLowerCase();
  if (env === "verbose" || env === "debug") return "verbose";
  if (env === "concise") return "concise";
  const a = getStore().get("activity");
  if (a === "verbose") return "verbose";
  return "concise";
}
