import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("resolveBannerThemeName", () => {
  let tmpDir: string;
  let prevEnv: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bc-banner-"));
    process.env.BRANDON_CODE_CONFIG_DIR = tmpDir;
    prevEnv = process.env.BRANDON_BANNER_THEME;
    delete process.env.BRANDON_BANNER_THEME;
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.BRANDON_CODE_CONFIG_DIR;
    if (prevEnv === undefined) delete process.env.BRANDON_BANNER_THEME;
    else process.env.BRANDON_BANNER_THEME = prevEnv;
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("reads preset from banner-theme.json", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "banner-theme.json"),
      JSON.stringify({ preset: "ember" }),
      "utf8"
    );
    const { resolveBannerThemeName } = await import("./bannerThemeConfig.js");
    expect(resolveBannerThemeName()).toBe("ember");
  });

  it("prefers BRANDON_BANNER_THEME over file", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "banner-theme.json"),
      JSON.stringify({ preset: "ember" }),
      "utf8"
    );
    process.env.BRANDON_BANNER_THEME = "ocean";
    const { resolveBannerThemeName } = await import("./bannerThemeConfig.js");
    expect(resolveBannerThemeName()).toBe("ocean");
  });
});
