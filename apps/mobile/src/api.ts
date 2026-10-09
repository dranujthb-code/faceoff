import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import type { ApiResult } from "@faceoff/shared";

const TOKEN_KEY = "fo_session_token";
export const API_URL: string = (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? "http://localhost:3000";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fields?: Record<string, string>) {
    super(message);
  }
}

let memoryToken: string | null = null;

export async function getToken(): Promise<string | null> {
  if (memoryToken) return memoryToken;
  memoryToken = await SecureStore.getItemAsync(TOKEN_KEY);
  return memoryToken;
}
export async function setToken(token: string | null) {
  memoryToken = token;
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/** Calls the shared FaceOff API with the session token in the Authorization header (no cookies). */
export async function api<T>(path: string, init: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const token = await getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1${path}`, {
      method: init.method ?? (init.body !== undefined || init.form ? "POST" : "GET"),
      headers: {
        "x-faceoff-client": "mobile",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
    });
  } catch {
    throw new ApiError(0, "network", "Can't reach FaceOff. Check your connection and try again.");
  }
  const json = (await res.json().catch(() => null)) as ApiResult<T> | null;
  if (!json) throw new ApiError(res.status, "bad_response", "Unexpected response from the server.");
  if (!json.ok) {
    if (res.status === 401 && token) await setToken(null);
    throw new ApiError(res.status, json.error.code, json.error.message, json.error.fields);
  }
  return json.data;
}

export function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith("http") ? url : `${API_URL}${url}`;
}
