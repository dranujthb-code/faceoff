import type { ApiResult } from "@faceoff/shared";

export class ClientApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fields?: Record<string, string>) {
    super(message);
  }
}

/** Fetch wrapper for /api/v1. Same-origin cookie auth; the header marks first-party requests. */
export async function api<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: { "x-faceoff-client": "web", ...(init.body !== undefined && !(init.body instanceof FormData) ? { "content-type": "application/json" } : {}) },
      body: init.body === undefined ? undefined : init.body instanceof FormData ? init.body : JSON.stringify(init.body),
      credentials: "same-origin",
      signal: init.signal,
      cache: "no-store",
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ClientApiError(0, "network", "You appear to be offline. Check your connection and try again.");
  }
  let json: ApiResult<T>;
  try {
    json = (await res.json()) as ApiResult<T>;
  } catch {
    throw new ClientApiError(res.status, "bad_response", "Unexpected response from the server.");
  }
  if (!json.ok) throw new ClientApiError(res.status, json.error.code, json.error.message, json.error.fields);
  return json.data;
}
