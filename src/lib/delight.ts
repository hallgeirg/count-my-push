const successLines = [
  "In the books. Next set when you’re ready.",
  "That’s the one. Stack another when it feels right.",
  "Logged — legs still burning? Good.",
  "Boom. Momentum doesn’t ask permission.",
  "Rep secured. You’re building the habit.",
  "Nice. Small wins, loud results.",
  "There it is — one more notch on the board.",
  "Chef’s kiss. That rep counted.",
  "You’re on a roll. Keep the dial turned up.",
  "Tap, done, next. Love the efficiency.",
];

const milestoneLines = [
  "Daily goal: done. You showed up.",
  "Target hit for today — that’s discipline.",
  "You crossed the line. Rest or go again; you earned it.",
  "Today’s mission: complete. Respect.",
  "Ring full. You ate that goal alive.",
  "Daily win locked. Walk tall for five seconds.",
];

export const loadingLines = [
  "Syncing your streak…",
  "Grabbing today’s numbers…",
  "Almost there — flex once while you wait.",
  "Warming up the counter…",
  "Pulling your reps from the cloud…",
  "One sec — dusting off the goal ring…",
];

export const emptyRecentLines = [
  "Hit a quick-add — your first line on the board.",
  "Zero logs yet. One tap and you’re rolling.",
  "Empty list, full potential. Tap +10 or +20.",
  "First set’s the hardest. The button’s waiting.",
  "No reps logged — the quick-add row is begging for a tap.",
  "Blank slate. Make the next minute count.",
];

/** Pick up to `n` distinct lines for rotating loaders. */
export function pickLoadingLines(n: number): string[] {
  const pool = [...loadingLines];
  const out: string[] = [];
  const count = Math.min(n, pool.length);
  for (let i = 0; i < count; i++) {
    const j = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(j, 1)[0]!);
  }
  return out.length ? out : [loadingLines[0]!];
}

export function randomSuccessLine(): string {
  return successLines[Math.floor(Math.random() * successLines.length)]!;
}

export function randomMilestoneLine(): string {
  return milestoneLines[Math.floor(Math.random() * milestoneLines.length)]!;
}

export function randomLoadingLine(): string {
  return loadingLines[Math.floor(Math.random() * loadingLines.length)]!;
}

export function randomEmptyRecentLine(): string {
  return emptyRecentLines[Math.floor(Math.random() * emptyRecentLines.length)]!;
}
