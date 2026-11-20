import { describe, expect, it, vi } from "vitest";
import { ApiError, createHealthApi } from "./api";
import type { Tokens } from "./types";

type Call = { url: string; method: string; auth: string | undefined; body: unknown };

function setup(responses: (Response | Error)[], initial: Tokens | null = { accessToken: "a1", refreshToken: "r1" }) {
  let tokens = initial;
  const calls: Call[] = [];
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    const headers = init.headers as Record<string, string>;
    calls.push({
      url,
      method: init.method ?? "GET",
      auth: headers.Authorization,
      body: init.body ? JSON.parse(init.body as string) : undefined,
    });
    const next = responses.shift();
    if (!next) throw new Error("unexpected fetch");
    if (next instanceof Error) throw next;
    return next;
  });
  const onAuthLost = vi.fn();
  const api = createHealthApi({
    baseUrl: "https://example.test/",
    fetch,
    getTokens: () => tokens,
    saveTokens: async (t) => {
      tokens = t;
    },
    onAuthLost,
  });
  return { api, calls, onAuthLost, tokens: () => tokens };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const ME = { id: "u1", displayName: "Hallgeir", friendCode: "ABC123" };

describe("health api", () => {
  it("sends the bearer token and today", async () => {
    const { api, calls } = setup([json(200, { user: ME, stats: {} })]);
    await api.me("2026-11-16");
    expect(calls[0]).toMatchObject({
      url: "https://example.test/api/health/me?today=2026-11-16",
      method: "GET",
      auth: "Bearer a1",
    });
  });

  it("refreshes once on 401 and retries with the new token", async () => {
    const { api, calls, onAuthLost, tokens } = setup([
      json(401, { error: "expired" }),
      json(200, { accessToken: "a2", refreshToken: "r2" }),
      json(200, { user: ME }),
    ]);
    await expect(api.updateMe("Hal")).resolves.toEqual({ user: ME });
    expect(calls.map((c) => [c.url.replace("https://example.test/api/health", ""), c.auth])).toEqual([
      ["/me", "Bearer a1"],
      ["/auth/refresh", undefined],
      ["/me", "Bearer a2"],
    ]);
    expect(calls[1]!.body).toEqual({ refreshToken: "r1" });
    expect(tokens()).toEqual({ accessToken: "a2", refreshToken: "r2" });
    expect(onAuthLost).not.toHaveBeenCalled();
  });

  it("signs out locally when the refresh is rejected", async () => {
    const { api, onAuthLost } = setup([json(401, { error: "expired" }), json(401, { error: "bad refresh" })]);
    await expect(api.leaderboard("2026-11-16")).rejects.toMatchObject({ status: 401 });
    expect(onAuthLost).toHaveBeenCalledTimes(1);
  });

  it("signs out without a refresh token (dev login)", async () => {
    const { api, calls, onAuthLost } = setup([json(401, { error: "no" })], { accessToken: "dev:kari", refreshToken: null });
    await expect(api.challenges("2026-11-16")).rejects.toBeInstanceOf(ApiError);
    expect(calls).toHaveLength(1);
    expect(onAuthLost).toHaveBeenCalledTimes(1);
  });

  it("keeps the session when the refresh fails for network reasons", async () => {
    const { api, onAuthLost } = setup([json(401, { error: "expired" }), new TypeError("Network request failed")]);
    await expect(api.sync({ today: "2026-11-16", since: "2026-07-20", entries: [], sessions: [] })).rejects.toThrow(
      "Network request failed",
    );
    expect(onAuthLost).not.toHaveBeenCalled();
  });

  it("shares one refresh between parallel requests", async () => {
    const { api, calls } = setup([
      json(401, {}),
      json(401, {}),
      json(200, { accessToken: "a2", refreshToken: "r2" }),
      json(200, { rows: [] }),
      json(200, { challenges: [] }),
    ]);
    await Promise.all([api.leaderboard("2026-11-16"), api.challenges("2026-11-16")]);
    expect(calls.filter((c) => c.url.endsWith("/auth/refresh"))).toHaveLength(1);
  });

  it("surfaces the API error message and status", async () => {
    const { api } = setup([json(404, { error: "Unknown friend code" })]);
    await expect(
      api.createChallenge({ friendCode: "NOPE", exercise: "pushups", type: "most_in_period", days: 7 }),
    ).rejects.toMatchObject({ status: 404, message: "Unknown friend code" });
  });
});
