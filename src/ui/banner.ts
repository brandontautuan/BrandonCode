import chalk from "chalk";
import figlet from "figlet";

/** Outer width of boxed lines (`| ` … ` |`) — keeps banner within 100 columns. */
const MAX_TOTAL_WIDTH = 100;

/** Padded content width between `| ` and ` |` (inclusive of spaces inside). */
const INNER_MAX = MAX_TOTAL_WIDTH - 4;

const TITLE = "BrandonCode";
const SUBTITLE = "  AI CLI · gemini · ollama · minimax";

const GAP = "  ";

function stripAnsi(s: string): string {
  return s.replace(/\u001b\[[0-9;]*m/g, "");
}

/** Minimal geometric “target / diamond” — only `-`, `|`, `/`, `\\`, `o` (6 lines). */
const SYMBOL_LINES_RAW = [
  "     /\\      ",
  "    /  \\     ",
  "   / -- \\    ",
  "  |  o   |   ",
  "  | \\-/  |   ",
  "   \\____/    ",
] as const;

const SYMBOL_WIDTH = Math.max(
  ...SYMBOL_LINES_RAW.map((l) => l.length)
);

const SYMBOL_LINES = SYMBOL_LINES_RAW.map((l) =>
  l.length < SYMBOL_WIDTH ? l + " ".repeat(SYMBOL_WIDTH - l.length) : l
);

/** Cyan (left) → magenta (right) across the title. */
const GRADIENT_START: [number, number, number] = [0, 220, 255];
const GRADIENT_END: [number, number, number] = [255, 40, 220];

function gradientText(
  text: string,
  start: [number, number, number],
  end: [number, number, number]
): string {
  const chars = [...text];
  const n = Math.max(chars.length - 1, 1);
  return chars
    .map((c, i) => {
      const t = i / n;
      const r = Math.round(start[0] + (end[0] - start[0]) * t);
      const g = Math.round(start[1] + (end[1] - start[1]) * t);
      const b = Math.round(start[2] + (end[2] - start[2]) * t);
      if (c === "\n") return "\n";
      return chalk.rgb(r, g, b)(c);
    })
    .join("");
}

function trimTrailingEmptyLines(lines: string[]): string[] {
  const out = [...lines];
  while (out.length > 0 && out[out.length - 1].trim() === "") {
    out.pop();
  }
  return out;
}

function clampPlain(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen);
}

function rowRgb(
  rowIndex: number,
  rowCount: number,
  start: [number, number, number],
  end: [number, number, number]
): [number, number, number] {
  const n = Math.max(rowCount - 1, 1);
  const t = rowIndex / n;
  return [
    Math.round(start[0] + (end[0] - start[0]) * t),
    Math.round(start[1] + (end[1] - start[1]) * t),
    Math.round(start[2] + (end[2] - start[2]) * t),
  ];
}

function figletTextAsync(
  text: string,
  options: Parameters<typeof figlet.text>[1]
): Promise<string> {
  return new Promise((resolve, reject) => {
    figlet.text(text, options, (err, data) => {
      if (err) reject(err);
      else resolve(data ?? "");
    });
  });
}

async function renderFigletTitle(): Promise<string[]> {
  try {
    const raw = await figletTextAsync(TITLE, {
      font: "Slant",
      horizontalLayout: "default",
    });
    return trimTrailingEmptyLines(raw.split("\n"));
  } catch {
    const raw = figlet.textSync(TITLE, {
      font: "Slant",
      horizontalLayout: "default",
    });
    return trimTrailingEmptyLines(raw.split("\n"));
  }
}

function buildSymbolColumn(rows: number): string[] {
  const sym = [...SYMBOL_LINES];
  while (sym.length < rows) {
    sym.push(" ".repeat(SYMBOL_WIDTH));
  }
  return sym.slice(0, rows);
}

async function buildBannerString(): Promise<string> {
  const figLinesPlain = await renderFigletTitle();
  const rows = Math.max(figLinesPlain.length, SYMBOL_LINES.length);
  const symCol = buildSymbolColumn(rows);

  const leftMax = Math.max(
    4,
    INNER_MAX - GAP.length - SYMBOL_WIDTH
  );

  const titleRows: string[] = [];
  for (let i = 0; i < rows; i++) {
    const plainLeft = clampPlain(figLinesPlain[i] ?? "", leftMax);
    const leftColored = gradientText(plainLeft, GRADIENT_START, GRADIENT_END);
    const [r, g, b] = rowRgb(i, rows, GRADIENT_START, GRADIENT_END);
    const right = chalk.rgb(r, g, b)(symCol[i] ?? "");
    titleRows.push(leftColored + GAP + right);
  }

  const subtitlePlain =
    SUBTITLE.length > INNER_MAX ? SUBTITLE.slice(0, INNER_MAX) : SUBTITLE;
  const subtitleLine = chalk.dim(subtitlePlain);

  const bodyLines = [...titleRows, subtitleLine];

  const innerWidth = Math.min(
    INNER_MAX,
    Math.max(1, ...bodyLines.map((l) => stripAnsi(l).length))
  );

  const paddedBody = bodyLines.map((line) => {
    const len = stripAnsi(line).length;
    const pad = innerWidth - len;
    return pad > 0 ? line + " ".repeat(pad) : line;
  });

  /** `| ` + inner + ` |` width = innerWidth + 4 */
  const top = "+" + "-".repeat(innerWidth + 2) + "+";
  const bottom = top;
  const boxed = paddedBody.map((line) => "| " + line + " |");

  return [top, ...boxed, bottom].join("\n");
}

/**
 * Print a bordered “hacker terminal” banner (figlet **Slant** + cyan→magenta gradient + ASCII symbol).
 * Other dramatic fonts (often wider): `Ghost`, `Big`, `Standard` — Slant fits ~100 cols best.
 */
export async function showBanner(): Promise<void> {
  const text = await buildBannerString();
  console.log(text);
  console.log();
}
