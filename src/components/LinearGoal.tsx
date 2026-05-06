import { motion, useReducedMotion } from "framer-motion";

type Props = {
  label: string;
  total: number;
  goal: number;
};

export function LinearGoal({ label, total, goal }: Props) {
  const reduceMotion = useReducedMotion();
  const ratio = goal > 0 ? Math.min(1, total / goal) : 0;
  return (
    <div style={{ paddingBlock: 6 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <div style={{ color: "var(--muted)", fontSize: 12, letterSpacing: "0.06em" }}>
          {label}
        </div>
        <div style={{ fontSize: 13, fontWeight: 650, color: "var(--text)" }}>
          {total}
          <span style={{ color: "var(--muted)", fontWeight: 600 }}> / {goal}</span>
        </div>
      </div>
      <div
        style={{
          height: 3,
          borderRadius: 999,
          background: "var(--line)",
          overflow: "hidden",
        }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={total}
        aria-label={`${label} progress`}
      >
        <motion.div
          initial={reduceMotion ? false : { width: "0%" }}
          animate={{ width: `${ratio * 100}%` }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: 0.45, ease: [0.25, 1, 0.5, 1] }
          }
          style={{
            height: "100%",
            borderRadius: 999,
            background:
              "linear-gradient(90deg, rgba(200,245,66,0.25), var(--accent))",
          }}
        />
      </div>
    </div>
  );
}
