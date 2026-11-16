import { exportJWK, generateKeyPair, createLocalJWKSet, SignJWT, type JWK } from "jose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import config from "../../api/health/auth/config.js";
import refresh from "../../api/health/auth/refresh.js";
import token from "../../api/health/auth/token.js";
import me from "../../api/health/me.js";
import { isDevAuthEnabled, setJwksOverride } from "../../api/_lib/health/auth.js";
import { call, useTestDb } from "./harness.js";

const CLIENT_ID = "client_test123";
let testDb: Awaited<ReturnType<typeof useTestDb>>;
type Key = Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];
let privateKey: Key;
let otherKey: Key;

beforeAll(async () => {
  testDb = await useTestDb();
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  otherKey = (await generateKeyPair("RS256")).privateKey;
  const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" };
  setJwksOverride(createLocalJWKSet({ keys: [jwk] }));
});
afterAll(async () => {
  setJwksOverride(null);
  await testDb.close();
});
beforeEach(() => {
  vi.stubEnv("WORKOS_CLIENT_ID", CLIENT_ID);
  vi.stubEnv("WORKOS_API_KEY", "sk_test_fake");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function sign(claims: Record<string, unknown>, opts: { key?: Key; exp?: string | number } = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? "5m")
    .sign(opts.key ?? privateKey);
}

function mockWorkos(status: number, body: unknown) {
  const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("auth config", () => {
  it("returns client id and redirect uri", async () => {
    const res = await call(config);
    expect(res).toMatchObject({ status: 200, body: { clientId: CLIENT_ID, redirectUri: "countmypush://auth/callback" } });
  });

  it("is 503 when WorkOS is not configured", async () => {
    vi.stubEnv("WORKOS_API_KEY", "");
    expect((await call(config)).status).toBe(503);
  });
});

describe("token exchange", () => {
  it("exchanges the code with the API key and PKCE verifier, creating the user", async () => {
    const fetchMock = mockWorkos(200, {
      user: { id: "user_01ABC", email: "kari@example.com", first_name: "Kari" },
      access_token: "at_1",
      refresh_token: "rt_1",
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call(token, { method: "POST", body: { code: "code_1", codeVerifier: "verifier_1" } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      accessToken: "at_1",
      refreshToken: "rt_1",
      user: { id: expect.any(String), displayName: "Kari", friendCode: expect.stringMatching(/^[A-Z2-9]{6}$/) },
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.workos.com/user_management/authenticate");
    expect(JSON.parse(init.body as string)).toEqual({
      client_id: CLIENT_ID,
      client_secret: "sk_test_fake",
      grant_type: "authorization_code",
      code: "code_1",
      code_verifier: "verifier_1",
    });
    expect(log).not.toHaveBeenCalled();

    // Signing in again keeps the same user and friend code.
    mockWorkos(200, { user: { id: "user_01ABC", email: "kari@example.com", first_name: "Changed" }, access_token: "a", refresh_token: "r" });
    const again = await call(token, { method: "POST", body: { code: "code_2", codeVerifier: "v" } });
    expect(again.body.user).toEqual(res.body.user);
  });

  it("falls back to the e-mail local part for the display name", async () => {
    mockWorkos(200, { user: { id: "user_02", email: "ola@example.com", first_name: null }, access_token: "a", refresh_token: "r" });
    const res = await call(token, { method: "POST", body: { code: "c", codeVerifier: "v" } });
    expect(res.body.user.displayName).toBe("ola");
  });

  it("maps a rejected code to 401 without logging secrets", async () => {
    mockWorkos(400, { error: "invalid_grant", error_description: "bad code" });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call(token, { method: "POST", body: { code: "secret_code", codeVerifier: "secret_verifier" } });
    expect(res.status).toBe(401);
    const logged = log.mock.calls.flat().join(" ");
    expect(logged).toContain("400");
    expect(logged).not.toMatch(/secret_code|secret_verifier|sk_test_fake/);
  });

  it("validates the body and refuses when not configured", async () => {
    expect((await call(token, { method: "POST", body: { code: "c" } })).status).toBe(400);
    expect((await call(token, { method: "GET" })).status).toBe(405);
    vi.stubEnv("WORKOS_CLIENT_ID", "");
    expect((await call(token, { method: "POST", body: { code: "c", codeVerifier: "v" } })).status).toBe(503);
  });
});

describe("refresh", () => {
  it("uses the refresh_token grant", async () => {
    const fetchMock = mockWorkos(200, { user: { id: "user_01ABC" }, access_token: "at_2", refresh_token: "rt_2" });
    const res = await call(refresh, { method: "POST", body: { refreshToken: "rt_1" } });
    expect(res).toMatchObject({ status: 200, body: { accessToken: "at_2", refreshToken: "rt_2" } });
    expect(JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string)).toEqual({
      client_id: CLIENT_ID,
      client_secret: "sk_test_fake",
      grant_type: "refresh_token",
      refresh_token: "rt_1",
    });
  });

  it("returns 401 for a revoked refresh token", async () => {
    mockWorkos(400, { error: "invalid_grant" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await call(refresh, { method: "POST", body: { refreshToken: "x" } })).status).toBe(401);
  });
});

describe("access token verification", () => {
  const today = "2026-11-16";

  it("accepts a valid WorkOS JWT and resolves the user", async () => {
    const jwt = await sign({ sub: "user_01ABC", client_id: CLIENT_ID });
    const res = await call(me, { token: jwt, query: { today } });
    expect(res.status).toBe(200);
    expect(res.body.user.displayName).toBe("Kari");
  });

  it("creates a user for a valid token without a row", async () => {
    const res = await call(me, { token: await sign({ sub: "user_new" }), query: { today } });
    expect(res.status).toBe(200);
    expect(res.body.user.displayName).toBe("Athlete");
  });

  it("rejects expired, foreign-signed, other-client and garbage tokens", async () => {
    const bad = [
      await sign({ sub: "user_01ABC" }, { exp: Math.floor(Date.now() / 1000) - 60 }),
      await sign({ sub: "user_01ABC" }, { key: otherKey }),
      await sign({ sub: "user_01ABC", client_id: "client_other" }),
      await sign({ client_id: CLIENT_ID }),
      "not.a.jwt",
    ];
    for (const t of bad) expect((await call(me, { token: t, query: { today } })).status).toBe(401);
  });
});

describe("dev auth switch", () => {
  it("is on only with HEALTH_DEV_AUTH=1 and outside Vercel", () => {
    expect(isDevAuthEnabled({ HEALTH_DEV_AUTH: "1" })).toBe(true);
    expect(isDevAuthEnabled({ HEALTH_DEV_AUTH: "1", VERCEL: "1" })).toBe(false);
    expect(isDevAuthEnabled({ HEALTH_DEV_AUTH: "true" })).toBe(false);
    expect(isDevAuthEnabled({})).toBe(false);
  });
});
