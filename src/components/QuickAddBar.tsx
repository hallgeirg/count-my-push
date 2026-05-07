import { motion, useReducedMotion } from "framer-motion";

type Props = {
  amounts: number[];
  disabled?: boolean;
  onAdd: (n: number) => void;
};

export function QuickAddBar({ amounts, disabled, onAdd }: Props) {
  const reduceMotion = useReducedMotion();
  return (
    <div
      aria-busy={disabled || undefined}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${amounts.length}, minmax(0, 1fr))`,
        gap: 10,
      }}
    >
      {amounts.map((n) => (
        <motion.button
          key={n}
          type="button"
          className="quick-add-tap"
          disabled={disabled}
          onClick={() => onAdd(n)}
          whileTap={
            reduceMotion || disabled ? undefined : { scale: 0.96, opacity: 0.88 }
          }
          transition={{ duration: 0.08, ease: [0.25, 1, 0.5, 1] }}
          style={{
            minHeight: 52,
            borderRadius: "var(--radius-pill)",
            border: "1px solid var(--line)",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
            color: "var(--text)",
            fontFamily: "var(--font-display)",
            fontWeight: 750,
            letterSpacing: "-0.02em",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.55 : 1,
          }}
          aria-label={`Log ${n} pushups`}
        >
          +{n}
        </motion.button>
      ))}
    </div>
  );
}
