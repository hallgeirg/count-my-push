/**
 * Optional account, sync and social data. The local log in AppDataProvider stays the source of truth:
 * everything here may fail quietly and the app keeps working offline and signed out.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { dayKey } from "../program/dates";
import type { AppData } from "../program/types";
import { useAppData } from "../store/AppDataProvider";
import { ApiError, createHealthApi } from "./api";
import { AuthError, authorizeWithAuthKit } from "./authkit";
import { DEV_LOGIN_ENABLED, HEALTH_API_URL } from "./config";
import { clearSession, loadSession, saveMe, saveTokens, trackedSince } from "./secureSession";
import { buildSyncPayload } from "./syncPayload";
import type { Challenge, Leaderboard, Me, NewChallenge, Stats, Tokens } from "./types";

export type SocialStatus = "unconfigured" | "loading" | "signedOut" | "signedIn";

type SocialContextValue = {
  status: SocialStatus;
  devLoginEnabled: boolean;
  me: Me | null;
  stats: Stats | null;
  leaderboard: Leaderboard | null;
  challenges: Challenge[] | null;
  /** The last upload failed and nothing has succeeded since. */
  syncFailed: boolean;
  /** The last fetch of leaderboard/challenges failed. */
  loadFailed: boolean;
  signingIn: boolean;
  authError: string | null;
  signIn: (opts?: { signUp?: boolean }) => Promise<void>;
  devSignIn: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Upload, then fetch me, leaderboard and challenges. Never throws. */
  refresh: () => Promise<void>;
  loadSocial: () => Promise<void>;
  /** These throw ApiError (or a network TypeError) for the screen to explain. */
  updateDisplayName: (name: string) => Promise<void>;
  createChallenge: (input: NewChallenge) => Promise<void>;
  respond: (id: string, accept: boolean) => Promise<void>;
};

const SocialContext = createContext<SocialContextValue | null>(null);

const SYNC_DEBOUNCE_MS = 3000;
const REQUEST_TIMEOUT_MS = 15_000;

function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/** Norwegian message for a failed request. */
export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof AuthError) return e.message;
  if (e instanceof ApiError) return fallback;
  // fetch rejects with TypeError when offline and AbortError on our timeout; anything else
  // (for example the Keychain refusing to store tokens) is not a network problem.
  if (e instanceof TypeError || (e instanceof Error && e.name === "AbortError")) {
    return "Fikk ikke kontakt med serveren. Prøv igjen når du er på nett.";
  }
  return "Noe gikk galt. Prøv igjen.";
}

