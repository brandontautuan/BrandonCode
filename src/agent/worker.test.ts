import fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { streamMock, thinkMock } = vi.hoisted(() => ({
  streamMock: vi.fn(),
  thinkMock: vi.fn(),
}));

vi.mock("./streamChat.js", () => ({
  streamChatCompletion: streamMock,
}));

vi.mock("../config/ollamaSettings.js", () => ({
  getOllamaThinkForRequest: thinkMock,
  getPipelineModels: () => ({
    host: "http://127.0.0.1:11434",
    plannerModel: "planner-model",
    workerModel: "worker-model",
  }),
}));

import { executeplan } from "./worker.js";

describe("worker", () => {
  beforeEach(() => {
    streamMock.mockReset();
    thinkMock.mockReset();
    thinkMock.mockReturnValue(undefined);
  });

  it("does not reference loadContext (no hidden context load)", () => {
    const url = new URL("./worker.ts", import.meta.url);
    const src = fs.readFileSync(url, "utf8");
    expect(src).not.toMatch(/\bloadContext\b/);
  });

  it("retries without think when model does not support thinking", async () => {
    thinkMock.mockReturnValue(true);
    streamMock
      .mockRejectedValueOnce(new Error('"worker-model" does not support thinking'))
      .mockResolvedValueOnce({ content: "done", tool_calls: [] });

    const out = await executeplan("plan", { enableThinking: true });

    expect(JSON.parse(out)).toMatchObject({ content: "done", toolCalls: [] });
    expect(streamMock).toHaveBeenCalledTimes(2);
    const firstOpts = streamMock.mock.calls[0][3] as Record<string, unknown>;
    const secondOpts = streamMock.mock.calls[1][3] as Record<string, unknown>;
    expect(firstOpts.think).toBe(true);
    expect(secondOpts.think).toBeUndefined();
  });
});
