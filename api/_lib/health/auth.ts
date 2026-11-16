import type { VercelRequest } from "@vercel/node";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { HttpError } from "./http.js";
import { findUserByWorkosId, upsertUser, type HealthUser } from "./store.js";
import { deriveDisplayName } from "./users.js";

// WorkOS User Management (AuthKit). Docs:
// - https://workos.com/docs/reference/authkit/authentication/code
// - https://workos.com/docs/reference/authkit/authentication/refresh-token
// - https://workos.com/docs/reference/authkit/session-tokens/access-token
// - https://workos.com/docs/reference/authkit/session-tokens/jwks
// Never log tokens, codes or the API key.

const WORKOS_API = "https://api.workos.com";
export const REDIRECT_URI = "countmypush://auth/callback";

export function workosConfig(): { clientId: string; apiKey: string } | null {
  const clientId = process.env.WORKOS_CLIENT_ID?.trim();
  const apiKey = process.env.WORKOS_API_KEY?.trim();
  return clientId && apiKey ? { clientId, apiKey } : null;
}

function requireConfig() {
  const config = workosConfig();
  if (!config) throw new HttpError(503, "Sign-in is not configured");
  return config;
}

// --- Code exchange and refresh

type WorkosUser = { id: string; email?: string | null; first_name?: string | null };
type WorkosAuthResponse = { access_token: string; refresh_token: string; user: WorkosUser };

async function authenticate(grant: Record<string, string>): Promise<WorkosAuthResponse> {
  const { clientId, apiKey } = requireConfig();
  const res = await fetch(`${WORKOS_API}/user_management/authenticate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: apiKey, ...grant }),
  });
  const body = (await res.json().catch(() => null)) as
    | (Partial<WorkosAuthResponse> & { error?: unknown; code?: unknown })
    | null;
  if (!res.ok || !body?.access_token || !body.refresh_token) {
    // Only the status and WorkOS's error code are logged — never the request or tokens.
    const code = typeof body?.error === "string" ? body.error : typeof body?.code === "string" ? body.code : "";
    console.error(`workos authenticate failed: ${res.status} ${code}`.trim());
    if (res.status >= 400 && res.status < 500) throw new HttpError(401, "Sign-in failed");
    throw new HttpError(500, "Sign-in service unavailable");
  }
  return body as WorkosAuthResponse;
}

/** Exchanges an AuthKit PKCE code; creates the user row on first sign-in. */
export async function exchangeCode(code: string, codeVerifier: string) {
  const r = await authenticate({ grant_type: "authorization_code", code, code_verifier: codeVerifier });
  if (!r.user?.id) throw new HttpError(500, "Sign-in service unavailable");
  const email = r.user.email ?? null;
  const user = await upsertUser(r.user.id, {
    email,
    displayName: deriveDisplayName({ firstName: r.user.first_name, email }),
  });
  return { accessToken: r.access_token, refreshToken: r.refresh_token, user };
}

export async function refreshTokens(refreshToken: string) {
  const r = await authenticate({ grant_type: "refresh_token", refresh_token: refreshToken });
  return { accessToken: r.access_token, refreshToken: r.refresh_token };
}

// --- Access-token verification

let jwksOverride: JWTVerifyGetKey | null = null;
let remote: { clientId: string; jwks: JWTVerifyGetKey } | null = null;

/** Tests pass a local key set; pass null to go back to the WorkOS JWKS. */
export function setJwksOverride(jwks: JWTVerifyGetKey | null) {
  jwksOverride = jwks;
}

function jwksFor(clientId: string): JWTVerifyGetKey {
  if (jwksOverride) return jwksOverride;
  if (remote?.clientId !== clientId) {
    // jose caches keys and refetches on unknown `kid`, so this survives key rotation.
    remote = { clientId, jwks: createRemoteJWKSet(new URL(`${WORKOS_API}/sso/jwks/${clientId}`)) };
  }
  return remote.jwks;
}

/** Returns the WorkOS user id (`sub`) of a valid access token, or throws 401. */
export async function verifyAccessToken(token: string): Promise<string> {
  const clientId = process.env.WORKOS_CLIENT_ID?.trim();
  if (!clientId) throw new HttpError(503, "Sign-in is not configured");
  try {
    const { payload } = await jwtVerify(token, jwksFor(clientId), {
      requiredClaims: ["sub", "exp"],
      clockTolerance: 5,
    });
    if (payload.client_id !== undefined && payload.client_id !== clientId) throw new Error("client mismatch");
    return payload.sub as string;
  } catch {
    throw new HttpError(401, "Invalid token");
  }
}

// --- Dev auth: `Bearer dev:<name>` for the simulator, never on Vercel.

const DEV_NAME = /^[A-Za-z0-9_.-]{1,40}$/;

export function isDevAuthEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.HEALTH_DEV_AUTH === "1" && !env.VERCEL;
}

function bearer(req: VercelRequest): string | null {
  const header = req.headers?.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  const m = value ? /^Bearer\s+(.+)$/i.exec(value.trim()) : null;
  return m ? m[1] : null;
}

/** The signed-in user, created on first sight; throws 401 without a valid token. */
export async function requireUser(req: VercelRequest): Promise<HealthUser> {
  const token = bearer(req);
  if (!token) throw new HttpError(401, "Missing token");

  if (token.startsWith("dev:")) {
    const name = token.slice(4);
    if (!isDevAuthEnabled() || !DEV_NAME.test(name)) throw new HttpError(401, "Invalid token");
    return (
      (await findUserByWorkosId(token)) ??
      (await upsertUser(token, { email: null, displayName: deriveDisplayName({ firstName: name }) }))
    );
  }

  const workosUserId = await verifyAccessToken(token);
  // Normally created at token exchange; recreate if the row is gone (e.g. a reset database).
  return (
    (await findUserByWorkosId(workosUserId)) ??
    (await upsertUser(workosUserId, { email: null, displayName: deriveDisplayName({}) }))
  );
}
