import chalk from "chalk";
import { createTwoFilesPatch } from "diff";
import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import {
  agentMdPath,
  decisionsMdPath,
  ensureContextDirs,
  getContextBaseDir,
  sessionMdPath,
  todayIsoDate,
} from "./paths.js";

const MAX_AGENT_LINES = 100;

/** Engineering phase for “older than current phase” decision moves. */
function currentPhaseNumber(): number {
  const raw = process.env.BRANDON_CODE_CONTEXT_PHASE;
  const n = raw ? Number.parseInt(raw, 10) : 7;
  return Number.isFinite(n) ? n : 7;
}

export function lineCount(text: string): number {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
}

function touchLastUpdated(md: string, note: string): string {
  const d = todayIsoDate();
  const line = `**Last updated:** ${d} — ${note}`;
  if (/^\*\*Last updated:\*\*.*/m.test(md)) {
    return md.replace(/^\*\*Last updated:\*\*.*$/m, line);
  }
  return `${md.trimEnd()}\n\n${line}\n`;
}

function compressCurrentStateToSummary(md: string): string {
  return md.replace(
    /## Current state\r?\n[\s\S]*?(?=\r?\n## Active decisions\b)/,
    "## Current state\n\n" +
      "- **Checklist (compressed):** Phases 1–5 delivered; Phase 7–8 in flight. Full detail in `CLI_PLAN.md`.\n\n"
  );
}

function filterDecisionsByPhase(body: string, phase: number): {
  keep: string;
  move: string;
} {
  const lines = body.split(/\r?\n/);
  const keep: string[] = [];
  const move: string[] = [];
  const re = /phase\s*(\d+)/i;
  for (const line of lines) {
    const m = line.match(re);
    const n = m ? Number.parseInt(m[1], 10) : null;
    if (n !== null && n < phase && line.trim().startsWith("-")) {
      move.push(line);
    } else {
      keep.push(line);
    }
  }
  return {
    keep: keep.join("\n").trim(),
    move: move.join("\n").trim(),
  };
}

function appendDecisionsArchive(date: string, title: string, body: string): void {
  fs.mkdirSync(path.join(getContextBaseDir(), "context"), { recursive: true });
  const p = decisionsMdPath();
  const lines = body.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const explanation =
    lines
      .slice(0, 3)
      .join("\n")
      .trim() || "(no bullet lines)";
  const block = `\n## ${date} — ${title}\n\n${explanation}\n`;
  fs.appendFileSync(p, block, "utf8");
}

function writeSessionLog(
  date: string,
  opts: {
    whatWasBuilt: string;
    whatChanged: string;
    whatsNext: string;
  }
): void {
  ensureContextDirs();
  const p = sessionMdPath(date);
  const chunk = [
    `## ${date}`,
    "",
    "### What was built",
    opts.whatWasBuilt,
    "",
    "### What changed",
    opts.whatChanged,
    "",
    "### What's next",
    opts.whatsNext,
    "",
  ].join("\n");
  if (fs.existsSync(p)) {
    fs.appendFileSync(p, "\n" + chunk, "utf8");
  } else {
    fs.writeFileSync(p, chunk + "\n", "utf8");
  }
}

function extractBetween(
  md: string,
  startHeading: string,
  endHeading: string
): string | null {
  const esc = startHeading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `${esc}\\r?\\n([\\s\\S]*?)(?=\\r?\\n## ${endHeading}\\b)`,
    "m"
  );
  const m = md.match(re);
  return m ? m[1].trim() : null;
}

function applyActiveDecisionsSplit(
  md: string,
  phase: number,
  date: string
): { md: string; moved: boolean } {
  const body = extractBetween(md, "## Active decisions", "Patterns");
  if (!body) return { md, moved: false };
  const { keep, move } = filterDecisionsByPhase(body, phase);
  if (!move) return { md, moved: false };

  appendDecisionsArchive(
    date,
    "Archived decisions (phase overflow)",
    move
  );

  const placeholder =
    keep.length > 0
      ? keep
      : "- *(older bullets moved to `context/decisions.md`)*";
  const next = md.replace(
    /## Active decisions\r?\n[\s\S]*?(?=\r?\n## Patterns\b)/,
    `## Active decisions\n\n${placeholder}\n\n`
  );
  return { md: next, moved: true };
}

async function promptYesNo(question: string): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.log(chalk.dim(`${question} (non-interactive — skipping apply)`));
    return false;
  }
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const a = (await rl.question(question)).trim().toLowerCase();
    return a === "y" || a === "yes";
  } finally {
    rl.close();
  }
}

