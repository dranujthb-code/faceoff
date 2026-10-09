import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";

/** Loads an API resource; `reload` refetches (used by pull-to-refresh and after mutations). */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!path) return;
    let live = true;
    api<T>(path).then(
      (d) => { if (live) { setData(d); setError(null); setRefreshing(false); } },
      (e) => { if (live) { setError(e instanceof ApiError ? e.message : "Something went wrong"); setRefreshing(false); } },
    );
    return () => { live = false; };
  }, [path, version]);
  const reload = useCallback(() => { setRefreshing(true); setVersion((v) => v + 1); }, []);
  return { data, error, refreshing, reload, setData };
}
