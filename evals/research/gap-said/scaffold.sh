set -eu
. "$(dirname "$0")/../../acme.sh"

put work/rate-limit-gateway/STATE.md <<'NOTE'
---
item: rate-limit-gateway
title: Rate limit the gateway
status: active
ticket: "PROJ-12"
---
# rate-limit-gateway: Rate limit the gateway

## Where it stands

Designed on 2026-01-08 and not built.

## Done

- 2026-01-08: designed, see the spec.

## Next

Build the first slice of the spec.

## Blocked

Nothing.

## Standing traps

- The limit is counted for each shop, not for each person signed in.
- The number of calls a minute for each shop was agreed in the team chat, in the thread T-377, and is written down nowhere else.

## Where the detail lives

- Spec: [SPEC.md](SPEC.md).
- Research: [rate limits](notes/2026-01-08-research-rate-limits.md).
- Where calls come in: [the gateway](../../concepts/gateway.md).
NOTE
