import chalk from "chalk";
import type { Message, Ollama } from "ollama";
import fs from "node:fs";
import path from "node:path";
import type { Interface as ReadlineInterface } from "node:readline/promises";
import { isThinkUnsupportedError } from "../agent/ollamaErrors.js";
import { streamChatCompletion } from "../agent/streamChat.js";
import { getOllamaThinkForRequest } from "../config/ollamaSettings.js";
import { agentMdPath, getContextBaseDir } from "./paths.js";

const STUB_MARKERS = [
  "Stack (fill in)",
  "Runtime / language:",
  "**Bootstrap created:**",
];

/**
 * True when `agent.md` is missing, blank, or still the unedited bootstrap stub
 * written by `buildDefaultAgentContextMarkdown`. A populated file — even a one-liner
 * the user wrote themselves — returns false.
 */
export function isContextEmpty(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  const hasStubMarkers = STUB_MARKERS.every((m) => t.includes(m));
  if (!hasStubMarkers) return false;
  const runtimeLine = t.match(/^-[ \t]*Runtime \/ language:[ \t]*(.*)$/m);
  const filled = runtimeLine?.[1]?.trim();
  return !filled;
}

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  "build",
  "coverage",
  ".next",
  ".turbo",
  ".cache",
  ".venv",
  "venv",
  "__pycache__",
]);
const SOURCE_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
  ".rs",
]);
const MAX_TREE_ENTRIES = 80;
const MAX_SAMPLE_FILES = 10;
const MAX_SAMPLE_BYTES = 2000;
const MAX_README_BYTES = 4000;

function listTree(root: string, maxDepth: number): string[] {
  const out: string[] = [];
  const walk = (dir: string, depth: number, prefix: string): void => {
    if (depth > maxDepth || out.length >= MAX_TREE_ENTRIES) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      if (out.length >= MAX_TREE_ENTRIES) break;
      if (e.name.startsWith(".") && e.name !== ".env.example") continue;
      if (SKIP_DIRS.has(e.name)) continue;
      out.push(`${prefix}${e.name}${e.isDirectory() ? "/" : ""}`);
      if (e.isDirectory()) {
        walk(path.join(dir, e.name), depth + 1, `${prefix}  `);
      }
    }
  };
  walk(root, 0, "");
  return out;
}

function readHead(p: string, max: number): string {
  try {
    const buf = fs.readFileSync(p);
    return buf.subarray(0, max).toString("utf8");
  } catch {
    return "";
  }
}

function findSourceSamples(root: string): string[] {
  const found: string[] = [];
  const preferred = [
    "src/index.ts",
    "src/main.ts",
    "src/app.ts",
    "src/index.js",
    "index.ts",
    "main.ts",
    "main.py",
    "main.go",
  ];
  for (const rel of preferred) {
    if (found.length >= MAX_SAMPLE_FILES) break;
    const p = path.join(root, rel);
    if (fs.existsSync(p) && !found.includes(p)) found.push(p);
  }

  const srcDir = path.join(root, "src");
  const startDir = fs.existsSync(srcDir) ? srcDir : root;

  const walk = (dir: string, depth: number): void => {
    if (depth > 3 || found.length >= MAX_SAMPLE_FILES) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (found.length >= MAX_SAMPLE_FILES) break;
      if (SKIP_DIRS.has(e.name) || e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full, depth + 1);
      } else if (SOURCE_EXT.has(path.extname(e.name))) {
        if (!found.includes(full) && !e.name.endsWith(".test.ts")) {
          found.push(full);
        }
      }
    }
  };
  walk(startDir, 0);
  return found.slice(0, MAX_SAMPLE_FILES);
}

export type RepoFacts = {
  root: string;
  tree: string;
  packageJson: string;
  readme: string;
  samples: Array<{ path: string; snippet: string }>;
};

/**
 * Deterministic repo scan — no model calls. Captures a tight slice of the
 * repo so a small LLM can write a real `agent.md` from it.
 */
export function gatherRepoFacts(root: string = getContextBaseDir()): RepoFacts {
  const tree = listTree(root, 2).join("\n");

  let packageJson = "";
  const pkgPath = path.join(root, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as Record<
        string,
        unknown
      >;
      const slim = {
        name: raw.name,
        description: raw.description,
        type: raw.type,
        engines: raw.engines,
        scripts: raw.scripts,
        dependencies:
          raw.dependencies && typeof raw.dependencies === "object"
            ? Object.keys(raw.dependencies as object)
            : undefined,
        devDependencies:
          raw.devDependencies && typeof raw.devDependencies === "object"
            ? Object.keys(raw.devDependencies as object)
            : undefined,
      };
      packageJson = JSON.stringify(slim, null, 2);
    } catch {
      packageJson = readHead(pkgPath, 2000);
    }
  }

  let readme = "";
  for (const name of ["README.md", "readme.md", "Readme.md"]) {
    const p = path.join(root, name);
    if (fs.existsSync(p)) {
      readme = readHead(p, MAX_README_BYTES);
      break;
    }
  }

  const samples = findSourceSamples(root).map((p) => ({
    path: path.relative(root, p),
    snippet: readHead(p, MAX_SAMPLE_BYTES),
  }));

  return { root, tree, packageJson, readme, samples };
}

