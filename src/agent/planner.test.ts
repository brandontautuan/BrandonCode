import { beforeEach, describe, expect, it, vi } from "vitest";

const { chatMock } = vi.hoisted(() => ({ chatMock: vi.fn() }));

vi.mock("ollama", () => ({
  Ollama: class {
    chat = chatMock;
  },
}));

import { PLAN_SECTION_HEADINGS, buildPlan } from "./planner.js";

vi.mock("../config/ollamaSettings.js", () => ({
  getOllamaThinkForRequest: () => undefined,
  getPipelineModels: () => ({
    host: "http://127.0.0.1:11434",
    plannerModel: "planner-model",
    workerModel: "worker-model",
  }),
}));

describe("planner", () => {
  beforeEach(() => {
    chatMock.mockReset();
    chatMock.mockResolvedValue({
      message: {
        content: [
          "## Task",
          "Do the thing",
          "## Relevant files",
          "- a",
          "## Current state",
          "ok",
          "## Exact requirements",
          "r1",
          "## Constraints",
          "c1",
          "## Expected output",
          "o1",
        ].join("\n"),
      },
    });
  });

  it("returns markdown that includes all required section headings", async () => {
    const out = await buildPlan("touch src/foo.ts", { enableThinking: false });
    for (const h of PLAN_SECTION_HEADINGS) {
      expect(out).toContain(h);
    }
    expect(chatMock).toHaveBeenCalled();
  });
});
