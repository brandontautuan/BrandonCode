import { afterEach, describe, expect, it, vi } from "vitest";
import { showBanner } from "./banner.js";

describe("banner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prints a boxed multiline banner within 100 columns", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await showBanner();

    const output = String(log.mock.calls[0]?.[0] ?? "");
    const lines = output.split("\n").filter((l) => l.length > 0);
    const maxW = Math.max(...lines.map((l) => l.length));

    expect(lines.length).toBeGreaterThan(3);
    expect(lines[0]).toMatch(/^\+-+\+$/);
    expect(lines[lines.length - 1]).toMatch(/^\+-+\+$/);
    expect(maxW).toBeLessThanOrEqual(100);

    const joined = lines.join("\n");
    expect(joined).toMatch(/AI CLI/i);
    expect(joined).toMatch(/\| .* \|/);
  });

  it("uses theme preset subtitle when themeId is set", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await showBanner({ themeId: "ocean" });

    const output = String(log.mock.calls[0]?.[0] ?? "");
    expect(output).toMatch(/calm/i);
  });
});
