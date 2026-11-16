/** WorkOS AuthKit sign-in with PKCE in an ASWebAuthenticationSession (expo-web-browser). */
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import { ApiError, type HealthApi } from "./api";
import { buildAuthorizeUrl, createPkce, parseAuthCallback } from "./pkce";

/** A failure with a message that can be shown as is. */
export class AuthError extends Error {}

/** Opens AuthKit and returns the code and verifier, or null when the user closes the sheet. */
export async function authorizeWithAuthKit(
  api: HealthApi,
  signUp: boolean,
): Promise<{ code: string; verifier: string } | null> {
  const config = await api.authConfig().catch((e: unknown) => {
    if (e instanceof ApiError && e.status === 503) throw new AuthError("Innlogging er ikke satt opp på serveren ennå.");
    throw e;
  });
  const pkce = await createPkce({
    randomBytes: Crypto.getRandomBytes,
    sha256Base64: (s) =>
      Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, s, { encoding: Crypto.CryptoEncoding.BASE64 }),
  });
  const url = buildAuthorizeUrl({
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    codeChallenge: pkce.challenge,
    state: pkce.state,
    signUp,
  });
  // Ephemeral: no shared Safari cookies, so «Logg ut» in the app really logs out.
  const result = await WebBrowser.openAuthSessionAsync(url, config.redirectUri, { preferEphemeralSession: true });
  if (result.type !== "success") return null;
  const parsed = parseAuthCallback(result.url, pkce.state);
  if (parsed.ok) return { code: parsed.code, verifier: pkce.verifier };
  if (parsed.reason === "denied") return null;
  throw new AuthError("Innloggingen kunne ikke bekreftes. Prøv igjen.");
}
