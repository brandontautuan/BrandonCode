/**
 * Starter `context/agent.md` for any repo. Brandon-specific details belong in edits;
 * this block stays project-agnostic.
 */
export function buildDefaultAgentContextMarkdown(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `# Project context

Short notes for the AI agent working in **this** repository. Replace or extend the sections below.

## What NOT to do

- Don't delete or replace the project's long-form planning or product spec docs with this file — keep specs and agent context separate.
- Don't commit API keys, tokens, or \`.env\` secrets.
- Don't silently truncate this file; archive, compress, or summarize explicitly if it grows too large.

## Stack (fill in)

- Runtime / language:
- Key commands (install, test, lint):

## Current focus (optional)

- 

**Bootstrap created:** ${date} — edit freely.
`;
}
