import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
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
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

export async function readFileTool(filePath: string): Promise<string> {
  const target = resolvePath(filePath);
  return fs.readFile(target, "utf8");
}

export async function writeFileTool(
  filePath: string,
  content: string
): Promise<string> {
  const ok = await confirm(
    `Write ${path.resolve(process.cwd(), filePath)} (${content.length} bytes)?`
  );
  if (!ok) return "[skipped by user]";
  const target = resolvePath(filePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
  return `Wrote ${target}`;
}

export async function runBashTool(command: string): Promise<string> {
  const ok = await confirm(`Run shell command: ${command}`);
  if (!ok) return "[skipped by user]";
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    const child = spawn(command, {
      shell: true,
      cwd: process.cwd(),
      env: process.env,
    });
    child.stdout?.on("data", (d: Buffer) => {
      chunks.push(d);
      process.stdout.write(d);
    });
    child.stderr?.on("data", (d: Buffer) => {
      errChunks.push(d);
      process.stderr.write(d);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const out = Buffer.concat(chunks).toString("utf8");
      const err = Buffer.concat(errChunks).toString("utf8");
      resolve(
        `exit ${code}\n${out}${err ? `\nstderr:\n${err}` : ""}`.trim()
      );
    });
  });
}
