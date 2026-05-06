const successLines = [
  "Logged. Keep stacking.",
  "Nice set — momentum builds.",
  "There it is. One more rep in the bank.",
  "Solid. Stay consistent.",
];

const milestoneLines = [
  "Daily goal crushed.",
  "You hit today’s target.",
  "Full send — daily goal done.",
];

export function randomSuccessLine(): string {
  return successLines[Math.floor(Math.random() * successLines.length)]!;
}

export function randomMilestoneLine(): string {
  return milestoneLines[Math.floor(Math.random() * milestoneLines.length)]!;
}
