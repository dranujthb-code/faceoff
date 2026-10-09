"use client";
import { useSyncExternalStore } from "react";

export type ThemePref = "system" | "light" | "dark";
const listeners = new Set<() => void>();

function read(): ThemePref {
  try {
    const t = localStorage.getItem("fo-theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

/** Theme preference is a per-device convenience kept in localStorage (applied pre-paint by ThemeScript). */
export function useTheme(): ThemePref {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    read,
    () => "system",
  );
}

export function setTheme(t: ThemePref) {
  try {
    if (t === "system") localStorage.removeItem("fo-theme");
    else localStorage.setItem("fo-theme", t);
  } catch {
    // storage unavailable (private mode): still apply for this page view
  }
  const root = document.documentElement;
  if (t === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
  listeners.forEach((l) => l());
}
