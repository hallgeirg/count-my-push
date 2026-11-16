# Concurrent saves browser verification

This fixture renders the actual App and components with synthetic fetch responses. No production API, authentication, database, or delivery is exercised.

Build with installed dependencies (or an explicitly supplied cached node_modules):

```sh
node codex/fixtures/mutation-race/build.cjs /absolute/path/to/node_modules /tmp/count-push-race-1540
python -m http.server 49731 --bind 127.0.0.1 --directory /tmp/count-push-race-1540
```

Open http://127.0.0.1:49731 in Playwright CLI, then run `run-code --filename <absolute-repo>/codex/fixtures/mutation-race/browser-proof.js`.

2026-10-23: all five scenarios passed in Chromium: either POST fails, both fail, reverse-order success, and a pre-save GET arrives after reconciliation. Before the fix, saving10 while20 failed left UI0 against server10; after the fix both report10. Intermediate optimistic total remains30 until the pending save settles. Independent read-only review found no blocking issue.

The run reused cached React19/esbuild dependencies from another checkout; it is focused browser evidence, not a frozen-lockfile build or live backend test. Existing background refresh rejection handling and pending DELETE/settings behavior are outside this change. This change is stacked on PR2 (pending Undo).
