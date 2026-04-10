import { getStore } from "../config/store.js";

/**
 * Rotating welcome lines when the agent REPL starts.
 * Add strings to GREETINGS — each new CLI run shows the next one (persisted), then wraps.
 */
export const GREETINGS: readonly string[] = [
  "Hey — I'm Brandon. What are we building today?",
  "Welcome back. Drop a task or ask anything.",
  "Ready when you are. Code, review, or explore — your call.",
  "Good to see you. Tell me what you need.",
];

/** Next greeting; advances persisted index so rotation survives new `brandon` processes. */
export function nextGreeting(): string {
  const store = getStore();
  const len = GREETINGS.length;
  const raw = store.get("greetingRotationIndex");
  let idx =
    typeof raw === "number" && Number.isInteger(raw) && raw >= 0 ? raw % len : 0;
  const msg = GREETINGS[idx] ?? GREETINGS[0];
  store.set("greetingRotationIndex", (idx + 1) % len);
  return msg;
}

/** Test helper: reset persisted rotation index. */
export function resetGreetingRotationForTests(): void {
  getStore().set("greetingRotationIndex", 0);
}
