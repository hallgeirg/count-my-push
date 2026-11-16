import { describe, expect, it } from "vitest";
import {
  base64ToBase64Url,
  buildAuthorizeUrl,
  bytesToBase64Url,
  createPkce,
  parseAuthCallback,
  queryParams,
} from "./pkce";

// RFC 7636, appendix B.
const RFC_BYTES = [
  116, 24, 223, 180, 151, 153, 224, 37, 79, 250, 96, 125, 216, 173, 187, 186, 22, 212, 37, 77, 105, 214, 191, 240, 91,
  88, 5, 88, 83, 132, 141, 121,
];
const RFC_VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const RFC_SHA256_BASE64 = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw+cM=";
const RFC_CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

describe("base64url", () => {
  it("encodes the RFC 7636 verifier bytes", () => {
    expect(bytesToBase64Url(Uint8Array.from(RFC_BYTES))).toBe(RFC_VERIFIER);
  });

  it("drops padding for lengths that are not multiples of three", () => {
    expect(bytesToBase64Url(Uint8Array.from([0xff]))).toBe("_w");
    expect(bytesToBase64Url(Uint8Array.from([0xff, 0xfe]))).toBe("__4");
    expect(bytesToBase64Url(Uint8Array.from([0xfb, 0xff, 0xbf]))).toBe("-_-_");
  });

  it("converts padded base64 to base64url", () => {
    expect(base64ToBase64Url(RFC_SHA256_BASE64)).toBe(RFC_CHALLENGE);
  });
});

describe("createPkce", () => {
  it("derives the S256 challenge from the verifier", async () => {
    const calls: number[] = [];
    const pkce = await createPkce({
      randomBytes: (n) => {
        calls.push(n);
        return n === 32 ? Uint8Array.from(RFC_BYTES) : new Uint8Array(n).fill(1);
      },
      sha256Base64: async (s) => (s === RFC_VERIFIER ? RFC_SHA256_BASE64 : "wrong"),
    });
    expect(pkce.verifier).toBe(RFC_VERIFIER);
    expect(pkce.challenge).toBe(RFC_CHALLENGE);
    expect(pkce.state).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(calls).toEqual([32, 16]);
  });
});

describe("buildAuthorizeUrl", () => {
  const base = {
    clientId: "client_123",
    redirectUri: "countmypush://auth/callback",
    codeChallenge: RFC_CHALLENGE,
    state: "abc",
  };

  it("asks AuthKit for a PKCE code", () => {
    const url = buildAuthorizeUrl(base);
    expect(url.startsWith("https://api.workos.com/user_management/authorize?")).toBe(true);
    expect(queryParams(url)).toEqual({
      response_type: "code",
      provider: "authkit",
      client_id: "client_123",
      redirect_uri: "countmypush://auth/callback",
      code_challenge: RFC_CHALLENGE,
      code_challenge_method: "S256",
      state: "abc",
    });
    expect(url).toContain("redirect_uri=countmypush%3A%2F%2Fauth%2Fcallback");
  });

  it("adds the sign-up hint for new accounts", () => {
    expect(queryParams(buildAuthorizeUrl({ ...base, signUp: true })).screen_hint).toBe("sign-up");
  });
});

describe("parseAuthCallback", () => {
  it("returns the code when state matches", () => {
    expect(parseAuthCallback("countmypush://auth/callback?code=01ABC&state=s1", "s1")).toEqual({
      ok: true,
      code: "01ABC",
    });
  });

  it("rejects a different state", () => {
    expect(parseAuthCallback("countmypush://auth/callback?code=01ABC&state=evil", "s1")).toEqual({
      ok: false,
      reason: "state",
    });
  });

  it("reports an AuthKit error and a missing code", () => {
    expect(parseAuthCallback("countmypush://auth/callback?error=access_denied&state=s1", "s1")).toEqual({
      ok: false,
      reason: "denied",
    });
    expect(parseAuthCallback("countmypush://auth/callback?state=s1", "s1")).toEqual({ ok: false, reason: "missing" });
  });

  it("decodes encoded values and ignores fragments", () => {
    expect(parseAuthCallback("countmypush://auth/callback?state=a%2Bb&code=x%20y#frag", "a+b")).toEqual({
      ok: true,
      code: "x y",
    });
  });
});
