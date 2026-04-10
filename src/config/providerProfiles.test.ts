import { describe, expect, it } from "vitest";
import {
  parseProviderProfilesJson,
  validateProviderProfile,
} from "./providerProfiles.js";

describe("providerProfiles", () => {
  it("parses valid profiles file", () => {
    const r = parseProviderProfilesJson(
      JSON.stringify({
        profiles: {
          fast: { temperature: 0.2, maxTokens: 4096, tools: ["read_file"] },
        },
      })
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.profiles.fast?.temperature).toBe(0.2);
      expect(r.data.profiles.fast?.maxTokens).toBe(4096);
      expect(r.data.profiles.fast?.tools).toEqual(["read_file"]);
    }
  });

  it("rejects invalid temperature", () => {
    const r = parseProviderProfilesJson(
      JSON.stringify({
        profiles: { bad: { temperature: 3 } },
      })
    );
    expect(r.ok).toBe(false);
  });

  it("validateProviderProfile accepts partial", () => {
    const r = validateProviderProfile({ maxTokens: 1000 }, "p");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.profile.maxTokens).toBe(1000);
  });
});
