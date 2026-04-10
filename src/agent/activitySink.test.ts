import { describe, expect, it, vi } from "vitest";
import { createActivitySink, redactForLogs } from "./activitySink.js";

describe("activitySink", () => {
  it("redacts api-ish tokens", () => {
    expect(redactForLogs('key=sk-abcdefghijklmnopqrstuvwxyz')).toContain(
      "[REDACTED]"
    );
    expect(redactForLogs("Bearer secret-token-here")).toContain(
      "Bearer [REDACTED]"
    );
  });

  it("concise stage prints one dim line", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const sink = createActivitySink("concise");
    sink.stage("Testing…", "detail should not appear in concise");
    expect(log).toHaveBeenCalled();
    expect(String(log.mock.calls[0]?.[0])).toContain("Testing");
    expect(log.mock.calls.length).toBe(1);
    log.mockRestore();
  });

  it("verbose stage prints detail lines", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const sink = createActivitySink("verbose");
    sink.stage("Step", "line-a\nline-b");
    expect(log.mock.calls.length).toBeGreaterThan(2);
    log.mockRestore();
  });

  it("concise reportError prints hint without stack", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const sink = createActivitySink("concise");
    sink.reportError(new Error("boom"));
    const joined = err.mock.calls.map((c) => String(c[0])).join("\n");
    expect(joined).toMatch(/boom/);
    expect(joined).toMatch(/activity-diagnostics|verbose/i);
    const stacks = joined.split("\n").filter((l) => l.includes("at "));
    expect(stacks.length).toBe(0);
    err.mockRestore();
  });

  it("verbose reportError includes stack text", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const sink = createActivitySink("verbose");
    const e = new Error("fail");
    sink.reportError(e);
    const joined = err.mock.calls.map((c) => String(c[0])).join("\n");
    expect(joined).toMatch(/fail/);
    err.mockRestore();
  });
});
