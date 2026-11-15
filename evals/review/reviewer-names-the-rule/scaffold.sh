set -eu
. "$(dirname "$0")/../../acme.sh"

put repos/api.md <<'EOF'
# api

The back end: routes for orders, invoices, exports and accounts. Calls come in through [the gateway](../concepts/gateway.md), and the routes web may call are listed in [web to api](../edges/web-api.md). How its code is written is in [its standards](../standards/api.md).

## Traps

- A route that starts work lasting more than a second hands it to worker and answers at once: see [exports](../concepts/exports.md).
EOF

put standards/api.md <<'EOF'
# api

Each rule names its source: who said it and when, the file that shows it, or the review it was learned from, with its work item and the commit its line was read at. An example is a pointer to real code, as a path and a line. The lines are those of `api` at `4f2e1c9`, on 2026-01-12.

## Design

- A module under `api/src/` exports its functions by name, with no default export. Source: `api/src/limit.js:1`.
- A module of api imports nothing from web, billing or worker. Said by the owner, 2026-01-12.

## Code

- A function that needs the time takes it as `now` and never reads the clock itself. Source: `api/src/limit.js:1`.

## Tests

- A test passes the time in and never waits on the clock. Source: `api/test/limit.test.js:6`.

## Review

- A wait handed to a caller is in whole seconds, under a name that ends `Seconds`. Said by the owner, 2026-01-12.
EOF

put work/plan-limits/STATE.md <<'EOF'
---
item: plan-limits
title: Give each plan its own limit
status: active
---
# plan-limits: Give each plan its own limit

## Where it stands

Both slices of the spec are written in api and neither is reviewed. Each is kept as a diff of its own, `api/diffs/plans.diff` and `api/diffs/refusal.diff`.

## Done

- 2026-01-15: `callsAMinute` in `api/src/plans.js`.
- 2026-01-15: `refusal` in `api/src/refusal.js`.

## Next

Have both diffs reviewed against the spec and the standards of api.

## Blocked

Nothing.

## Standing traps

- The limit is counted for each shop, not for each person signed in.

## Where the detail lives

- Spec: [SPEC.md](SPEC.md).
- The repo: [api](../../repos/api.md).
EOF

put work/plan-limits/SPEC.md <<'EOF'
# Spec: give each plan its own limit

## Problem

Every shop has the same number of calls a minute, whatever it pays for, and a call over the limit is refused with no word of which shop was refused or how long to wait.

## Solution

Two slices in api, each a diff of its own.

1. `api/src/plans.js`: `callsAMinute(plan)` gives the calls a minute of a plan: 60 for Starter, 300 for Standard and 1200 for Plus. A shop on no plan, or on one that is not listed, gets Starter's.
2. `api/src/refusal.js`: `refusal(shop, wait)` gives the answer to a call over the limit: the status 429, and a body that names the shop and says how long to wait before the next call.

## Out of scope

Calling either from the limiter or the gateway, and the tests of both: those come with the slice that wires them in.
EOF

put api/src/plans.js <<'EOF'
const CALLS_A_MINUTE = new Map([
  ['Starter', 60],
  ['Standard', 300],
  ['Plus', 1200],
])

export function callsAMinute(plan) {
  return CALLS_A_MINUTE.get(plan) ?? CALLS_A_MINUTE.get('Starter')
}
EOF

put api/src/refusal.js <<'EOF'
export function refusal(shop, waitMs) {
  return { status: 429, body: { shop, error: 'over the limit', retryAfterMs: waitMs } }
}
EOF

put api/diffs/plans.diff <<'EOF'
diff --git a/src/plans.js b/src/plans.js
new file mode 100644
index 0000000..a4b6089
--- /dev/null
+++ b/src/plans.js
@@ -0,0 +1,9 @@
+const CALLS_A_MINUTE = new Map([
+  ['Starter', 60],
+  ['Standard', 300],
+  ['Plus', 1200],
+])
+
+export function callsAMinute(plan) {
+  return CALLS_A_MINUTE.get(plan) ?? CALLS_A_MINUTE.get('Starter')
+}
EOF

put api/diffs/refusal.diff <<'EOF'
diff --git a/src/refusal.js b/src/refusal.js
new file mode 100644
index 0000000..7c70455
--- /dev/null
+++ b/src/refusal.js
@@ -0,0 +1,3 @@
+export function refusal(shop, waitMs) {
+  return { status: 429, body: { shop, error: 'over the limit', retryAfterMs: waitMs } }
+}
EOF
