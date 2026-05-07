import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { randomEmptyRecentLine } from "../lib/delight";

type Entry = { id: number; count: number; performedAt: string };

type Props = {
  entries: Entry[];
  busyId?: number | null;
  onDelete: (id: number) => void;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function RecentEntries({ entries, busyId, onDelete }: Props) {
  const reduceMotion = useReducedMotion();
  const emptyLine = useMemo(() => randomEmptyRecentLine(), []);

  return (
    <div style={{ marginTop: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <div style={{ color: "var(--muted)", fontSize: 12, letterSpacing: "0.06em" }}>
          Recent
        </div>
      </div>

      {entries.length === 0 ? (
        <motion.div
          className="empty-recent-card"
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          {emptyLine}
        </motion.div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {entries.slice(0, 8).map((e) => (
            <motion.div
              key={e.id}
              layout={!reduceMotion}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, ease: [0.25, 1, 0.5, 1] }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 12px",
                borderRadius: 16,
                border: "1px solid var(--line)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div>
                <div style={{ fontWeight: 750 }}>+{e.count}</div>
                <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>
                  {formatTime(e.performedAt)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDelete(e.id)}
                disabled={busyId === e.id}
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  borderRadius: 12,
                  border: "1px solid var(--line)",
                  background: "transparent",
                  color: "var(--muted)",
                  padding: "10px 14px",
                  cursor: busyId === e.id ? "wait" : "pointer",
                }}
                aria-label={`Delete log of ${e.count} pushups`}
              >
                Undo
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
