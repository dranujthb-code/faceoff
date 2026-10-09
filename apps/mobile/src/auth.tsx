import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Me } from "@faceoff/shared";
import { api, setToken, getToken } from "./api";

interface AuthState {
  me: Me | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, dateOfBirth: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!(await getToken())) {
      setMe(null);
      return;
    }
    try {
      setMe(await api<Me | null>("/me"));
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const token = await getToken();
        const m = token ? await api<Me | null>("/me") : null;
        if (live) setMe(m);
      } catch {
        if (live) setMe(null);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const r = await api<{ token: string }>("/auth/signin", { body: { email, password } });
    await setToken(r.token);
    await refresh();
  }, [refresh]);

  const signUp = useCallback(async (email: string, password: string, dateOfBirth: string) => {
    const r = await api<{ token: string }>("/auth/signup", { body: { email, password, dateOfBirth, acceptTerms: true } });
    await setToken(r.token);
    await refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await api("/auth/signout", { body: {} }).catch(() => {});
    await setToken(null);
    setMe(null);
  }, []);

  const value = useMemo(() => ({ me, loading, signIn, signUp, signOut, refresh }), [me, loading, signIn, signUp, signOut, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
