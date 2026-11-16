import { randomInt } from "node:crypto";

/** No 0/O, 1/I/L — easy to read aloud and type. */
export const FRIEND_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const FRIEND_CODE_LENGTH = 6;

export function generateFriendCode(nextInt: (max: number) => number = randomInt): string {
  let code = "";
  for (let i = 0; i < FRIEND_CODE_LENGTH; i++) {
    code += FRIEND_CODE_ALPHABET[nextInt(FRIEND_CODE_ALPHABET.length)];
  }
  return code;
}

/** Normalises user input (case, spaces, dashes); null if it cannot be a friend code. */
export function normalizeFriendCode(input: string): string | null {
  const code = input.replace(/[\s-]/g, "").toUpperCase();
  if (code.length !== FRIEND_CODE_LENGTH) return null;
  for (const ch of code) if (!FRIEND_CODE_ALPHABET.includes(ch)) return null;
  return code;
}

export const DISPLAY_NAME_MAX = 40;
export const FALLBACK_DISPLAY_NAME = "Athlete";

/** WorkOS first name, else the part of the e-mail before `@`, else a fallback; trimmed to 40 chars. */
export function deriveDisplayName(profile: { firstName?: string | null; email?: string | null }): string {
  const candidates = [profile.firstName, profile.email?.split("@")[0]];
  for (const c of candidates) {
    const name = c?.trim().slice(0, DISPLAY_NAME_MAX).trim();
    if (name) return name;
  }
  return FALLBACK_DISPLAY_NAME;
}
