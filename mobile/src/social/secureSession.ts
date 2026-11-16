/** Tokens and the cached profile live in the iOS Keychain (expo-secure-store), never in SQLite. */
import * as SecureStore from "expo-secure-store";
import Storage from "expo-sqlite/kv-store";
import { dayKey } from "../program/dates";
import type { Me, Tokens } from "./types";

const ACCESS = "health.accessToken";
const REFRESH = "health.refreshToken";
const ME = "health.me";
/** Install day on this phone. Lives in the app sandbox, so it disappears on uninstall while Keychain items survive. */
const INSTALL_MARKER = "health.installed";

/**
 * A reinstalled app starts with an empty local log but may still find tokens in the Keychain.
 * Signing in again then would sync an empty window and wipe the server copy, so drop
 * Keychain tokens left over from a previous install.
 */
async function forgetPreviousInstall(): Promise<void> {
  if (await Storage.getItemAsync(INSTALL_MARKER)) return;
  await clearSession();
  await Storage.setItemAsync(INSTALL_MARKER, dayKey(new Date()));
}

export async function loadSession(): Promise<{ tokens: Tokens; me: Me | null } | null> {
  await forgetPreviousInstall();
  const [accessToken, refreshToken, me] = await Promise.all([
    SecureStore.getItemAsync(ACCESS),
    SecureStore.getItemAsync(REFRESH),
    SecureStore.getItemAsync(ME),
  ]);
  if (!accessToken) return null;
  let parsed: Me | null = null;
  try {
    parsed = me ? (JSON.parse(me) as Me) : null;
  } catch {
    parsed = null;
  }
  return { tokens: { accessToken, refreshToken }, me: parsed };
}

export async function saveTokens(tokens: Tokens): Promise<void> {
  await SecureStore.setItemAsync(ACCESS, tokens.accessToken);
  if (tokens.refreshToken) await SecureStore.setItemAsync(REFRESH, tokens.refreshToken);
  else await SecureStore.deleteItemAsync(REFRESH);
}

export async function saveMe(me: Me): Promise<void> {
  await SecureStore.setItemAsync(ME, JSON.stringify(me));
}

export async function clearSession(): Promise<void> {
  await Promise.all([ACCESS, REFRESH, ME].map((k) => SecureStore.deleteItemAsync(k)));
}

/** The day this install started tracking; sync never replaces server data from before it. */
export async function trackedSince(): Promise<string> {
  await forgetPreviousInstall();
  return (await Storage.getItemAsync(INSTALL_MARKER)) ?? dayKey(new Date());
}