function buildScanPrompt(facts: RepoFacts): string {
  const parts: string[] = [];
  parts.push(
    "You are generating `context/agent.md` for a BrandonCode CLI agent working in the repository below."
  );
  parts.push(
    "The file is read at the start of every agent session so the agent knows what the project is, how to build/run it, and what the conventions are."
  );
  parts.push("");
  parts.push("Rules:");
  parts.push(
    "- State only facts supported by the inputs below. If you don't know something, omit it — do not speculate."
  );
  parts.push("- Keep it concise: bullet points, no filler prose. Aim for under 80 lines.");
  parts.push(
    "- Use these sections, in this order: `# Project context`, `## Purpose`, `## Stack`, `## Key commands`, `## Layout`, `## What NOT to do`."
  );
  parts.push(
    "- `## Layout` lists the important top-level directories with one-line descriptions."
  );
  parts.push(
    "- `## What NOT to do` must include: don't commit secrets, don't delete or overwrite this file."
  );
  parts.push(
    "- End with exactly one line: `**Bootstrap generated:** " +
      new Date().toISOString().slice(0, 10) +
      "`"
  );
  parts.push(
    "- Output raw Markdown only. No code fences wrapping the whole document, no preamble, no closing commentary."
  );
  parts.push("");
  parts.push(`## Repo root\n${facts.root}`);
  parts.push("");
  parts.push("## Directory tree (depth 2)");
  parts.push("```");
  parts.push(facts.tree || "(empty)");
  parts.push("```");
  if (facts.packageJson) {
    parts.push("");
    parts.push("## package.json (slim)");
    parts.push("```json");
    parts.push(facts.packageJson);
    parts.push("```");
  }
  if (facts.readme) {
    parts.push("");
    parts.push("## README.md (head)");
    parts.push("```");
    parts.push(facts.readme);
    parts.push("```");
  }
  if (facts.samples.length > 0) {
    parts.push("");
    parts.push("## Source samples");
    for (const s of facts.samples) {
      parts.push(`### ${s.path}`);
      parts.push("```");
      parts.push(s.snippet);
      parts.push("```");
    }
  }
  return parts.join("\n");
}

export async function promptPopulateContext(
  rl: ReadlineInterface
): Promise<boolean> {
  console.log(
    chalk.yellow(
      "⚠ context/agent.md is empty — I don't know anything about this project yet."
    )
  );
  console.log(
    chalk.dim(
      "If you say yes, I'll scan the codebase and write a summary to context/agent.md — the only file I will touch."
    )
  );
  const answer = (
    await rl.question(chalk.cyan("Scan codebase and populate context? [y/n]: "))
  )
    .trim()
    .toLowerCase();
  return answer === "y" || answer === "yes";
}

export function printLoserExit(): void {
  console.log(chalk.magenta("ok loser 👋  — come back when you're ready."));
}

export type PopulateContextDeps = {
  ollama: Ollama;
  model: string;
  enableThinking?: boolean;
};

async function chatWithThinkFallback(
  deps: PopulateContextDeps,
  messages: Message[]
): Promise<Message | undefined> {
  const think = getOllamaThinkForRequest(deps.enableThinking !== false);
  try {
    return await streamChatCompletion(
      deps.ollama,
      deps.model,
      messages,
      think !== undefined ? { think } : {}
    );
  } catch (err) {
    if (think === undefined || !isThinkUnsupportedError(err)) {
      throw err;
    }
    return await streamChatCompletion(deps.ollama, deps.model, messages, {});
  }
}

/**
 * One-shot codebase scan → `context/agent.md` writer. Runs the worker model with
 * no tools at all, then writes the response straight to `agent.md` via fs. By
 * construction this flow cannot touch any other file.
 */
export async function populateContextFromCodebase(
  deps: PopulateContextDeps
): Promise<void> {
  const facts = gatherRepoFacts();
  const prompt = buildScanPrompt(facts);

  const treeCount = facts.tree.split("\n").filter(Boolean).length;
  console.log(chalk.dim("⋯ Scanning codebase…"));
  console.log(
    chalk.dim(
      `  root: ${facts.root}\n  tree entries: ${treeCount}\n  samples: ${facts.samples.length}`
    )
  );

  const assistant = await chatWithThinkFallback(deps, [
    {
      role: "system",
      content:
        "You generate concise, factual project context files. Output raw Markdown only. No speculation, no filler.",
    },
    { role: "user", content: prompt },
  ]);

  const body = String(assistant?.content ?? "").trim();
  if (!body) {
    console.log(
      chalk.red("Model returned empty output — context/agent.md not updated.")
    );
    return;
  }

  const p = agentMdPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body + "\n", "utf8");
  const rel = path.relative(process.cwd(), p);
  console.log(chalk.green(`✓ Wrote ${rel || p}`));
}
