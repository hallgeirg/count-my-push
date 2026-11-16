# Undo waits for a persisted log

Base: `2e2233a` on `origin/main`.

While a set's POST was pending, Recent showed an enabled Undo button. Its temporary negative ID took a local-only delete path. The POST still committed the entry and the following refresh restored it, so an apparently undone set remained saved.

Pending rows now display a disabled `Saving…` button with a contextual accessible name. Once POST returns a durable ID, normal Undo becomes available. The negative-ID delete guard no longer pretends to remove the pending write.

## Focused browser proof (2026-10-23)

A temporary browser fixture rendered the actual App and all its UI components. Its fetch implementation held POST responses until explicitly released and kept synthetic server state in memory. No Neon connection or live API requests were used.

Before the fix, +10 → pending Undo → release POST reproduced the resurrection: one server entry, zero DELETE requests, Undo row returned.

After the fix, the browser verified:

- Pending Undo is disabled and visibly says `Saving…`.
- Successful POST enables normal Undo.
- Undo calls DELETE with the returned durable ID (`/api/entries?id=1`), then refreshes to an empty log.
- Failed POST removes the optimistic row and displays the existing error.
- No JavaScript page errors occurred.

Artifacts: `/tmp/count-push-review` (temporary esbuild fixture, mock transport and Playwright logs). Existing cached frontend dependencies were read without modification. The fixture is not a repository-lockfile build: dependency installation, full lint/typecheck/build and deployed/real database behavior remain unverified. Browser and local server were stopped. No push or deployment was performed.
