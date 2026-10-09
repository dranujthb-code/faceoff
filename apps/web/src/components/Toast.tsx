"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { clsx } from "clsx";

type Tone = "neutral" | "success" | "error";
interface ToastItem { id: number; message: string; tone: Tone }
const Ctx = createContext<(message: string, tone?: Tone) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((message: string, tone: Tone = "neutral") => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-2), { id, message, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={clsx(
              "pointer-events-auto max-w-md rounded-full px-5 py-2.5 text-sm font-medium shadow-lg",
              t.tone === "error" ? "bg-danger text-white" : t.tone === "success" ? "bg-ink text-bg" : "bg-ink text-bg",
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
