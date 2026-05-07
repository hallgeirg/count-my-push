import { motion, useReducedMotion } from "framer-motion";

type Props = {
  total: number;
  goal: number;
  pulseKey: number;
};

export function DailyRing({ total, goal, pulseKey }: Props) {
  const reduceMotion = useReducedMotion();
  const ratio = goal > 0 ? Math.min(1, total / goal) : 0;
  const size = 220;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        marginInline: "auto",
      }}
    >
        <motion.div
        key={pulseKey}
        initial={reduceMotion ? false : { scale: 1, opacity: 0.88 }}
        animate={reduceMotion ? undefined : { scale: [1, 1.035, 1], opacity: [0.88, 1, 0.94] }}
        transition={
          reduceMotion
            ? undefined
            : { duration: 0.38, ease: [0.22, 1, 0.36, 1] }
        }
        style={{
          position: "absolute",
          inset: "-18%",
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 50% 45%, rgba(200,245,66,0.35), transparent 62%)",
          filter: "blur(18px)",
          pointerEvents: "none",
        }}
      />
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Daily progress ${total} of ${goal} pushups`}
        style={{ position: "relative", zIndex: 1 }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--line)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduceMotion ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - ratio) }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: 0.4, ease: [0.25, 1, 0.5, 1] }
          }
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            filter: "drop-shadow(0 0 10px rgba(200,245,66,0.35))",
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          zIndex: 2,
          pointerEvents: "none",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 44,
              fontWeight: 750,
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}
          >
            <motion.span
              key={total}
              initial={reduceMotion ? false : { scale: 1.12, opacity: 0.75 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                duration: reduceMotion ? 0 : 0.18,
                ease: [0.22, 1, 0.36, 1],
              }}
              style={{ display: "inline-block", transformOrigin: "50% 60%" }}
            >
              {total}
            </motion.span>
            <span style={{ color: "var(--muted)", fontWeight: 600, fontSize: 18 }}>
              {" "}
              / {goal}
            </span>
          </div>
          <div
            style={{
              marginTop: 10,
              color: "var(--muted)",
              fontSize: 13,
              letterSpacing: "0.02em",
            }}
          >
            Today
          </div>
        </div>
      </div>
    </div>
  );
}
