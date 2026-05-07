import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { pickLoadingLines } from "../lib/delight";

export function LoadingHint() {
  const reduceMotion = useReducedMotion();
  const lines = useMemo(() => pickLoadingLines(3), []);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (reduceMotion || lines.length < 2) return;
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % lines.length);
    }, 2200);
    return () => window.clearInterval(t);
  }, [reduceMotion, lines.length]);

  return (
    <div className="loading-hint" role="status" aria-live="polite">
      <div className="loading-hint__bar" aria-hidden />
      <div className="loading-hint__text-wrap">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={lines[idx]}
            className="loading-hint__text"
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -3 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            {lines[idx]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
