# Make More Health – iPhone-app

Make More Health er Expo (React Native)-versjonen av Count My Push, med et innebygd treningsprogram. Alt lagres lokalt på telefonen (SQLite key-value), så appen virker uten nett og uten Vercel/Neon-backenden.

## Programmet

| Dag | Økt | Daglige pushups |
|-----|-----|-----------------|
| Mandag | Push-økt: 3 × 5 nesten tomt (1 rep igjen) | Hviler |
| Tirsdag | Situps | Ja |
| Onsdag | Knebøy-økt mot dragon squat | Ja |
| Torsdag | Situps | Ja |
| Fredag | Knebøy-økt | Ja |
| Lørdag | Situps | Ja |
| Søndag | Hvile | Ja |

- **Daglige pushups** starter på 10 per dag, med 2–3 reps igjen i hvert sett. Hver ny uke: nådd målet ≥ 5 av 6 dager → +2 (+4 om det mest var lett), en helt tom dag → hold, under halvparten → −2 (minst 5).
- **Push-økt** er alltid 3 × 5. Når 3 × 5 sitter med litt igjen, får du neste variant (benk → vanlige → diamant → decline → pseudo-planche → archer → … → ettarms).
- **Knebøy** går knebøy → splittknebøy → bulgarsk → pistol med støtte → pistol til benk → pistol → dragon squat med støtte → dragon squat, med dobbel progresjon (flere reps, så neste variant).
- **Situps**: situps → sakte nedfiring → V-ups.
- Etter hver økt velger du *Lett / Litt igjen / Helt tomt*. Det styrer neste økt. Variantene og ukeplanen ligger i `src/program/catalog.ts`; reglene i `src/program/progression.ts`.

## Kjør på iPhone

```bash
cd mobile
npm install
npx expo start --tunnel   # skann QR-koden med Expo Go-appen på iPhone
```

Egen app på hjemskjermen / TestFlight krever Apple Developer-konto og EAS:

```bash
npx eas-cli@latest build --platform ios --profile preview
```

Bundle-ID er satt til `no.hallgeirg.countmypush` i `app.json` – endre den om du vil bruke en annen.

## Kommandoer

| Kommando | Hva |
|----------|-----|
| `npm test` | Tester for progresjon og ukeplan (Vitest) |
| `npm run typecheck` | TypeScript |
| `npx expo export --platform ios` | Full iOS-bundle |
| `npx expo-doctor` | Sjekker avhengigheter og konfigurasjon |

## Design

Appen følger Make Mores designsystem (kundeportalens `DESIGN.md` og Make More Brand Guide): lyse arbeidsflater, Action Blue `#0051FF` for handling, én kobolt brandflate på I dag, Mona Sans og JetBrains Mono (begge SIL OFL 1.1, lisensene ligger i `assets/fonts/`). Tokenene ligger i `src/theme.ts`.
