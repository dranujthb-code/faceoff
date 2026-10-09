"use client";
import { useCallback, useState } from "react";
import { ClientApiError } from "./api";

/** Tracks a submission's busy state, top-level error and per-field errors from the API. */
export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError(null);
    setFields({});
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ClientApiError) {
        setError(e.message);
        if (e.fields) setFields(e.fields);
      } else setError("Something went wrong. Please try again.");
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, fields, run, setError };
}
