import { useMemo } from "react";
import { randomLoadingLine } from "../lib/delight";

export function LoadingHint() {
  const line = useMemo(() => randomLoadingLine(), []);

  return (
    <div className="loading-hint" role="status" aria-live="polite">
      <div className="loading-hint__bar" aria-hidden />
      <p className="loading-hint__text">{line}</p>
    </div>
  );
}
