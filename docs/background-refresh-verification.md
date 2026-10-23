# Recover automatic refresh after connection failures

Based on main `2e2233a54c951ed3e110e8616b0dd9956393238b`.

The midnight timer recorded the new calendar day before the state request succeeded. If that request failed, subsequent minute ticks considered that day already refreshed and left yesterday's totals visible. Both the timer and foreground handler also discarded rejected refresh promises.

Both automatic triggers now catch connection errors through the existing alert. The successful refresh remains responsible for recording the calendar day, so failed rollover requests retry the next minute. A recovered background refresh clears the error. Mutation handlers retain their existing rejection handling.

Focused verification executes the transpiled actual App with synthetic React hooks, calendar, transport, interval and document visibility. It covers failed rollover preserving totals and showing an alert, next-minute recovery and stopping same-day polling, foreground failure/recovery, and unmount cleanup. It checks that recovered refreshes remove the alert.

Three tests pass. Original main fails both offline cases with unhandled rejection. A separate negative control restores only the premature calendar marker on the fixed App and fails the retry assertion (two requests rather than three).

Run with installed TypeScript: `node --test tests/background-refresh.test.mjs`. Node26's default isolated reporter can summarize this as a file-level result; `--test-isolation=none` or direct `node tests/background-refresh.test.mjs` prints all three names. The `COUNT_MY_PUSH_TYPESCRIPT_PATH` environment variable can select an existing TypeScript installation; verification reused the local Challenger toolchain without modifying it. `COUNT_MY_PUSH_APP_PATH` supports negative controls.

An independent real Chromium fixture also rendered the actual App with React19.2.1 and cached esbuild0.25.10. Five checkpoints passed: initial10, offline calendar rollover retaining10 with an alert, next synthetic tick recovering0 without an alert, offline foreground retaining0, and foreground recovery7 without an alert. Only the clock/interval and API transport were synthetic. The source App hash stayed unchanged. The browser and temporary loopback server were stopped.

Browser receipt: `/home/hallgeirg/Projects/portfolio-20261023/count-my-push-pr3-browser-receipt.json`; screenshots and proof notes are in the same portfolio directory. This verifies actual React refresh/retry rendering, with an explicitly triggered interval rather than a real elapsed minute. No dependency install, full lint/typecheck/build, deployed/mobile browser or real database proof is claimed. No live API calls or production state changes were performed.
