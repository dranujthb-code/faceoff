import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { themes } from "@faceoff/shared";

/** Keeps the CSS variables in globals.css in sync with the shared design tokens used by mobile. */
describe("design tokens", () => {
  const css = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");
  const root = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
  const map: Record<string, keyof typeof themes.light> = {
    "--fo-bg": "bg", "--fo-surface": "surface", "--fo-text": "text", "--fo-text-muted": "textMuted", "--fo-primary": "primary",
    "--fo-accent": "accent", "--fo-for": "sideFor", "--fo-against": "sideAgainst", "--fo-border": "border", "--fo-link": "link",
  };
  for (const [v, key] of Object.entries(map)) {
    it(`${v} matches tokens.light.${key}`, () => {
      const m = new RegExp(`${v}:\\s*(#[0-9A-Fa-f]{6})`).exec(root);
      expect(m?.[1]?.toUpperCase()).toBe(themes.light[key].toUpperCase());
    });
  }
});

/** WCAG 2.1 contrast checks for the key text/background pairs in both themes. */
function lum(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };

describe("contrast (WCAG AA)", () => {
  for (const name of ["light", "dark"] as const) {
    const t = themes[name];
    it(`${name}: body text on background ≥ 4.5`, () => expect(ratio(t.text, t.bg)).toBeGreaterThanOrEqual(4.5));
    it(`${name}: muted text on surface ≥ 4.5`, () => expect(ratio(t.textMuted, t.surface)).toBeGreaterThanOrEqual(4.5));
    it(`${name}: primary button text ≥ 4.5`, () => expect(ratio(t.primaryText, t.primary)).toBeGreaterThanOrEqual(4.5));
    it(`${name}: links on background ≥ 4.5`, () => expect(ratio(t.link, t.bg)).toBeGreaterThanOrEqual(4.5));
    it(`${name}: side colors on soft fills ≥ 3 (large/bold labels)`, () => {
      expect(ratio(t.sideFor, t.sideForSoft)).toBeGreaterThanOrEqual(3);
      expect(ratio(t.sideAgainst, t.sideAgainstSoft)).toBeGreaterThanOrEqual(3);
    });
  }
});
