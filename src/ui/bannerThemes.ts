export type BannerTheme = {
  id: string;
  /** Short label for CLI / docs. */
  label: string;
  gradientStart: [number, number, number];
  gradientEnd: [number, number, number];
  subtitle: string;
};

export const BANNER_THEME_PRESETS: Record<string, BannerTheme> = {
  default: {
    id: "default",
    label: "Cyan → magenta (original)",
    gradientStart: [0, 220, 255],
    gradientEnd: [255, 40, 220],
    subtitle: "  AI CLI · gemini · ollama · minimax",
  },
  ocean: {
    id: "ocean",
    label: "Teal → deep blue",
    gradientStart: [0, 180, 200],
    gradientEnd: [40, 90, 200],
    subtitle: "  AI CLI · calm · focused · local-first",
  },
  ember: {
    id: "ember",
    label: "Amber → crimson",
    gradientStart: [255, 160, 60],
    gradientEnd: [200, 40, 90],
    subtitle: "  AI CLI · fast iteration · sharp tools",
  },
  mono: {
    id: "mono",
    label: "Slate gradient",
    gradientStart: [200, 200, 210],
    gradientEnd: [90, 90, 100],
    subtitle: "  AI CLI · minimal · readable",
  },
};

export function getBannerThemeById(id: string): BannerTheme {
  const t = BANNER_THEME_PRESETS[id];
  return t ?? BANNER_THEME_PRESETS.default;
}
