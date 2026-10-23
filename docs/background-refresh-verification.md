# Recover automatic refresh after connection failures

Based on main `2e2233a54c951ed3e110e8616b0dd9956393238b`.

The midnight timer recorded the new calendar day before the state request succeeded. If that request failed, subsequent minute ticks considered that day already refreshed and left yesterday's totals visible. Both the timer and foreground handler also discarded rejected refresh promises.

Both automatic triggers now catch connection errors through the existing alert. The successful refresh remains responsible for recording the calendar day, so failed rollover requests retry the next minute. A recovered background refresh clears the error. Mutation handlers retain their existing rejection handling.

Focused verification executes the transpiled actual App with synthetic React hooks, calendar, transport, interval and document visibility. It covers failed rollover preserving totals and showing an alert, next-minute recovery and stopping same-day polling, foreground failure/recovery, and unmount cleanup. It checks that recovered refreshes remove the alert.

Three tests pass. Original main fails both offline cases with unhandled rejection. A separate negative control restores only the premature calendar marker on the fixed App and fails the retry assertion (two requests rather than three).

Run with installed TypeScript: `node --test tests/background-refresh.test.mjs`. Node26's default isolated reporter can summarize this as a file-level result; `--test-isolation=none` or direct `node tests/background-refresh.test.mjs` prints all three names. The `COUNT_MY_PUSH_TYPESCRIPT_PATH` environment variable can select an existing TypeScript installation; verification reused the local Challenger toolchain without modifying it. `COUNT_MY_PUSH_APP_PATH` supports negative controls.

This is focused callback/state verification, not real React effect scheduling, browser or database proof. No dependency install, full lint/typecheck/build, live API calls, deployment or production state changes were performed.
