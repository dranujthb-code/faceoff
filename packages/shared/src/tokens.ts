/**
 * FaceOff design tokens — single source of truth for web (CSS variables) and mobile (RN StyleSheet).
 *
 * Derived from the FaceOff logo and UI mockups:
 *  - "For" bubble: steel blue (#6498AD sampled from the logo), deepened for text/controls.
 *  - "Against" bubble: energetic red (#E5504A sampled from the logo).
 *  - Ink: near-black blue (#0B1419) used for the serif wordmark and the central divider.
 *  - Paper: warm cream backgrounds (#F3ECDF tile, #FBF7EF page).
 *  - Dark mode: charcoal (#161B20) used in the live-debate and login mockups.
 */

export const palette = {
  blue50: "#EEF4F7",
  blue100: "#D6E5EC",
  blue300: "#8DB5C6",
  blue400: "#6498AD", // logo bubble
  blue600: "#3B7189", // controls on cream (AA with white text)
  blue700: "#2C5A6F", // text links on cream
  blue900: "#14303D",

  red50: "#FCEDEC",
  red100: "#F8D3D1",
  red400: "#E5504A", // logo bubble
  red600: "#C93B35", // primary action (AA with white text)
  red700: "#A82F2A",

  ink: "#0B1419",
  ink80: "#2A333A",
  ink60: "#525C63",
  ink40: "#868E93",
  ink20: "#C9C6BE",

  cream: "#F3ECDF",
  paper: "#FBF7EF",
  sand: "#E6DCC8",
  white: "#FFFFFF",

  char900: "#111519",
  char800: "#161B20",
  char700: "#1F252B",
  char600: "#2A3138",
  char500: "#3A424A",

  live: "#C93B35", // white "Live" labels need AA contrast
  success: "#2F7D5B",
  warning: "#B7791F",
} as const;

export type ThemeName = "light" | "dark";

export interface ThemeTokens {
  bg: string;
  surface: string;
  surfaceRaised: string;
  surfaceSunken: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  primary: string; // challenge / go-live action — red
  primaryText: string;
  primaryHover: string;
  accent: string; // brand blue
  accentText: string;
  accentHover: string;
  link: string;
  sideFor: string;
  sideForSoft: string;
  sideAgainst: string;
  sideAgainstSoft: string;
  live: string;
  success: string;
  warning: string;
  danger: string;
  focus: string;
}

export const themes: Record<ThemeName, ThemeTokens> = {
  light: {
    bg: palette.paper,
    surface: palette.white,
    surfaceRaised: palette.white,
    surfaceSunken: palette.cream,
    border: "#E4DBCB",
    borderStrong: palette.ink20,
    text: palette.ink,
    textMuted: palette.ink60,
    textSubtle: "#646C71",
    primary: palette.red600,
    primaryText: palette.white,
    primaryHover: palette.red700,
    accent: palette.blue600,
    accentText: palette.white,
    accentHover: palette.blue700,
    link: palette.blue700,
    sideFor: palette.blue600,
    sideForSoft: palette.blue50,
    sideAgainst: "#B8352F", // slightly deeper than the logo red so small labels meet WCAG AA
    sideAgainstSoft: palette.red50,
    live: palette.live,
    success: palette.success,
    warning: "#8A5A12",
    danger: palette.red700,
    focus: palette.blue600,
  },
  dark: {
    bg: palette.char800,
    surface: palette.char700,
    surfaceRaised: palette.char600,
    surfaceSunken: palette.char900,
    border: palette.char600,
    borderStrong: palette.char500,
    text: "#F1EBDF",
    textMuted: "#B5B0A6",
    textSubtle: "#9A968E",
    primary: palette.red600,
    primaryText: palette.white,
    primaryHover: "#B8352F",
    accent: palette.blue400,
    accentText: palette.ink,
    accentHover: palette.blue300,
    link: palette.blue300,
    sideFor: palette.blue400,
    sideForSoft: "#1C2C35",
    sideAgainst: "#EE6A64",
    sideAgainstSoft: "#3A2120",
    live: palette.live,
    success: "#4FB286",
    warning: "#E0A84A",
    danger: "#F07A74",
    focus: palette.blue300,
  },
};

export const radii = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;
export const spacing = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } as const;

export const typography = {
  /** Wordmark & editorial headlines — matches the logo's sturdy transitional serif. */
  serif: "Source Serif 4",
  /** Interface text — matches the mockups' neutral grotesk. */
  sans: "Inter",
  scale: { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24, "3xl": 30, "4xl": 38, "5xl": 48, "6xl": 60 },
} as const;
