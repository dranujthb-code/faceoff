import { useColorScheme } from "react-native";
import { themes, radii, spacing, palette, type ThemeTokens } from "@faceoff/shared";

export const fonts = {
  serif: "SourceSerif4_600SemiBold",
  serifBold: "SourceSerif4_700Bold",
  sans: "Inter_400Regular",
  sansMedium: "Inter_500Medium",
  sansSemi: "Inter_600SemiBold",
  sansBold: "Inter_700Bold",
};

/** The same design tokens as the web app (packages/shared/src/tokens.ts). */
export function useTheme(): ThemeTokens & { dark: boolean } {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  return { ...themes[dark ? "dark" : "light"], dark };
}

/** The debate stage is always charcoal, like the mockups. */
export const stageTheme: ThemeTokens & { dark: boolean } = { ...themes.dark, dark: true };

export { radii, spacing, palette };
