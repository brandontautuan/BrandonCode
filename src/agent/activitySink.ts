import chalk from "chalk";

export type ActivityMode = "concise" | "verbose";

/**
 * Best-effort redaction for logs (never rely on this for security-critical secrets).
 */
export function redactForLogs(text: string): string {
  let s = text;
  s = s.replace(/\bsk-[a-zA-Z0-9]{8,}\b/gi, "[REDACTED]");
  s = s.replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]");
  s = s.replace(/(api[_-]?key|password|token)\s*[=:]\s*(\S+)/gi, "$1=[REDACTED]");
  s = s.replace(/-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, "[REDACTED PEM]");
  return s;
}

export type ActivitySink = {
  readonly mode: ActivityMode;
  /** Concise: one dim line. Verbose: optional indented detail (redacted, capped). */
  stage: (shortLabel: string, detail?: string) => void;
  /** One-line summary always; full stack only in verbose mode. */
  reportError: (err: unknown) => void;
};

export function createActivitySink(mode: ActivityMode): ActivitySink {
  const stage = (shortLabel: string, detail?: string) => {
    console.log(chalk.dim(`⋯ ${shortLabel}`));
    if (mode === "verbose" && detail?.trim()) {
      const safe = redactForLogs(detail);
      const clip =
        safe.length > 2000 ? `${safe.slice(0, 2000)}\n… [truncated]` : safe;
      for (const line of clip.split("\n")) {
        console.log(chalk.gray(`   ${line}`));
      }
    }
  };

  const reportError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    const oneLine = redactForLogs(msg).split("\n")[0] ?? msg;
    console.error(chalk.red(`Error: ${oneLine}`));
    if (mode === "verbose") {
      const full =
        err instanceof Error ? err.stack ?? err.message : String(err);
      console.error(chalk.gray(redactForLogs(full)));
    } else {
      console.error(
        chalk.dim(
          "→ Full diagnostics: run with --activity-diagnostics or set `\"activity\": \"verbose\"` in ~/.brandon-code/config.json (or BRANDON_ACTIVITY=verbose)."
        )
      );
    }
  };

  return { mode, stage, reportError };
}
