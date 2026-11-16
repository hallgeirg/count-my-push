/** Build-time settings. `EXPO_PUBLIC_*` must be read literally so Metro can inline them. */
const apiUrl = process.env.EXPO_PUBLIC_HEALTH_API_URL?.trim();

/** null = «Sammen» is not set up in this build; the app stays local-only. */
export const HEALTH_API_URL: string | null = apiUrl ? apiUrl : null;

/** Shows the `dev:<name>` login that only the local dev server accepts. */
export const DEV_LOGIN_ENABLED = process.env.EXPO_PUBLIC_HEALTH_DEV_LOGIN === "1";
