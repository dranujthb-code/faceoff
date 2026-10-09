import { forwardRef, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type RefreshControlProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ProfileSummary, Side } from "@faceoff/shared";
import { absoluteUrl } from "../api";
import { fonts, radii, useTheme } from "../theme";

type TVariant = "display" | "title" | "heading" | "proposition" | "body" | "muted" | "small" | "label";

export function T({ children, variant = "body", style, color, numberOfLines }: { children: ReactNode; variant?: TVariant; style?: StyleProp<TextStyle>; color?: string; numberOfLines?: number }) {
  const t = useTheme();
  const v: Record<TVariant, TextStyle> = {
    display: { fontFamily: fonts.serifBold, fontSize: 36, lineHeight: 40, color: t.text, letterSpacing: -0.5 },
    title: { fontFamily: fonts.serifBold, fontSize: 28, lineHeight: 33, color: t.text },
    heading: { fontFamily: fonts.serif, fontSize: 20, lineHeight: 25, color: t.text },
    proposition: { fontFamily: fonts.serif, fontSize: 21, lineHeight: 26, color: t.text },
    body: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 23, color: t.text },
    muted: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 21, color: t.textMuted },
    small: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18, color: t.textMuted },
    label: { fontFamily: fonts.sansSemi, fontSize: 14, lineHeight: 19, color: t.text },
  };
  return (
    <Text style={[v[variant], color ? { color } : null, style]} numberOfLines={numberOfLines} maxFontSizeMultiplier={1.6}>
      {children}
    </Text>
  );
}

export function Screen({ children, scroll = true, refresh, padded = true, style }: { children: ReactNode; scroll?: boolean; refresh?: React.ReactElement<RefreshControlProps>; padded?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const inner = padded ? { padding: 16, gap: 16 } : null;
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[{ flex: 1, backgroundColor: t.bg }, style]}>
      {scroll ? (
        <ScrollView contentContainerStyle={[inner, { paddingBottom: 48 }]} refreshControl={refresh} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

type BVariant = "primary" | "accent" | "secondary" | "ghost" | "danger";
export function Button({ title, onPress, variant = "primary", loading, disabled, small, accessibilityLabel, icon, style }: {
  title: string;
  onPress?: PressableProps["onPress"];
  variant?: BVariant;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  accessibilityLabel?: string;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const bg: Record<BVariant, string> = { primary: t.primary, accent: t.accent, secondary: t.surface, ghost: "transparent", danger: t.surface };
  const fg: Record<BVariant, string> = { primary: t.primaryText, accent: t.accentText, secondary: t.text, ghost: t.text, danger: t.danger };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: small ? 36 : 48,
          paddingHorizontal: small ? 14 : 22,
          borderRadius: radii.pill,
          backgroundColor: bg[variant],
          borderWidth: variant === "secondary" || variant === "danger" ? 1 : 0,
          borderColor: variant === "danger" ? t.danger : t.borderStrong,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg[variant]} /> : icon}
      <Text style={{ color: fg[variant], fontFamily: fonts.sansSemi, fontSize: small ? 14 : 16 }}>{title}</Text>
    </Pressable>
  );
}

export const Field = forwardRef<TextInput, TextInputProps & { label: string; error?: string; hint?: string }>(function Field({ label, error, hint, style, ...rest }, ref) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T variant="label">{label}</T>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={t.textSubtle}
        style={[
          { borderWidth: 1, borderColor: error ? t.danger : t.borderStrong, backgroundColor: t.surface, color: t.text, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontFamily: fonts.sans },
          style,
        ]}
        {...rest}
      />
      {error ? <T variant="small" color={t.danger}>{error}</T> : hint ? <T variant="small">{hint}</T> : null}
    </View>
  );
});

export function ErrorBox({ message }: { message: string | null | undefined }) {
  const t = useTheme();
  if (!message) return null;
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: t.sideAgainstSoft, borderRadius: radii.md, padding: 12 }}>
      <T color={t.danger}>{message}</T>
    </View>
  );
}

export function Card({ children, style, onPress, accessibilityLabel }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string }) {
  const t = useTheme();
  const s = [{ backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderRadius: radii.lg, padding: 16, gap: 10 }, style];
  if (onPress)
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [...s, { opacity: pressed ? 0.85 : 1 }]}>
        {children}
      </Pressable>
    );
  return <View style={s}>{children}</View>;
}

export function Badge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "for" | "against" | "live" | "demo" | "success" }) {
  const t = useTheme();
  const map = {
    neutral: [t.surfaceSunken, t.textMuted],
    for: [t.sideForSoft, t.sideFor],
    against: [t.sideAgainstSoft, t.sideAgainst],
    live: [t.live, "#FFFFFF"],
    demo: ["transparent", t.textMuted],
    success: [t.surfaceSunken, t.success],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: radii.pill, paddingHorizontal: 9, paddingVertical: 2, borderWidth: tone === "demo" ? 1 : 0, borderStyle: "dashed", borderColor: t.borderStrong, alignSelf: "flex-start" }}>
      <Text style={{ color: fg, fontFamily: fonts.sansSemi, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

/** The logo's central divider: ink line with a dot on top. */
export function InkDivider({ height = 40 }: { height?: number }) {
  const t = useTheme();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ alignItems: "center", width: 10, height }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.text }} />
      <View style={{ width: 2, flex: 1, backgroundColor: t.text, borderRadius: 1, marginTop: 2 }} />
    </View>
  );
}

const SIZES = { xs: 24, sm: 32, md: 44, lg: 64, xl: 96 };
export function Avatar({ profile, size = "md", side }: { profile: Pick<ProfileSummary, "displayName" | "avatarUrl">; size?: keyof typeof SIZES; side?: Side | null }) {
  const t = useTheme();
  const px = SIZES[size];
  const ring = side === "for" ? t.sideFor : side === "against" ? t.sideAgainst : "transparent";
  const url = absoluteUrl(profile.avatarUrl);
  const initials = profile.displayName.split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase() ?? "").join("") || "?";
  return (
    <View style={{ width: px + 6, height: px + 6, borderRadius: (px + 6) / 2, borderWidth: side ? 2 : 0, borderColor: ring, alignItems: "center", justifyContent: "center" }} accessibilityElementsHidden>
      {url ? (
        <Image source={{ uri: url }} style={{ width: px, height: px, borderRadius: px / 2 }} />
      ) : (
        <View style={{ width: px, height: px, borderRadius: px / 2, backgroundColor: side === "against" ? t.sideAgainstSoft : side === "for" ? t.sideForSoft : t.surfaceSunken, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: fonts.sansSemi, fontSize: px * 0.36, color: side === "against" ? t.sideAgainst : side === "for" ? t.sideFor : t.textMuted }}>{initials}</Text>
        </View>
      )}
    </View>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ borderWidth: 1, borderStyle: "dashed", borderColor: t.borderStrong, borderRadius: radii.lg, padding: 24, alignItems: "center", gap: 8 }}>
      <T variant="heading" style={{ textAlign: "center" }}>{title}</T>
      {body ? <T variant="muted" style={{ textAlign: "center" }}>{body}</T> : null}
      {action}
    </View>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  const t = useTheme();
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={{ padding: 32, alignItems: "center" }}>
      <ActivityIndicator color={t.accent} />
    </View>
  );
}

export const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
});