async function promptLineRangeOrAbort(
  maxLine: number
): Promise<number[] | "abort"> {
  if (!process.stdin.isTTY) return "abort";
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const raw = (
      await rl.question(
        chalk.yellow(
          `Still over ${MAX_AGENT_LINES} lines. Enter 1-based line range to DROP from proposed file (e.g. 12-18), or blank to abort: `
        )
      )
    ).trim();
    if (!raw) return "abort";
    const m = raw.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!m) return "abort";
    const a = Number.parseInt(m[1], 10);
    const b = Number.parseInt(m[2], 10);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < 1 || b < a) {
      return "abort";
    }
    const hi = Math.min(b, maxLine);
    const out: number[] = [];
    for (let i = a; i <= hi; i++) out.push(i);
    return out;
  } finally {
    rl.close();
  }
}

function dropLinesByOneBasedIndex(content: string, oneBased: number[]): string {
  const lines = content.split(/\r?\n/);
  const drop = new Set(oneBased.map((n) => n - 1));
  return lines
    .filter((_, i) => !drop.has(i))
    .join("\n");
}

/**
 * Build a proposed `agent.md` body from the current file, applying overflow rules until it fits or we need user input.
 */
export async function buildProposedAgentMarkdown(
  sessionNote: string
): Promise<{ proposed: string; before: string; steps: string[] }> {
  const p = agentMdPath();
  const before = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  let proposed = touchLastUpdated(before || defaultAgentStub(), sessionNote);
  const steps: string[] = ["Update **Last updated** line"];

  const phase = currentPhaseNumber();
  const date = todayIsoDate();

  const runSplit = (): void => {
    const r = applyActiveDecisionsSplit(proposed, phase, date);
    if (r.moved) {
      proposed = r.md;
      steps.push(
        `Move decision bullets with Phase < ${phase} to context/decisions.md`
      );
    }
  };

  if (lineCount(proposed) > MAX_AGENT_LINES) {
    proposed = compressCurrentStateToSummary(proposed);
    steps.push("Compress **Current state** checklist to a single summary line");
  }

  if (lineCount(proposed) > MAX_AGENT_LINES) {
    runSplit();
  }

  if (lineCount(proposed) > MAX_AGENT_LINES) {
    const body =
      extractBetween(proposed, "## Active decisions", "Patterns") ?? "";
    if (body) {
      appendDecisionsArchive(
        date,
        "Archived Active decisions block (overflow)",
        body
      );
      proposed = proposed.replace(
        /## Active decisions\r?\n[\s\S]*?(?=\r?\n## Patterns\b)/,
        "## Active decisions\n\n- *(block archived to `context/decisions.md` — overflow)*\n\n"
      );
      steps.push("Archive full **Active decisions** block to context/decisions.md");
    }
  }

  if (lineCount(proposed) > MAX_AGENT_LINES) {
    console.log(
      chalk.red(
        `Still ${lineCount(proposed)} lines — manual line drop required (no silent truncation).`
      )
    );
    const drop = await promptLineRangeOrAbort(lineCount(proposed));
    if (drop === "abort") {
      throw new Error("Context update aborted (still over line budget).");
    }
    proposed = dropLinesByOneBasedIndex(proposed, drop);
    steps.push(`User dropped lines: ${drop[0]}-${drop[drop.length - 1]}`);
  }

  return { proposed, before, steps };
}

function defaultAgentStub(): string {
  return "# BrandonCode — agent context\n\n_(stub — fill from CLI_PLAN.md)_\n";
}

export type SessionLogBullets = {
  whatWasBuilt: string;
  whatChanged: string;
  whatsNext: string;
};

/**
 * Propose a patch, print it with line budget, prompt y/n, then write files on approval.
 */
export async function runContextFinishFlow(opts: {
  sessionNote: string;
  bullets: SessionLogBullets;
}): Promise<void> {
  const date = todayIsoDate();
  let proposed: string;
  let before: string;
  let steps: string[];

  try {
    const built = await buildProposedAgentMarkdown(opts.sessionNote);
    proposed = built.proposed;
    before = built.before;
    steps = built.steps;
  } catch (e) {
    console.error(
      chalk.red(e instanceof Error ? e.message : String(e))
    );
    process.exitCode = 1;
    return;
  }

  const n = lineCount(proposed);
  const patch = createTwoFilesPatch(
    "agent.md",
    "agent.md",
    before,
    proposed
  );

  console.log("");
  console.log(
    chalk.bold(
      `Proposed context update (${n}/${MAX_AGENT_LINES} lines)`
    )
  );
  console.log(chalk.dim(steps.map((s) => `• ${s}`).join("\n")));
  console.log("");
  console.log(patch);

  const ok = await promptYesNo(
    chalk.cyan("Apply context update to disk? [y/n]: ")
  );
  if (!ok) {
    console.log(chalk.dim("Skipped — no files written."));
    return;
  }

  fs.mkdirSync(path.join(getContextBaseDir(), "context"), { recursive: true });
  fs.writeFileSync(agentMdPath(), proposed, "utf8");

  writeSessionLog(date, {
    whatWasBuilt: opts.bullets.whatWasBuilt,
    whatChanged: opts.bullets.whatChanged,
    whatsNext: opts.bullets.whatsNext,
  });

  console.log(chalk.green("Updated context/agent.md and session log."));
}
