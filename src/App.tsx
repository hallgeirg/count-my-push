import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DailyRing } from "./components/DailyRing";
import { FeedbackToast } from "./components/FeedbackToast";
import { LinearGoal } from "./components/LinearGoal";
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

export default function App() {
  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );

  const [state, setState] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<"success" | "milestone">(
    "success",
  );
  const [pulseKey, setPulseKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const toastHideRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const s = await fetchState(timeZone);
    setState(s);
  }, [timeZone]);

  const loadState = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await fetchState(timeZone);
      setState(s);
    } catch (e) {
      setState(null);
      setError(e instanceof Error ? e.message : "Could not load data.");
    } finally {
      setLoading(false);
    }
  }, [timeZone]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

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
    if (!state) return;
    setBusy(true);
    setError(null);
    const beforeDaily = state.totals.daily;
    const goal = state.goals.dailyGoal;
    try {
      await postEntry(n);
      const s = await fetchState(timeZone);
      setState(s);
      setPulseKey((k) => k + 1);

      const afterDaily = s.totals.daily;
      if (beforeDaily < goal && afterDaily >= goal) {
        showToast(randomMilestoneLine(), "milestone");
      } else {
        showToast(randomSuccessLine(), "success");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not log set.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: number) {
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
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 850, letterSpacing: "-0.03em" }}>
            Count My Push
          </div>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6, lineHeight: 1.35 }}>
            Tap a set. Track the week. Keep it stupidly simple.
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
          }}
          aria-label="Open settings"
        >
          ···
        </button>
      </header>

      {loading ? (
        <div role="status" aria-live="polite" style={{ color: "var(--muted)", marginTop: 18 }}>
          Loading…
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
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
          {error}
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
              onClick={() => setError(null)}
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
      ) : null}

      {state ? (
        <>
          <div style={{ height: 10 }} />
          <DailyRing
            total={state.totals.daily}
            goal={state.goals.dailyGoal}
            pulseKey={pulseKey}
          />

          <div style={{ height: 10 }} />
          <div
            style={{
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
          </div>

          <div style={{ height: 14 }} />
          <QuickAddBar amounts={state.quickAdd} disabled={busy} onAdd={onAdd} />

          <RecentEntries
            entries={state.recentEntries}
            busyId={deletingId}
            onDelete={onDelete}
          />
        </>
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
