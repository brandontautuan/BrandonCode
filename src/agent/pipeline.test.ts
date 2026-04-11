import { beforeEach, describe, expect, it, vi } from "vitest";
import { runPipeline } from "./pipeline.js";
import * as toolsMod from "./tools.js";

describe("pipeline", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("applies write_file proposals when user chooses y", async () => {
    const wf = vi.spyOn(toolsMod, "writeFileTool").mockResolvedValue("Wrote");
    await runPipeline("req", {
      enableThinking: false,
      buildPlanFn: async () => "## Task\nx\n## Relevant files\n-\n## Current state\n-\n## Exact requirements\n-\n## Constraints\n-\n## Expected output\n-\n",
      executeplanFn: async () =>
        JSON.stringify({
          content: "",
          toolCalls: [
            {
              function: {
                name: "write_file",
                arguments: { path: "pipeline-test-out.txt", content: "x" },
              },
            },
          ],
        }),
      promptApproval: async () => "y",
    });
    expect(wf).toHaveBeenCalledTimes(1);
    expect(wf.mock.calls[0][0]).toMatch(/pipeline-test-out\.txt$/);
    expect(wf.mock.calls[0][1]).toBe("x");
    expect(wf.mock.calls[0][2]).toEqual({ skipConfirm: true });
  });

  it("discards when user chooses n", async () => {
    const wf = vi.spyOn(toolsMod, "writeFileTool").mockResolvedValue("Wrote");
    await runPipeline("req", {
      enableThinking: false,
      buildPlanFn: async () => "plan",
      executeplanFn: async () =>
        JSON.stringify({
          content: "done",
          toolCalls: [
            {
              function: {
                name: "write_file",
                arguments: { path: "nope.txt", content: "z" },
              },
            },
          ],
        }),
      promptApproval: async () => "n",
    });
    expect(wf).not.toHaveBeenCalled();
  });

  it("re-runs worker only after e (not planner)", async () => {
    const wf = vi.spyOn(toolsMod, "writeFileTool").mockResolvedValue("Wrote");
    const buildPlanFn = vi.fn().mockResolvedValue("PLAN-A");
    const executeplanFn = vi.fn().mockResolvedValue(
      JSON.stringify({ content: "", toolCalls: [] })
    );
    let step = 0;
    await runPipeline("req", {
      enableThinking: false,
      buildPlanFn,
      executeplanFn,
      editPlanInEditorFn: (p) => `${p}\n(edited)`,
      promptApproval: async () => {
        step += 1;
        if (step === 1) return "e";
        return "n";
      },
    });
    expect(buildPlanFn).toHaveBeenCalledTimes(1);
    expect(executeplanFn).toHaveBeenCalledTimes(2);
  });

  it("skips worker for report-style requests", async () => {
    const executeplanFn = vi.fn().mockResolvedValue(
      JSON.stringify({ content: "done", toolCalls: [] })
    );
    await runPipeline(
      "review the codebase and give me a couple sentence report",
      {
        enableThinking: false,
        buildPlanFn: async () => "report text",
        executeplanFn,
      }
    );
    expect(executeplanFn).not.toHaveBeenCalled();
  });

  it("skips worker entirely in planner-only testing mode", async () => {
    const executeplanFn = vi.fn().mockResolvedValue(
      JSON.stringify({ content: "done", toolCalls: [] })
    );
    await runPipeline("implement feature x", {
      enableThinking: false,
      plannerOnly: true,
      buildPlanFn: async () => "## Task\nplan-only",
      executeplanFn,
    });
    expect(executeplanFn).not.toHaveBeenCalled();
  });
});