export function SocialProvider({ children }: { children: ReactNode }) {
  const { data } = useAppData();
  const [status, setStatus] = useState<SocialStatus>(HEALTH_API_URL ? "loading" : "unconfigured");
  const [me, setMe] = useState<Me | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [challenges, setChallenges] = useState<Challenge[] | null>(null);
  const [syncFailed, setSyncFailed] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const tokens = useRef<Tokens | null>(null);
  /** Bumped on sign-in and sign-out so answers for an old session are ignored. */
  const generation = useRef(0);
  const dataRef = useRef<AppData | null>(data);
  const lastSynced = useRef<{ data: AppData; today: string } | null>(null);
  const syncChain = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const resetToSignedOut = useCallback(() => {
    generation.current++;
    tokens.current = null;
    lastSynced.current = null;
    setStatus("signedOut");
    setMe(null);
    setStats(null);
    setLeaderboard(null);
    setChallenges(null);
    setSyncFailed(false);
    setLoadFailed(false);
  }, []);

  const api = useMemo(
    () =>
      HEALTH_API_URL
        ? createHealthApi({
            baseUrl: HEALTH_API_URL,
            fetch: fetchWithTimeout,
            getTokens: () => tokens.current,
            saveTokens: async (t) => {
              tokens.current = t;
              await saveTokens(t).catch(() => undefined);
            },
            onAuthLost: () => {
              void clearSession().catch(() => undefined);
              resetToSignedOut();
            },
          })
        : null,
    [resetToSignedOut],
  );

  /** Uploads the local log unless this exact log was already uploaded today. Never throws. */
  const doSync = useCallback(async () => {
    const d = dataRef.current;
    if (!api || !tokens.current || !d) return;
    const today = dayKey(new Date());
    if (lastSynced.current?.data === d && lastSynced.current.today === today) return;
    const gen = generation.current;
    try {
      const res = await api.sync(buildSyncPayload(d, new Date(), await trackedSince()));
      if (gen !== generation.current) return;
      lastSynced.current = { data: d, today };
      setStats(res.stats);
      setSyncFailed(false);
    } catch {
      if (gen === generation.current) setSyncFailed(true);
    }
  }, [api]);

  /** Runs uploads one at a time; a call made during an upload runs after it with the newest data. */
  const syncNow = useCallback(() => {
    const run = syncChain.current.then(doSync);
    syncChain.current = run;
    return run;
  }, [doSync]);

  const loadSocial = useCallback(async () => {
    if (!api || !tokens.current) return;
    const gen = generation.current;
    const today = dayKey(new Date());
    try {
      const [mine, board, list] = await Promise.all([api.me(today), api.leaderboard(today), api.challenges(today)]);
      if (gen !== generation.current) return;
      setMe(mine.user);
      setStats(mine.stats);
      setLeaderboard(board);
      setChallenges(list.challenges);
      setLoadFailed(false);
      void saveMe(mine.user).catch(() => undefined);
    } catch {
      if (gen === generation.current) setLoadFailed(true);
    }
  }, [api]);

  const refresh = useCallback(async () => {
    await syncNow();
    await loadSocial();
  }, [syncNow, loadSocial]);

  // Restore a saved session.
  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    loadSession()
      .then((saved) => {
        if (cancelled) return;
        if (!saved) {
          setStatus("signedOut");
          return;
        }
        tokens.current = saved.tokens;
        setMe(saved.me);
        setStatus("signedIn");
        void refresh();
      })
      .catch(() => {
        if (!cancelled) setStatus("signedOut");
      });
    return () => {
      cancelled = true;
    };
  }, [api, refresh]);

  // Upload a few seconds after the local log changes.
  useEffect(() => {
    if (status !== "signedIn" || !data) return;
    const timer = setTimeout(() => void syncNow(), SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [data, status, syncNow]);

  // Catch up when the app returns to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && tokens.current) void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const startSession = useCallback(
    async (t: Tokens, user: Me) => {
      await saveTokens(t);
      await saveMe(user).catch(() => undefined);
      generation.current++;
      lastSynced.current = null;
      tokens.current = t;
      setMe(user);
      setStats(null);
      setLeaderboard(null);
      setChallenges(null);
      setSyncFailed(false);
      setLoadFailed(false);
      setStatus("signedIn");
      void refresh();
    },
    [refresh],
  );

  const signIn = useCallback(
    async (opts?: { signUp?: boolean }) => {
      if (!api || signingIn) return;
      setAuthError(null);
      setSigningIn(true);
      try {
        const grant = await authorizeWithAuthKit(api, !!opts?.signUp);
        if (!grant) return;
        const res = await api.exchangeCode(grant.code, grant.verifier);
        await startSession({ accessToken: res.accessToken, refreshToken: res.refreshToken }, res.user);
      } catch (e) {
        setAuthError(errorMessage(e, "Innloggingen feilet. Prøv igjen."));
      } finally {
        setSigningIn(false);
      }
    },
    [api, signingIn, startSession],
  );

  const devSignIn = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!api || !DEV_LOGIN_ENABLED || !trimmed) return;
      setAuthError(null);
      setSigningIn(true);
      const t: Tokens = { accessToken: `dev:${trimmed}`, refreshToken: null };
      try {
        tokens.current = t;
        const res = await api.me(dayKey(new Date()));
        await startSession(t, res.user);
      } catch (e) {
        tokens.current = null;
        setAuthError(
          errorMessage(e, "Dev-innloggingen ble avvist. Kjører dev-serveren med HEALTH_DEV_AUTH=1?"),
        );
      } finally {
        setSigningIn(false);
      }
    },
    [api, startSession],
  );

  const signOut = useCallback(async () => {
    await clearSession().catch(() => undefined);
    resetToSignedOut();
  }, [resetToSignedOut]);

  const updateDisplayName = useCallback(
    async (name: string) => {
      if (!api) return;
      const { user } = await api.updateMe(name.trim());
      setMe(user);
      void saveMe(user).catch(() => undefined);
      void loadSocial();
    },
    [api, loadSocial],
  );

  const createChallenge = useCallback(
    async (input: NewChallenge) => {
      if (!api) return;
      await api.createChallenge(input);
      void loadSocial();
    },
    [api, loadSocial],
  );

  const respond = useCallback(
    async (id: string, accept: boolean) => {
      if (!api) return;
      await api.respond(id, accept, dayKey(new Date()));
      await loadSocial();
    },
    [api, loadSocial],
  );

  const value = useMemo<SocialContextValue>(
    () => ({
      status,
      devLoginEnabled: DEV_LOGIN_ENABLED,
      me,
      stats,
      leaderboard,
      challenges,
      syncFailed,
      loadFailed,
      signingIn,
      authError,
      signIn,
      devSignIn,
      signOut,
      refresh,
      loadSocial,
      updateDisplayName,
      createChallenge,
      respond,
    }),
    [
      status,
      me,
      stats,
      leaderboard,
      challenges,
      syncFailed,
      loadFailed,
      signingIn,
      authError,
      signIn,
      devSignIn,
      signOut,
      refresh,
      loadSocial,
      updateDisplayName,
      createChallenge,
      respond,
    ],
  );

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

export function useSocial(): SocialContextValue {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error("useSocial must be used inside SocialProvider");
  return ctx;
}
