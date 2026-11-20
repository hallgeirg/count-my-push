/** Make More Health API client (`docs/health-api.md`). No Expo imports, so it runs under vitest. */
import type {
  AuthConfig,
  Challenge,
  Leaderboard,
  Me,
  NewChallenge,
  Stats,
  SyncPayload,
  Tokens,
} from "./types";
import type { DayKey } from "../program/types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type ApiDeps = {
  baseUrl: string;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  getTokens: () => Tokens | null;
  saveTokens: (tokens: Tokens) => Promise<void>;
  /** The server rejected both the access token and the refresh: sign out locally. */
  onAuthLost: () => void;
};

export type HealthApi = ReturnType<typeof createHealthApi>;

export function createHealthApi(deps: ApiDeps) {
  const base = deps.baseUrl.replace(/\/+$/, "");
  let refreshing: Promise<boolean> | null = null;

  async function send(method: string, path: string, body: unknown, token: string | null): Promise<Response> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    return deps.fetch(`${base}/api/health${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async function parse<T>(res: Response): Promise<T> {
    const json = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      const message =
        json && typeof json === "object" && "error" in json && typeof json.error === "string"
          ? json.error
          : `HTTP ${res.status}`;
      throw new ApiError(res.status, message);
    }
    return json as T;
  }

  /** true = new tokens saved; false = the server said no (sign out). Network/5xx errors throw. */
  function refreshOnce(): Promise<boolean> {
    refreshing ??= (async () => {
      const refreshToken = deps.getTokens()?.refreshToken;
      if (!refreshToken) return false;
      const res = await send("POST", "/auth/refresh", { refreshToken }, null);
      if (res.status >= 400 && res.status < 500) return false;
      const tokens = await parse<{ accessToken: string; refreshToken: string }>(res);
      await deps.saveTokens(tokens);
      return true;
    })().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  async function authed<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = deps.getTokens()?.accessToken;
    if (!token) throw new ApiError(401, "Not signed in");
    let res = await send(method, path, body, token);
    if (res.status === 401) {
      if (!(await refreshOnce())) {
        deps.onAuthLost();
        throw new ApiError(401, "Session expired");
      }
      res = await send(method, path, body, deps.getTokens()?.accessToken ?? null);
      if (res.status === 401) {
        deps.onAuthLost();
        throw new ApiError(401, "Session expired");
      }
    }
    return parse<T>(res);
  }

  const q = (today: DayKey) => `?today=${encodeURIComponent(today)}`;

  return {
    authConfig: async () => parse<AuthConfig>(await send("GET", "/auth/config", undefined, null)),
    exchangeCode: async (code: string, codeVerifier: string) =>
      parse<{ accessToken: string; refreshToken: string; user: Me }>(
        await send("POST", "/auth/token", { code, codeVerifier }, null),
      ),
    me: (today: DayKey) => authed<{ user: Me; stats: Stats }>("GET", `/me${q(today)}`),
    updateMe: (displayName: string) => authed<{ user: Me }>("PATCH", "/me", { displayName }),
    sync: (payload: SyncPayload) => authed<{ stats: Stats }>("POST", "/sync", payload),
    leaderboard: (today: DayKey, exercise = "pushups") =>
      authed<Leaderboard>("GET", `/leaderboard${q(today)}&exercise=${encodeURIComponent(exercise)}`),
    challenges: (today: DayKey) => authed<{ challenges: Challenge[] }>("GET", `/challenges${q(today)}`),
    createChallenge: (input: NewChallenge) => authed<{ challenge: Challenge }>("POST", "/challenges", input),
    respond: (id: string, accept: boolean, today: DayKey) =>
      authed<{ challenge: Challenge }>("POST", "/challenges/respond", { id, accept, today }),
  };
}
