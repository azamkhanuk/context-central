set -eu
. "$(dirname "$0")/../../acme.sh"

in_api() {
  GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 GIT_DEFAULT_HASH=sha1 GIT_DEFAULT_REF_FORMAT=files git -C api "$@"
}

commit_as_acme() {
  in_api add -A
  GIT_AUTHOR_NAME=Acme GIT_AUTHOR_EMAIL=acme@example.invalid GIT_AUTHOR_DATE="$1" GIT_COMMITTER_NAME=Acme GIT_COMMITTER_EMAIL=acme@example.invalid GIT_COMMITTER_DATE="$1" in_api commit -q -m "$2"
}

put estate.json <<'EOF'
{
  "contextCentral": 1,
  "name": "acme",
  "title": "Acme estate",
  "repos": [
    { "name": "web", "role": "front end", "baseBranch": "main" },
    { "name": "api", "role": "back end", "baseBranch": "main", "checks": ["./check.sh"] },
    { "name": "billing", "role": "invoices and payments", "baseBranch": "main" },
    { "name": "worker", "role": "background jobs", "baseBranch": "main" }
  ],
  "connections": {
    "tracker": { "holds": "tickets", "references": ["PROJ-\\d+"] }
  },
  "budgets": { "indexChars": 9500 }
}
EOF

put api/check.sh <<'EOF'
#!/bin/sh
exec node --test
EOF
chmod +x api/check.sh

# A second run finds the repository made and starts no git that writes, so it leaves every file as it was.
if [ ! -e api/.git ]; then
  in_api init -q --template= -b main
  commit_as_acme 2026-01-12T09:00:00Z 'The limiter, its test and the check'
  in_api checkout -q -b work/refund-window
  put api/src/refund.js <<'EOF'
const DAY_MS = 24 * 60 * 60 * 1000

export function refundable(order, now = Date.now()) {
  return now - order.paidAt < 30 * DAY_MS
}
EOF
  put api/test/refund.test.js <<'EOF'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { refundable } from '../src/refund.js'

const DAY_MS = 24 * 60 * 60 * 1000

test('an order paid ten days ago can be refunded, and one paid forty days ago cannot', () => {
  const now = 100 * DAY_MS

  assert.deepEqual([refundable({ paidAt: now - 10 * DAY_MS }, now), refundable({ paidAt: now - 40 * DAY_MS }, now)], [true, false])
})
EOF
  commit_as_acme 2026-01-14T10:00:00Z 'Refund an order inside thirty days'
  put api/src/refund.js <<'EOF'
const DAY_MS = 24 * 60 * 60 * 1000

export function refundable(order, now = Date.now()) {
  return now - order.paidAt <= 30 * DAY_MS
}
EOF
  commit_as_acme 2026-01-15T09:00:00Z 'Count the thirtieth day inside the refund window'
fi

test "$(in_api rev-list --count HEAD)" = 3
proven=$(in_api rev-parse HEAD~1)

put work/refund-window/STATE.md <<EOF
---
item: refund-window
title: Refund an order inside thirty days
status: active
---
# refund-window: Refund an order inside thirty days

## Where it stands

Built in api and verified: a shop can refund an order for thirty days from the day it was paid. The work is on the branch \`work/refund-window\` of api, where \`./check.sh\` passes.

## Done

- Built at \`$(printf '%.7s' "$proven")\`: \`refundable\` in \`api/src/refund.js\`, with its test.

## Next

Merge \`work/refund-window\` into \`main\`.

## Blocked

Nothing.

## Standing traps

- The thirty days are counted from the day the order was paid, not from the day it was made.

## Where the detail lives

- The routes of api: [api](../../repos/api.md).
EOF

put work/refund-window/proof.jsonl <<EOF
{"repo":"api","check":"./check.sh","exit":0,"commit":"$proven","branch":"work/refund-window","dirty":false,"date":"2026-01-14","system":"darwin arm64"}
EOF
