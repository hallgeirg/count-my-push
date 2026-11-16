/** PKCE and AuthKit URL helpers (RFC 7636). Pure: the caller supplies random bytes and SHA-256. */

export const WORKOS_AUTHORIZE_URL = "https://api.workos.com/user_management/authorize";

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Unpadded base64url of raw bytes. */
export function bytesToBase64Url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = Math.min(4, Math.ceil(((bytes.length - i) * 8) / 6));
    for (let j = 0; j < chars; j++) out += B64[(n >> (18 - 6 * j)) & 63];
  }
  return out;
}

/** Turns standard (padded) base64 into unpadded base64url. */
export function base64ToBase64Url(b64: string): string {
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type Pkce = { verifier: string; challenge: string; state: string };

export async function createPkce(deps: {
  randomBytes: (n: number) => Uint8Array;
  sha256Base64: (s: string) => Promise<string>;
}): Promise<Pkce> {
  const verifier = bytesToBase64Url(deps.randomBytes(32));
  const challenge = base64ToBase64Url(await deps.sha256Base64(verifier));
  const state = bytesToBase64Url(deps.randomBytes(16));
  return { verifier, challenge, state };
}

export function buildAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  signUp?: boolean;
}): string {
  const params: [string, string][] = [
    ["response_type", "code"],
    ["provider", "authkit"],
    ["client_id", opts.clientId],
    ["redirect_uri", opts.redirectUri],
    ["code_challenge", opts.codeChallenge],
    ["code_challenge_method", "S256"],
    ["state", opts.state],
  ];
  if (opts.signUp) params.push(["screen_hint", "sign-up"]);
  return `${WORKOS_AUTHORIZE_URL}?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")}`;
}

/** Query parameters of a URL, without relying on React Native's partial `URL` implementation. */
export function queryParams(url: string): Record<string, string> {
  const query = url.split("#")[0]!.split("?")[1] ?? "";
  const out: Record<string, string> = {};
  for (const part of query.split("&")) {
    if (!part) continue;
    const [k, v = ""] = part.split("=");
    const decode = (s: string) => decodeURIComponent(s.replace(/\+/g, " "));
    out[decode(k!)] = decode(v);
  }
  return out;
}

export type CallbackResult = { ok: true; code: string } | { ok: false; reason: "state" | "denied" | "missing" };

/** Reads the AuthKit redirect and checks that `state` is the one we sent. */
export function parseAuthCallback(url: string, expectedState: string): CallbackResult {
  const p = queryParams(url);
  if (p.state !== expectedState) return { ok: false, reason: "state" };
  if (p.error) return { ok: false, reason: "denied" };
  if (!p.code) return { ok: false, reason: "missing" };
  return { ok: true, code: p.code };
}
