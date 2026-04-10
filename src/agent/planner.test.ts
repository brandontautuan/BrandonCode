import { beforeEach, describe, expect, it, vi } from "vitest";

const { chatMock, thinkMock } = vi.hoisted(() => ({
  chatMock: vi.fn(),
  thinkMock: vi.fn(),
}));

vi.mock("ollama", () => ({
  Ollama: class {
    chat = chatMock;
  },
}));

import { PLAN_SECTION_HEADINGS, buildPlan } from "./planner.js";

vi.mock("../config/ollamaSettings.js", () => ({
  getOllamaThinkForRequest: thinkMock,
  getPipelineModels: () => ({
    host: "http://127.0.0.1:11434",
    plannerModel: "planner-model",
    workerModel: "worker-model",
  }),
}));

describe("planner", () => {
  beforeEach(() => {
    chatMock.mockReset();
    thinkMock.mockReset();
    thinkMock.mockReturnValue(undefined);
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

  it("retries without think when model does not support thinking", async () => {
    thinkMock.mockReturnValue(true);
    chatMock
      .mockRejectedValueOnce(new Error('"planner-model" does not support thinking'))
      .mockResolvedValueOnce({
        message: { content: "## Task\nok" },
      });

    const out = await buildPlan("plan this", { enableThinking: true });

    expect(out).toContain("## Task");
    expect(chatMock).toHaveBeenCalledTimes(2);
    const firstCall = chatMock.mock.calls[0][0] as Record<string, unknown>;
    const secondCall = chatMock.mock.calls[1][0] as Record<string, unknown>;
    expect(firstCall.think).toBe(true);
    expect(secondCall.think).toBeUndefined();
  });
});
