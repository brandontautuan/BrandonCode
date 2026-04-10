import { beforeEach, describe, expect, it, vi } from "vitest";
import { runPipeline } from "./pipeline.js";
import * as toolsMod from "./tools.js";

/** Hermetic integration tests: real `runPipeline` orchestration, mocked LLM + prompts + writes. */

function workerJson(path: string, content: string): string {
  return JSON.stringify({
    content: "",
    toolCalls: [
      {
        function: {
          name: "write_file",
          arguments: { path, content },
        },
      },
    ],
  });
}

describe("runPipeline integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("passes planner output to worker unchanged and applies once on y", async () => {
    const plan =
      "## Task\nP\n## Relevant files\n-\n## Current state\n-\n## Exact requirements\n-\n## Constraints\n-\n## Expected output\n-\n";
    const buildPlanFn = vi.fn().mockResolvedValue(plan);
    const executeplanFn = vi.fn().mockImplementation((p: string) => {
      expect(p).toBe(plan);
      return Promise.resolve(workerJson("integration-happy.txt", "payload"));
    });
    const wf = vi.spyOn(toolsMod, "writeFileTool").mockResolvedValue("ok");
    const logError = vi.fn();

    await runPipeline("add feature X", {
      enableThinking: false,
      buildPlanFn,
      executeplanFn,
      promptApproval: async () => "y",
      logError,
    });

    expect(buildPlanFn).toHaveBeenCalledWith(
      "add feature X",
      expect.objectContaining({
        enableThinking: false,
        onStage: expect.any(Function),
      })
    );
    expect(executeplanFn).toHaveBeenCalledTimes(1);
    expect(wf).toHaveBeenCalledTimes(1);
    expect(wf.mock.calls[0][0]).toMatch(/integration-happy\.txt$/);
    expect(wf.mock.calls[0][1]).toBe("payload");
    expect(wf.mock.calls[0][2]).toEqual({ skipConfirm: true });
    expect(logError).not.toHaveBeenCalled();
  });

  it("does not apply writes on n", async () => {
    const wf = vi.spyOn(toolsMod, "writeFileTool").mockResolvedValue("ok");
    const logError = vi.fn();
    await runPipeline("req", {
      enableThinking: false,
      buildPlanFn: async () => "plan",
      executeplanFn: async () => workerJson("discarded.txt", "z"),
      promptApproval: async () => "n",
      logError,
    });
    expect(wf).not.toHaveBeenCalled();
    expect(logError).not.toHaveBeenCalled();
  });

  it("after e, worker receives edited plan and y applies the last worker proposals", async () => {
    const wf = vi.spyOn(toolsMod, "writeFileTool").mockResolvedValue("ok");
    const buildPlanFn = vi.fn().mockResolvedValue("PLAN");
    const executeplanFn = vi
      .fn()
      .mockResolvedValueOnce(workerJson("first.txt", "a"))
      .mockResolvedValueOnce(workerJson("after-edit.txt", "final-body"));
    let step = 0;
    await runPipeline("req", {
      enableThinking: false,
      buildPlanFn,
      executeplanFn,
      editPlanInEditorFn: (p) => `${p}\n[edited]`,
      promptApproval: async () => {
        step += 1;
        if (step === 1) return "e";
        return "y";
      },
    });
    expect(buildPlanFn).toHaveBeenCalledTimes(1);
    expect(executeplanFn).toHaveBeenCalledTimes(2);
    expect(executeplanFn.mock.calls[0][0]).toBe("PLAN");
    expect(executeplanFn.mock.calls[1][0]).toBe("PLAN\n[edited]");
    expect(wf).toHaveBeenCalledTimes(1);
    expect(wf.mock.calls[0][0]).toMatch(/after-edit\.txt$/);
    expect(wf.mock.calls[0][1]).toBe("final-body");
  });

  it("uses activity sink when logError is not provided", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await runPipeline("x", {
      enableThinking: false,
      activityMode: "concise",
      buildPlanFn: async () => {
        throw new Error("planner: failed");
      },
    });
    const text = err.mock.calls.map((c) => String(c[0])).join("\n");
    expect(text).toMatch(/planner: failed/);
    err.mockRestore();
  });

  it("surfaces planner failure without calling worker or applying writes", async () => {
    const wf = vi.spyOn(toolsMod, "writeFileTool").mockResolvedValue("ok");
    const executeplanFn = vi.fn();
    const logError = vi.fn();

    await runPipeline("x", {
      enableThinking: false,
      buildPlanFn: async () => {
        throw new Error("planner: model unreachable");
      },
      executeplanFn,
      logError,
    });

    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining("planner: model unreachable")
    );
    expect(executeplanFn).not.toHaveBeenCalled();
    expect(wf).not.toHaveBeenCalled();
  });

  it("surfaces worker failure without applying writes", async () => {
    const wf = vi.spyOn(toolsMod, "writeFileTool").mockResolvedValue("ok");
    const logError = vi.fn();

    await runPipeline("x", {
      enableThinking: false,
      buildPlanFn: async () => "ok plan",
      executeplanFn: async () => {
        throw new Error("worker: stream failed");
      },
      promptApproval: async () => "y",
      logError,
    });

    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining("worker: stream failed")
    );
    expect(wf).not.toHaveBeenCalled();
  });

  it("does not apply if apply step throws", async () => {
    const wf = vi
      .spyOn(toolsMod, "writeFileTool")
      .mockRejectedValue(new Error("disk full"));
    const logError = vi.fn();

    await runPipeline("x", {
      enableThinking: false,
      buildPlanFn: async () => "plan",
      executeplanFn: async () => workerJson("x.txt", "c"),
      promptApproval: async () => "y",
      logError,
    });

    expect(wf).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith(expect.stringContaining("disk full"));
  });
});
