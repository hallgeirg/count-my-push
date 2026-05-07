import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useState } from "react";
import type { AppState } from "../types";

type Props = {
  open: boolean;
  onClose: () => void;
  goals: AppState["goals"];
  quickAdd: number[];
  onSave: (payload: {
    goals: Partial<AppState["goals"]>;
    quickAdd: number[];
  }) => Promise<void>;
};

export function SettingsSheet({
  open,
  onClose,
  goals,
  quickAdd,
  onSave,
}: Props) {
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const [daily, setDaily] = useState(String(goals.dailyGoal));
  const [weekly, setWeekly] = useState(String(goals.weeklyGoal));
  const [monthly, setMonthly] = useState(String(goals.monthlyGoal));
  const [a, setA] = useState(String(quickAdd[0] ?? 10));
  const [b, setB] = useState(String(quickAdd[1] ?? 20));
  const [c, setC] = useState(String(quickAdd[2] ?? 30));
  const [d, setD] = useState(quickAdd[3] != null ? String(quickAdd[3]) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDaily(String(goals.dailyGoal));
    setWeekly(String(goals.weeklyGoal));
    setMonthly(String(goals.monthlyGoal));
    setA(String(quickAdd[0] ?? 10));
    setB(String(quickAdd[1] ?? 20));
    setC(String(quickAdd[2] ?? 30));
    setD(quickAdd[3] != null ? String(quickAdd[3]) : "");
    setError(null);
  }, [open, goals, quickAdd]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const dailyGoal = Number(daily);
      const weeklyGoal = Number(weekly);
      const monthlyGoal = Number(monthly);
      if (
        !Number.isFinite(dailyGoal) ||
        !Number.isFinite(weeklyGoal) ||
        !Number.isFinite(monthlyGoal)
      ) {
        throw new Error("Goals must be numbers.");
      }
      if (dailyGoal < 1 || weeklyGoal < 1 || monthlyGoal < 1) {
        throw new Error("Goals must be at least 1.");
      }

      const nums = [a, b, c, d]
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) => Number(s));

      if (nums.length < 2) throw new Error("Add at least two quick amounts.");
      if (nums.some((n) => !Number.isFinite(n) || n < 1 || n > 500)) {
        throw new Error("Quick amounts must be between 1 and 500.");
      }
      if (nums.length > 4) throw new Error("Too many quick amounts.");

      await onSave({
        goals: { dailyGoal, weeklyGoal, monthlyGoal },
        quickAdd: nums.map((n) => Math.floor(n)),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
          }}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
        >
          <button
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            style={{
              position: "absolute",
              inset: 0,
              border: 0,
              padding: 0,
              margin: 0,
              background: "rgba(0,0,0,0.55)",
              cursor: "pointer",
            }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={reduceMotion ? false : { y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduceMotion ? undefined : { y: 18, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              maxHeight: "min(88vh, 720px)",
              overflow: "auto",
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              border: "1px solid var(--line)",
              background:
                "linear-gradient(180deg, rgba(18,18,22,0.98), rgba(10,10,12,0.98))",
              padding: "18px 18px calc(18px + env(safe-area-inset-bottom))",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div id={titleId} style={{ fontSize: 16, fontWeight: 800 }}>
                Settings
              </div>
              <button
                type="button"
                onClick={onClose}
                style={{
                  borderRadius: 12,
                  border: "1px solid var(--line)",
                  background: "transparent",
                  color: "var(--muted)",
                  padding: "10px 12px",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>

            <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.45 }}>
              Tune goals and your quick-add buttons. Keep it simple — fewer taps, more reps.
            </div>

            <div style={{ height: 14 }} />

            <div style={{ display: "grid", gap: 10 }}>
              <Field label="Daily goal" value={daily} onChange={setDaily} />
              <Field label="Weekly goal" value={weekly} onChange={setWeekly} />
              <Field label="Monthly goal" value={monthly} onChange={setMonthly} />
            </div>

            <div style={{ height: 16 }} />
            <div style={{ fontSize: 12, color: "var(--muted)", letterSpacing: "0.06em" }}>
              QUICK ADD
            </div>
            <div style={{ height: 10 }} />
            <div style={{ display: "grid", gap: 10 }}>
              <Field label="Amount 1" value={a} onChange={setA} inputMode="numeric" />
              <Field label="Amount 2" value={b} onChange={setB} inputMode="numeric" />
              <Field label="Amount 3" value={c} onChange={setC} inputMode="numeric" />
              <Field
                label="Amount 4 (optional)"
                value={d}
                onChange={setD}
                inputMode="numeric"
              />
            </div>

            {error ? (
              <div style={{ marginTop: 12, color: "var(--danger)", fontSize: 13 }}>
                {error}
              </div>
            ) : null}

            <div style={{ height: 16 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={saving}
                style={{
                  minHeight: 48,
                  borderRadius: "var(--radius-pill)",
                  border: "1px solid transparent",
                  background: "var(--text)",
                  color: "#0a0a0b",
                  fontWeight: 850,
                  cursor: saving ? "wait" : "pointer",
                }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                style={{
                  minHeight: 48,
                  borderRadius: "var(--radius-pill)",
                  border: "1px solid var(--line)",
                  background: "rgba(255,255,255,0.04)",
                  color: "var(--text)",
                  fontWeight: 750,
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Field({
  label,
  value,
  onChange,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: "numeric" | "text";
}) {
  return (
    <label className="settings-field" style={{ display: "grid", gap: 6 }}>
      <span style={{ color: "var(--muted)", fontSize: 12 }}>{label}</span>
      <input
        value={value}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        style={{
          borderRadius: 14,
          border: "1px solid var(--line)",
          background: "rgba(255,255,255,0.04)",
          padding: "12px 12px",
        }}
      />
    </label>
  );
}
