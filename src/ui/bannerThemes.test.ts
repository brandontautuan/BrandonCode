import { describe, expect, it } from "vitest";
import { BANNER_THEME_PRESETS, getBannerThemeById } from "./bannerThemes.js";

describe("bannerThemes", () => {
  it("exposes named presets with gradients", () => {
    expect(BANNER_THEME_PRESETS.default).toBeDefined();
    expect(BANNER_THEME_PRESETS.ocean).toBeDefined();
    expect(getBannerThemeById("unknown").id).toBe("default");
  });
});
