jest.mock("expo-secure-store", () => {
  const store: Record<string, string> = {};
  return {
    getItemAsync: jest.fn(async (k: string) => store[k] ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => { store[k] = v; }),
    deleteItemAsync: jest.fn(async (k: string) => { delete store[k]; }),
  };
});
jest.mock("expo-constants", () => ({ expoConfig: { extra: { apiUrl: "https://api.test" } } }));

import { api, ApiError, setToken, absoluteUrl } from "../src/api";

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof fetch;

beforeEach(() => fetchMock.mockReset());

test("sends the bearer token and the mobile client header", async () => {
  await setToken("tok_1234567890abcdefghij");
  fetchMock.mockResolvedValue({ status: 200, json: async () => ({ ok: true, data: { hello: "world" } }) });
  const r = await api<{ hello: string }>("/me");
  expect(r.hello).toBe("world");
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("https://api.test/api/v1/me");
  expect(init.headers.authorization).toBe("Bearer tok_1234567890abcdefghij");
  expect(init.headers["x-faceoff-client"]).toBe("mobile");
  expect(init.method).toBe("GET");
});

test("posts JSON bodies and surfaces API errors with field details", async () => {
  fetchMock.mockResolvedValue({ status: 422, json: async () => ({ ok: false, error: { code: "validation_error", message: "Pick a date", fields: { proposedStart: "Pick a date" } } }) });
  await expect(api("/challenges", { body: { a: 1 } })).rejects.toMatchObject({ status: 422, code: "validation_error", fields: { proposedStart: "Pick a date" } });
  expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  expect(fetchMock.mock.calls[0][1].headers["content-type"]).toBe("application/json");
});

test("clears the stored token when the server rejects it", async () => {
  await setToken("tok_expired_abcdefghijklmnop");
  fetchMock.mockResolvedValueOnce({ status: 401, json: async () => ({ ok: false, error: { code: "unauthorized", message: "Sign in" } }) });
  await expect(api("/me")).rejects.toBeInstanceOf(ApiError);
  fetchMock.mockResolvedValueOnce({ status: 200, json: async () => ({ ok: true, data: null }) });
  await api("/me");
  expect(fetchMock.mock.calls[1][1].headers.authorization).toBeUndefined();
});

test("reports network failures in plain language", async () => {
  fetchMock.mockRejectedValue(new Error("offline"));
  await expect(api("/feed")).rejects.toMatchObject({ code: "network" });
});

test("resolves relative media URLs against the API host", () => {
  expect(absoluteUrl("/media/avatars/x.webp")).toBe("https://api.test/media/avatars/x.webp");
  expect(absoluteUrl("https://cdn.test/a.webp")).toBe("https://cdn.test/a.webp");
  expect(absoluteUrl(null)).toBeNull();
});
