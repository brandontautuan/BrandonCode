/**
 * Optional provider profile metadata (temperature, caps, tool lists).
 * Lives in `~/.brandon-code/provider-profiles.json` when used — parsed by callers; not merged into Conf yet.
 */
export type ProviderProfile = {
  temperature?: number;
  maxTokens?: number;
  /** Declarative tool names this profile is meant for (metadata only). */
  tools?: string[];
};

export type ProviderProfilesFile = {
  profiles: Record<string, ProviderProfile>;
};

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function validateProviderProfile(
  p: unknown,
  path: string
): { ok: true; profile: ProviderProfile } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!p || typeof p !== "object" || Array.isArray(p)) {
    errors.push(`${path}: must be an object`);
    return { ok: false, errors };
  }
  const o = p as Record<string, unknown>;
  const out: ProviderProfile = {};

  if (o.temperature !== undefined) {
    if (!isFiniteNumber(o.temperature) || o.temperature < 0 || o.temperature > 2) {
      errors.push(`${path}.temperature: must be a number between 0 and 2`);
    } else {
      out.temperature = o.temperature;
    }
  }

  if (o.maxTokens !== undefined) {
    if (!isFiniteNumber(o.maxTokens) || o.maxTokens < 1 || o.maxTokens > 1_000_000) {
      errors.push(`${path}.maxTokens: must be a positive number ≤ 1000000`);
    } else {
      out.maxTokens = Math.floor(o.maxTokens);
    }
  }

  if (o.tools !== undefined) {
    if (!Array.isArray(o.tools) || !o.tools.every((t) => typeof t === "string")) {
      errors.push(`${path}.tools: must be an array of strings`);
    } else {
      out.tools = o.tools.map((t) => t.trim()).filter(Boolean);
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, profile: out };
}

export function parseProviderProfilesJson(
  raw: string
):
  | { ok: true; data: ProviderProfilesFile }
  | { ok: false; errors: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (e) {
    return {
      ok: false,
      errors: [`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`],
    };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, errors: ["Root must be an object"] };
  }
  const root = parsed as Record<string, unknown>;
  const profs = root.profiles;
  if (!profs || typeof profs !== "object" || Array.isArray(profs)) {
    return { ok: false, errors: ["Missing or invalid `profiles` object"] };
  }

  const out: Record<string, ProviderProfile> = {};
  const errors: string[] = [];
  for (const [name, val] of Object.entries(profs)) {
    const v = validateProviderProfile(val, `profiles.${name}`);
    if (!v.ok) {
      errors.push(...v.errors);
    } else {
      out[name] = v.profile;
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, data: { profiles: out } };
}
