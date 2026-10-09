"use client";
import { useSyncExternalStore } from "react";

/**
 * A shared wall clock for rendering timers and relative times without calling Date.now()
 * during render. Returns null on the server and during hydration, so server HTML never
 * depends on the client's clock.
 */
const listeners = new Set<() => void>();
let current = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    timer = setInterval(() => {
      current = Date.now();
      listeners.forEach((l) => l());
    }, 250);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function useNow(granularityMs = 1000): number | null {
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(current / granularityMs) * granularityMs,
    () => null,
  );
}

const noop = () => () => {};
/** true after hydration on the client. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
