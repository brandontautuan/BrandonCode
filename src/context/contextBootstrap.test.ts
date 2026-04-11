import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildDefaultAgentContextMarkdown } from "./defaultAgentContextTemplate.js";
import { gatherRepoFacts, isContextEmpty } from "./contextBootstrap.js";

describe("isContextEmpty", () => {
  it("returns true for empty string", () => {
    expect(isContextEmpty("")).toBe(true);
  });

  it("returns true for whitespace-only", () => {
    expect(isContextEmpty("  \n\n   \t\n")).toBe(true);
  });

  it("returns true for the unedited bootstrap template", () => {
    expect(isContextEmpty(buildDefaultAgentContextMarkdown())).toBe(true);
  });

  it("returns false once the user fills in Runtime / language", () => {
    const filled = buildDefaultAgentContextMarkdown().replace(
      "- Runtime / language:",
      "- Runtime / language: Node 20 + TypeScript"
    );
    expect(isContextEmpty(filled)).toBe(false);
  });

  it("returns false for a fully custom agent.md", () => {
    const custom = `# Project context\n\n## Purpose\n- A real app.\n\n## Stack\n- Bun + React\n`;
    expect(isContextEmpty(custom)).toBe(false);
  });
});

describe("gatherRepoFacts", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bc-bootstrap-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("handles an empty directory without throwing", () => {
    const facts = gatherRepoFacts(tmp);
    expect(facts.root).toBe(tmp);
    expect(facts.tree).toBe("");
    expect(facts.packageJson).toBe("");
    expect(facts.readme).toBe("");
    expect(facts.samples).toEqual([]);
  });

  it("captures package.json, README, tree, and source samples", () => {
    fs.writeFileSync(
      path.join(tmp, "package.json"),
      JSON.stringify(
        {
          name: "fixture",
          description: "test fixture",
          scripts: { test: "vitest run" },
          dependencies: { chalk: "^5" },
          devDependencies: { vitest: "^4" },
        },
        null,
        2
      )
    );
    fs.writeFileSync(
      path.join(tmp, "README.md"),
      "# Fixture\n\nA test project.\n"
    );
    fs.mkdirSync(path.join(tmp, "src"));
    fs.writeFileSync(
      path.join(tmp, "src", "index.ts"),
      "export const answer = 42;\n"
    );
    fs.mkdirSync(path.join(tmp, "node_modules", "ignored"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(tmp, "node_modules", "ignored", "index.js"),
      "// should be skipped\n"
    );

    const facts = gatherRepoFacts(tmp);

    expect(facts.tree).toContain("src/");
    expect(facts.tree).toContain("package.json");
    expect(facts.tree).not.toContain("node_modules");
    expect(facts.packageJson).toContain('"name": "fixture"');
    expect(facts.packageJson).toContain('"chalk"');
    expect(facts.readme).toContain("# Fixture");
    expect(facts.samples.length).toBeGreaterThan(0);
    const indexSample = facts.samples.find((s) =>
      s.path.endsWith("index.ts")
    );
    expect(indexSample?.snippet).toContain("answer = 42");
  });
});
