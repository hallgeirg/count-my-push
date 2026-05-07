const successLines = [
  "In the books. Next set when you’re ready.",
  "That’s the one. Stack another when it feels right.",
  "Logged — legs still burning? Good.",
  "Boom. Momentum doesn’t ask permission.",
  "Rep secured. You’re building the habit.",
  "Nice. Small wins, loud results.",
];

const milestoneLines = [
  "Daily goal: done. You showed up.",
  "Target hit for today — that’s discipline.",
  "You crossed the line. Rest or go again; you earned it.",
  "Today’s mission: complete. Respect.",
];

export const loadingLines = [
  "Syncing your streak…",
  "Grabbing today’s numbers…",
  "Almost there — flex once while you wait.",
];

export const emptyRecentLines = [
  "Hit a quick-add — your first line on the board.",
  "Zero logs yet. One tap and you’re rolling.",
  "Empty list, full potential. Tap +10 or +20.",
  "First set’s the hardest. The button’s waiting.",
];

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
