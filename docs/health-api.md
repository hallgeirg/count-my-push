# Make More Health API

The iPhone app (`mobile/`) works offline against local storage. When the user signs in with WorkOS, it uploads its log and uses these endpoints for streaks, the leaderboard and challenges. The original single-user web API (`/api/state`, `/api/entries`, `/api/goals`, `/api/settings`) is unchanged.

All endpoints live under `/api/health/`, take and return JSON, and need `Authorization: Bearer <WorkOS access token>` unless marked *public*. Errors are `{ "error": string }` with 400 (invalid body or query), 401 (missing/invalid token), 403, 404, 405, 409 or 500 (503 when sign-in is not configured). Days are local calendar days `YYYY-MM-DD` sent by the client (`today`), so the server never guesses the user's time zone.

## Auth (WorkOS AuthKit, PKCE)

The app opens AuthKit in the system browser with PKCE and the redirect URI `countmypush://auth/callback`, then sends the code to the backend, which exchanges it with the WorkOS API key. The API key never leaves the server.

| Method | Path | Body | Response |
|---|---|---|---|
| GET *(public)* | `/api/health/auth/config` | – | `{ clientId, redirectUri }`; 503 when WorkOS is not configured |
| POST *(public)* | `/api/health/auth/token` | `{ code, codeVerifier }` | `{ accessToken, refreshToken, user: Me }` |
| POST *(public)* | `/api/health/auth/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` |

Access tokens are verified as WorkOS JWTs against the client's JWKS (`https://api.workos.com/sso/jwks/<clientId>`). The user row is created on first token exchange (display name from WorkOS first name, else the part of the e-mail before `@`).

## Me and sync

`Me = { id, displayName, friendCode }`. E-mail is never returned to other users.

`Stats = { currentStreak, longestStreak, weekTotal, allTimeTotal, activeToday }`

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/api/health/me?today=` | – | `{ user: Me, stats: Stats }` |
| PATCH | `/api/health/me` | `{ displayName }` (1–40 chars, trimmed) | `{ user: Me }` |
| POST | `/api/health/sync` | `{ today, since, entries, sessions }` | `{ stats: Stats }` |

`sync` is a snapshot replace: the server makes the user's entries and sessions with `day >= since` equal to what was sent (upsert by client id, delete the rest in that window). Entries before `since` are untouched. The app sends at most the last 120 days, and `since` never goes back before the day the app was installed on that phone or its oldest local record, so a new phone or a reinstall with an empty log cannot wipe history uploaded earlier. A reinstall also drops Keychain tokens left from the previous install.

- `entries: { id, count (1–500), at (ISO), day }[]` (max 5000)
- `sessions: { id, day, at, kind: "push"|"squat"|"core", levelIndex, sets: number[], effort: "easy"|"good"|"empty" }[]` (max 2000)

## Rules

- **Pushups** = logged entries + reps in `push` sessions.
- **Active day** = at least one entry or one session that day.
- **Current streak** = consecutive active days ending today, or ending yesterday when today has no activity yet. **Longest streak** = longest run ever.
- **Week** = Monday to `today`.

## Leaderboard

`GET /api/health/leaderboard?today=` → `{ from, to, rows: { rank, userId, displayName, total, currentStreak, isMe }[] }`

All Make More Health users, this week's pushups, highest first; ties share a rank and are ordered by streak, then name. Top 50, plus the caller's row if outside.

## Challenges

`Challenge = { id, type, status, startsOn, endsOn, days, target, iAmCreator, me: Side, opponent: Side, winnerUserId, daysLeft }`, `Side = { userId, displayName, total }`.

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/api/health/challenges?today=` | – | `{ challenges: Challenge[] }`, pending first, then active, then the last 20 finished |
| POST | `/api/health/challenges` | `{ friendCode, type: "most_in_period", days (1–31) }` or `{ friendCode, type: "first_to_target", target (10–10000), days (1–60, default 30) }` | `{ challenge }` (status `pending`) |
| POST | `/api/health/challenges/respond` | `{ id, accept: boolean, today }` | `{ challenge }` |

- Only the invited user can respond (the creator gets 403, anyone else 404), and only while `pending` (otherwise 409). Accepting sets `startsOn = today` and `endsOn = startsOn + days - 1`. You cannot challenge yourself; an unknown friend code gives 404.
- `status` is computed on read: `pending`, `declined`, `active`, or `completed`.
- **Most in period:** totals are pushups from `startsOn` to `endsOn`. Completed when `today > endsOn`; the higher total wins, a tie has no winner.
- **First to target:** cumulative pushups from `startsOn`; the first to reach `target` (by entry/session time) wins and the challenge completes at once. If nobody reaches it by `endsOn`, it completes without a winner.
- `daysLeft` = days from `today` to `endsOn` inclusive while active, otherwise null.

## Local development

`pnpm dev:health` runs these handlers on `http://127.0.0.1:3100` against an embedded PGlite database (`var/pglite`), with migrations from `db/`. With `HEALTH_DEV_AUTH=1` (refused on Vercel), the dev server also accepts `Bearer dev:<name>` tokens so the simulator can be tested without WorkOS.

## Implementation notes

Details the backend settled that the tables above leave open:

- `today` is required wherever it appears; a missing or invalid day is a 400.
- `POST /api/health/challenges` answers 201. `Challenge.days` is the length the challenge was created with, so a pending invite can show it; `target` is null for `most_in_period`; `startsOn`/`endsOn` are null until accepted.
- Friend codes are 6 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`; input is matched case-insensitively, ignoring spaces and dashes.
- In `sync`, a client id sent twice keeps the last occurrence. Days after `today` are stored but never count towards streaks.
- `first_to_target`: if both sides reach the target at the same instant there is no winner and the challenge completes.
- Dev tokens are `dev:<name>` with `<name>` 1–40 characters of `A-Z a-z 0-9 _ . -`; the display name starts as `<name>`.

