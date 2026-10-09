"use client";
import { useCallback, useEffect, useState } from "react";
import { api, ClientApiError } from "@/lib/client/api";

export function useAdminData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    api<T>(path).then(
      (d) => { if (live) { setData(d); setError(null); } },
      (e) => { if (live) setError(e instanceof ClientApiError ? e.message : "Failed to load"); },
    );
    return () => { live = false; };
  }, [path, version]);
  const load = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, reload: load };
}
