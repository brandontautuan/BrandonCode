import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";

async function confirm(message: string): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return false;
  }
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const a = (await rl.question(`${message} [y/n]: `)).trim().toLowerCase();
    return a === "y" || a === "yes";
  } finally {
    rl.close();
  }
}

function resolvePath(p: string): string {
  const trimmed = p.trim();
  if (trimmed === "~") {
    return os.homedir();
  }
  if (trimmed.startsWith("~/")) {
    return path.join(os.homedir(), trimmed.slice(2));
  }
  return path.isAbsolute(trimmed)
    ? trimmed
    : path.resolve(process.cwd(), trimmed);
}

export async function writeFileTool(
  filePath: string,
  content: string,
  options?: { skipConfirm?: boolean }
): Promise<string> {
  const target = resolvePath(filePath);
  if (!options?.skipConfirm) {
    const ok = await confirm(
      `Write ${target} (${content.length} bytes)?`
    );
    if (!ok) return "[skipped by user]";
  }
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
  return `Wrote ${target}`;
}
