import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type Props = {
  message: string | null;
  variant?: "success" | "milestone";
};

export function FeedbackToast({ message, variant = "success" }: Props) {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          key={message}
          role="status"
          aria-live="polite"
          initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: 6, scale: 0.99 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "fixed",
            left: 14,
            right: 14,
            bottom: "calc(14px + env(safe-area-inset-bottom))",
            zIndex: 40,
            borderRadius: 16,
            border:
              variant === "milestone"
                ? "1px solid rgba(200,245,66,0.35)"
                : "1px solid var(--line)",
            background:
              variant === "milestone"
                ? "rgba(200,245,66,0.12)"
                : "rgba(12,12,14,0.92)",
            backdropFilter: "blur(10px)",
            padding: "12px 14px",
            color: "var(--text)",
            fontSize: 14,
            lineHeight: 1.35,
            fontWeight: variant === "milestone" ? 700 : 600,
            boxShadow:
              variant === "milestone"
                ? "0 18px 60px rgba(200,245,66,0.12)"
                : "0 18px 60px rgba(0,0,0,0.45)",
          }}
        >
          <motion.span
            aria-hidden
            initial={reduceMotion ? false : { scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.95 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            style={{
              marginRight: 8,
              display: "inline-block",
              transformOrigin: "50% 55%",
            }}
          >
            {variant === "milestone" ? "★" : "✓"}
          </motion.span>
          {message}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
