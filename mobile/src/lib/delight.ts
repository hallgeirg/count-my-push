const successLines = [
  "Ført opp. Neste sett når du er klar.",
  "Der satt den. Stopp mens du har litt igjen.",
  "Logget – små sett, store resultater.",
  "Bra. Vanen bygges én runde av gangen.",
  "Enda et hakk på tavla.",
  "Momentum. Fortsett i ditt eget tempo.",
];

const milestoneLines = [
  "Dagens mål: nådd. Du møtte opp.",
  "Ringen er full. Det er disiplin.",
  "Dagens oppdrag fullført. Respekt.",
  "Mål nådd – hvil eller ta en til, du har fortjent det.",
];

const pick = (lines: string[]) => lines[Math.floor(Math.random() * lines.length)]!;

export const randomSuccessLine = () => pick(successLines);
export const randomMilestoneLine = () => pick(milestoneLines);
