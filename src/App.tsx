import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DailyRing } from "./components/DailyRing";
import { FeedbackToast } from "./components/FeedbackToast";
import { LinearGoal } from "./components/LinearGoal";
import { LoadingHint } from "./components/LoadingHint";
import { QuickAddBar } from "./components/QuickAddBar";
import { RecentEntries } from "./components/RecentEntries";
import { SettingsSheet } from "./components/SettingsSheet";
import {
  deleteEntry,
  fetchState,
  patchGoals,
  patchSettings,
  postEntry,
} from "./lib/api";
import { randomMilestoneLine, randomSuccessLine } from "./lib/delight";
import type { AppState } from "./types";

function calendarDayKeyInTimeZone(tz: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function App() {
  const reduceMotion = useReducedMotion();
  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );

  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backgroundError, setBackgroundError] = useState<string | null>(null);
  const displayedError = error ?? backgroundError;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<"success" | "milestone">(
    "success",
  );
  const [pulseKey, setPulseKey] = useState(0);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const toastHideRef = useRef<number | null>(null);
  const optimisticIdRef = useRef(-1);
  const lastCalendarDayRef = useRef<string | null>(null);
  /** Daily total including taps not yet rendered, so rapid taps see each other. */
  const dailyRef = useRef<number | null>(null);

  const dashItem = useMemo(
    () => ({
      hidden: reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 },
      visible: {
        opacity: 1,
        y: 0,
        transition: {
          duration: reduceMotion ? 0 : 0.16,
          ease: [0.22, 1, 0.36, 1] as const,
        },
      },
    }),
    [reduceMotion],
  );

  const refresh = useCallback(async () => {
    const s = await fetchState(timeZone);
    setState(s);
    lastCalendarDayRef.current = calendarDayKeyInTimeZone(timeZone);
  }, [timeZone]);

  const refreshInBackground = useCallback(() => {
    void refresh().then(() => setBackgroundError(null)).catch((e) => {
      setBackgroundError(
        e instanceof Error
          ? e.message
          : "Couldn’t refresh totals. Check your connection and try again.",
      );
    });
  }, [refresh]);

  const loadState = useCallback(async () => {
    setLoading(true);
    setError(null);
    setBackgroundError(null);
    try {
      const s = await fetchState(timeZone);
      setState(s);
      lastCalendarDayRef.current = calendarDayKeyInTimeZone(timeZone);
    } catch (e) {
      setState(null);
      setError(
        e instanceof Error
          ? e.message
          : "Couldn’t reach the server. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [timeZone]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const next = calendarDayKeyInTimeZone(timeZone);
      if (lastCalendarDayRef.current !== next) {
        refreshInBackground();
      }
    }, 60_000);
    return () => window.clearInterval(id);
  }, [timeZone, refreshInBackground]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible") refreshInBackground();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [refreshInBackground]);

  useEffect(() => {
    dailyRef.current = state?.totals.daily ?? null;
  }, [state]);

  useEffect(() => {
    return () => {
      if (toastHideRef.current != null) window.clearTimeout(toastHideRef.current);
    };
  }, []);

  function showToast(message: string, variant: "success" | "milestone") {
    if (toastHideRef.current != null) window.clearTimeout(toastHideRef.current);
    setToastVariant(variant);
    setToast(message);
    const ms = variant === "milestone" ? 2400 : 1800;
    toastHideRef.current = window.setTimeout(() => {
      setToast(null);
      toastHideRef.current = null;
    }, ms);
  }

  async function onAdd(n: number) {
    if (!state || n < 1) return;
    setError(null);
    const optimisticId = optimisticIdRef.current--;
    const optimisticTime = new Date().toISOString();
    const prevDaily = dailyRef.current ?? state.totals.daily;
    dailyRef.current = prevDaily + n;
    const shouldCelebrateMilestone =
      prevDaily < state.goals.dailyGoal &&
      prevDaily + n >= state.goals.dailyGoal;

    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        totals: {
          daily: prev.totals.daily + n,
          weekly: prev.totals.weekly + n,
          monthly: prev.totals.monthly + n,
        },
        recentEntries: [
          { id: optimisticId, count: n, performedAt: optimisticTime },
          ...prev.recentEntries,
        ].slice(0, 25),
      };
    });
    setPulseKey((k) => k + 1);
    showToast(
      shouldCelebrateMilestone ? randomMilestoneLine() : randomSuccessLine(),
      shouldCelebrateMilestone ? "milestone" : "success",
    );

    try {
      const { entry } = await postEntry(n);
      setState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          recentEntries: prev.recentEntries.map((e) =>
            e.id === optimisticId ? entry : e,
          ),
        };
      });
      try {
        await refresh();
      } catch (refreshErr) {
        setError(
          refreshErr instanceof Error
            ? refreshErr.message
            : "Saved, but couldn’t refresh totals. Reopen the app or try again.",
        );
      }
    } catch (e) {
      // Roll back optimistic set if the backend call fails.
      setState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          totals: {
            daily: Math.max(0, prev.totals.daily - n),
            weekly: Math.max(0, prev.totals.weekly - n),
            monthly: Math.max(0, prev.totals.monthly - n),
          },
          recentEntries: prev.recentEntries.filter((r) => r.id !== optimisticId),
        };
      });
      setError(e instanceof Error ? e.message : "Could not log set.");
    }
  }

  async function onDelete(id: number) {
    if (id < 0) {
      setState((prev) => {
        if (!prev) return prev;
        const target = prev.recentEntries.find((e) => e.id === id);
        if (!target) return prev;
        return {
          ...prev,
          totals: {
            daily: Math.max(0, prev.totals.daily - target.count),
            weekly: Math.max(0, prev.totals.weekly - target.count),
            monthly: Math.max(0, prev.totals.monthly - target.count),
          },
          recentEntries: prev.recentEntries.filter((e) => e.id !== id),
        };
      });
      return;
    }

    setDeletingId(id);
    setError(null);
    try {
      await deleteEntry(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not undo.");
    } finally {
      setDeletingId(null);
    }
  }

  async function onSaveSettings(payload: {
    goals: Partial<AppState["goals"]>;
    quickAdd: number[];
  }) {
    await patchGoals(payload.goals);
    await patchSettings(payload.quickAdd);
    await refresh();
  }

  return (
    <main
      style={{
        minHeight: "100%",
        maxWidth: 520,
        marginInline: "auto",
        padding: "calc(18px + env(safe-area-inset-top)) 18px calc(22px + env(safe-area-inset-bottom))",
      }}
    >
      <motion.header
        initial={reduceMotion ? false : { opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div>
          <div className="app-title" style={{ fontSize: 19 }}>
            Count My Push
          </div>
          <div
            className="app-tagline"
            style={{ color: "var(--muted)", fontSize: 13, marginTop: 6, lineHeight: 1.35 }}
          >
            One tap to log. Let the ring do the cheering.
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          style={{
            minWidth: 44,
            minHeight: 44,
            borderRadius: 14,
            border: "1px solid var(--line)",
            background: "rgba(255,255,255,0.04)",
            color: "var(--text)",
            cursor: "pointer",
            fontWeight: 800,
            fontSize: 20,
            lineHeight: 1,
            display: "grid",
            placeItems: "center",
          }}
          aria-label="Open settings"
        >
          <span aria-hidden>⚙</span>
        </button>
      </motion.header>

      {loading ? <LoadingHint /> : null}

      {displayedError ? (
        <div
          role="alert"
          className="error-banner"
          style={{
            marginTop: 14,
            border: "1px solid rgba(255,92,92,0.35)",
            background: "rgba(255,92,92,0.08)",
            color: "var(--text)",
            borderRadius: 16,
            padding: 12,
            lineHeight: 1.4,
          }}
        >
          <span className="error-banner__icon" aria-hidden>
            !
          </span>
          <div className="error-banner__body">
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Something slipped.</div>
            <div style={{ color: "rgba(242,243,239,0.88)" }}>{displayedError}</div>
            <div
              style={{
                marginTop: 12,
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              {!state ? (
                <button
                  type="button"
                  onClick={() => void loadState()}
                  disabled={loading}
                  style={{
                    minHeight: 44,
                    padding: "0 16px",
                    borderRadius: "var(--radius-pill)",
                    border: "1px solid rgba(255,92,92,0.45)",
                    background: "rgba(255,255,255,0.08)",
                    color: "var(--text)",
                    fontWeight: 700,
                    cursor: loading ? "wait" : "pointer",
                  }}
                >
                  Try again
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => { setError(null); setBackgroundError(null); }}
                style={{
                  minHeight: 44,
                  padding: "0 16px",
                  borderRadius: "var(--radius-pill)",
                  border: "1px solid var(--line)",
                  background: "transparent",
                  color: "var(--muted)",
                  fontWeight: 650,
                  cursor: "pointer",
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {state ? (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: {
              transition: reduceMotion
                ? { duration: 0 }
                : { staggerChildren: 0.032, delayChildren: 0.012 },
            },
          }}
          style={{ display: "flex", flexDirection: "column", width: "100%" }}
        >
          <motion.div variants={dashItem} style={{ paddingTop: 10 }}>
            <DailyRing
              total={state.totals.daily}
              goal={state.goals.dailyGoal}
              pulseKey={pulseKey}
            />
          </motion.div>

          <motion.div
            variants={dashItem}
            className="goals-panel"
            style={{
              marginTop: 10,
              borderRadius: "var(--radius-card)",
              border: "1px solid var(--line)",
              background: "rgba(255,255,255,0.03)",
              padding: "14px 14px",
            }}
          >
            <LinearGoal
              label="THIS WEEK"
              total={state.totals.weekly}
              goal={state.goals.weeklyGoal}
            />
            <div style={{ height: 6 }} />
            <LinearGoal
              label="THIS MONTH"
              total={state.totals.monthly}
              goal={state.goals.monthlyGoal}
            />
          </motion.div>

          <motion.div variants={dashItem} style={{ marginTop: 14 }}>
            <QuickAddBar amounts={state.quickAdd} onAdd={onAdd} />
          </motion.div>

          <motion.div variants={dashItem} style={{ width: "100%" }}>
            <RecentEntries
              entries={state.recentEntries}
              busyId={deletingId}
              onDelete={onDelete}
            />
          </motion.div>
        </motion.div>
      ) : null}

      {state ? (
        <SettingsSheet
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          goals={state.goals}
          quickAdd={state.quickAdd}
          onSave={onSaveSettings}
        />
      ) : null}

      <FeedbackToast message={toast} variant={toastVariant} />
    </main>
  );
}
