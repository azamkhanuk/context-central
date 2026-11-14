put() {
  mkdir -p "$(dirname "$1")"
  cat > "$1"
}

put estate.json <<'EOF'
{
  "contextCentral": 1,
  "name": "acme",
  "title": "Acme estate",
  "repos": [
    { "name": "web", "role": "front end", "baseBranch": "main" },
    { "name": "api", "role": "back end", "baseBranch": "main" },
    { "name": "billing", "role": "invoices and payments", "baseBranch": "main" },
    { "name": "worker", "role": "background jobs", "baseBranch": "main" }
  ],
  "connections": {
    "tracker": { "holds": "tickets", "references": ["PROJ-\\d+"] }
  },
  "budgets": { "indexChars": 9500 }
}
EOF

put CLAUDE.md <<'EOF'
# Acme estate

Four repos that ship one product, the back office of a shop. This file routes a task to the notes about it, which are in the folders beside it.

| The task is about | Go to |
|---|---|
| a screen or a form | [web](repos/web.md) |
| a route or a number that renders wrong | [api](repos/api.md) |
| an invoice, a total or a payment | [billing](repos/billing.md) |
| an export or another background job | [worker](repos/worker.md) |
| how a call from web reaches api | [the gateway](concepts/gateway.md) and [web to api](edges/web-api.md) |

## Work

Each piece of work has a folder under `work/` with a state file, `STATE.md`, which says where it stands and what is next. The log under `log/` is history, one file a month, and is not where the work stands.

## Rules

- A decision is a numbered note under `decisions/`.
- A term the estate uses with a meaning of its own is in `glossary.md`.
EOF

put glossary.md <<'EOF'
# Glossary

Terms this estate uses with a meaning of its own.

**Export**: a file of orders that a shop asks for and worker builds in the background.

**Line**: one row of an invoice, with a quantity, a unit price and a tax rate.

**Gateway**: the one way in from web to api.

**Plan**: what a shop pays for: Starter, Standard or Plus.
EOF

put repos/web.md <<'EOF'
# web

The front end: the back office a shop's staff use. Every call it makes goes to [[repos/api]] through [the gateway](../concepts/gateway.md).

## Traps

- A total shown on a screen is the number api sent. web never does sums on money: see [rounding](../concepts/rounding.md).
- One file a screen, under `web/src/`.
EOF

put repos/api.md <<'EOF'
# api

The back end: routes for orders, invoices, exports and accounts. Calls come in through [the gateway](../concepts/gateway.md), and the routes web may call are listed in [web to api](../edges/web-api.md).

## Traps

- A route that starts work lasting more than a second hands it to worker and answers at once: see [exports](../concepts/exports.md).
EOF

put repos/billing.md <<'EOF'
# billing

Invoices and payments. It makes an invoice from an order, works out each line and the total, and takes the payment. How money is rounded is in [rounding](../concepts/rounding.md), and what an invoice is made of is in [invoices](../concepts/invoices.md).

## Traps

- Money is held in pence as whole numbers. Only `billing/src/round.js` turns a fraction of a penny into a whole one.
EOF

put repos/worker.md <<'EOF'
# worker

Background jobs: it builds exports and sends invoice emails. Jobs are queued by api and run here, as [decision 2](../decisions/0002-exports-run-in-worker.md) settled. What an export is and how one runs is in [exports](../concepts/exports.md).

## Traps

- A job must be safe to run twice: the queue hands a job out again when a worker stops part-way.
EOF

put concepts/gateway.md <<'EOF'
# The gateway

Every call from web reaches api through one gateway, as [decision 1](../decisions/0001-one-gateway.md) settled. It checks the session, then passes the call on. The routes behind it are in [web to api](../edges/web-api.md).
EOF

put concepts/exports.md <<'EOF'
# Exports

A shop asks for an export on a screen in web. api queues a job, and worker builds the file and keeps it for seven days. The shop is sent a link when the file is ready.

An export that fails is marked failed, and the shop is told to ask again.

The one format today is CSV.
EOF

put concepts/rounding.md <<'EOF'
# Rounding

Money is held in pence as whole numbers. A sum that leaves a fraction of a penny, such as the tax on a line, is rounded once, in billing, when the invoice line is made. Nothing after that rounds again: api passes the pence on and web shows them.

Each invoice line is rounded half to even, as [decision 3](../decisions/0003-round-half-even.md) settled. An invoice total is the sum of its rounded lines, never a rounding of its own.
EOF

put concepts/invoices.md <<'EOF'
# Invoices

billing makes an invoice from an order: one line for each item, each with a quantity, a unit price in pence and a tax rate. The total is the sum of the lines. See [rounding](rounding.md) for how the tax on a line becomes whole pence.

An invoice goes to the customer as an email with a link. A PDF is being added: see [invoice-pdf](../work/invoice-pdf/STATE.md).
EOF

put edges/web-api.md <<'EOF'
# web to api

| Path prefix | Owner | Status |
|---|---|---|
| /orders | api | verified |
| /invoices | api | verified |
| /exports | api | verified |
| /account | api | verified |
EOF

put decisions/0001-one-gateway.md <<'EOF'
# 1: One gateway in front of api

## Context

web called the routes of api directly, and each route checked the session in its own way.

## Decision

Every call from web goes through one gateway, which checks the session once.

## Consequences

A route no longer checks the session. A limit on calls has one place to live.
EOF

put decisions/0002-exports-run-in-worker.md <<'EOF'
# 2: Exports run in worker

## Context

A large export held a route of api open for minutes and timed out.

## Decision

api queues an export as a job and answers at once. worker builds the file.

## Consequences

The shop waits for a link, not for a page. A job can fail after the route has answered, so the shop has to be told another way.
EOF

put decisions/0003-round-half-even.md <<'EOF'
# 3: Round invoice lines half to even

## Context

Invoice lines were rounded half up. The settlement files of the payment provider round half to even, so on some invoices our total and the amount paid were a penny apart, and each of those had to be matched by hand.

## Decision

billing rounds each invoice line half to even. An invoice total is the sum of its rounded lines.

## Consequences

Our totals match the settlement files line for line. Invoices already sent keep the totals they were sent with.
EOF

put log/2025-12.md <<'EOF'
# 2025-12

## 2025-12-04

- export-csv: the CSV export is built in worker and merged. What comes after it is a retry for a failed export, as a piece of work of its own.

## 2025-12-11

- export-retry: tried a retry of three tries with a fixed wait of ten seconds, on a branch in worker. Not merged: the tries all landed inside one outage.

## 2025-12-16

- invoice-rounding: finance found totals a penny out on some invoices. Looking at whether to round the total or the lines.

## 2025-12-18

- rate-limit-gateway: the script of one shop made forty calls a second for an hour. A limit at the gateway is wanted.
EOF

put log/2026-01.md <<'EOF'
# 2026-01

## 2026-01-06

- export-retry: PROJ-31 filed. The plan is a retry with a longer wait each time.
- invoice-rounding: PROJ-27 filed for the penny differences.

## 2026-01-08

- rate-limit-gateway: designed. A token bucket, held in api.

## 2026-01-09

- invoice-rounding: decided, and built in billing the same day.

## 2026-01-12

- export-retry: the retry loop is merged in worker.
- invoice-pdf: started on the layout.

## 2026-01-13

- export-audit: started. What to record for each export is not agreed.
EOF

put work/export-retry/STATE.md <<'EOF'
---
item: export-retry
title: Retry a failed export
status: active
ticket: "PROJ-31"
---
# export-retry: Retry a failed export

## Where it stands

The retry is built and merged in worker: a failed export is tried again up to five times, with a longer wait each time. It is switched off in production until the team is told when an export has failed every try.

## Done

- 2026-01-12: the retry loop, merged in worker.

## Next

Add an alert in api for an export that has failed every try, on the `export-stalled` channel of the team. Then switch the retry on in production.

## Blocked

Nothing.

## Standing traps

- An export job must be safe to run twice: see [worker](../../repos/worker.md).

## Where the detail lives

- Spec: [SPEC.md](SPEC.md).
- How an export runs: [exports](../../concepts/exports.md).
- The ticket as filed: `sources/01-2026-01-06-PROJ-31-full-text.md`.
EOF

put work/export-retry/SPEC.md <<'EOF'
# Spec: retry a failed export

## Problem

An export that fails is marked failed and the shop has to ask for it again. Most failures are a short outage of the file store, and the same job a minute later would have worked.

## Solution

worker tries a failed export again, waiting longer before each try. When the tries run out the export is marked failed, as it is today.

## Out of scope

Telling anyone that an export has failed for good.
EOF

put work/export-retry/sources/01-2026-01-06-PROJ-31-full-text.md <<'EOF'
# PROJ-31 full text

The ticket as filed, in full.

**Exports fail and nobody tries again**

When the file store has a short outage, every export in flight fails and stays failed. Shops ask again by hand, sometimes several times. Can a failed export be tried again without anyone asking?
EOF

put work/export-audit/STATE.md <<'EOF'
---
item: export-audit
title: Keep an audit trail of exports
status: active
ticket: "PROJ-35"
---
# export-audit: Keep an audit trail of exports

## Where it stands

Started on 2026-01-13 and not designed. What to record for each export is not agreed: who asked, when it ran and which rows went out are the candidates.

## Done

## Next

Agree with the shop owners what the trail has to show, then write the spec.

## Blocked

Waiting on two shop owners for what they need to see.

## Standing traps

- With export-retry, one request for an export can mean several runs. The trail has to say which run made the file.

## Where the detail lives

- Research: [what an audit trail could hold](notes/2026-01-13-research-audit-trail.md).
- How an export runs: [exports](../../concepts/exports.md).
EOF

put work/export-audit/notes/2026-01-13-research-audit-trail.md <<'EOF'
# Research: what an audit trail could hold

Three things a shop owner has asked about an export: who asked for it, when it ran and which rows went out. The first two are on the job already. The third is new and large: a month of orders is tens of thousands of rows.
EOF

put work/export-csv/STATE.md <<'EOF'
---
item: export-csv
title: Export orders as CSV
status: done
ticket: "PROJ-22"
---
# export-csv: Export orders as CSV

## Where it stands

Built in worker and merged on 2025-12-04. A shop can export a month of orders as CSV.

## Done

- 2025-12-04: the CSV export, merged in worker.

## Next

A retry for a failed export, as a piece of work of its own: three tries, ten seconds apart.

## Blocked

Nothing.

## Standing traps

## Where the detail lives

- Spec: [SPEC.md](SPEC.md).
EOF

put work/export-csv/SPEC.md <<'EOF'
# Spec: export orders as CSV

A shop asks for a month of orders and is sent a link to a CSV file, one row for each order line. Built in worker, as decision 2 settled.
EOF

put work/invoice-rounding/STATE.md <<'EOF'
---
item: invoice-rounding
title: Round invoice lines the same way everywhere
status: active
ticket: "PROJ-27"
---
# invoice-rounding: Round invoice lines the same way everywhere

## Where it stands

Decided on 2026-01-09 and built in billing the same day: each invoice line is rounded half to even. The decision and the reason for it are in [decision 3](../../decisions/0003-round-half-even.md), and where rounding happens is in [rounding](../../concepts/rounding.md). It is not released: it goes out with the next release of billing.

## Done

- 2026-01-09: half to even in `billing/src/round.js`.

## Next

Release billing, then check one day of invoices against what was paid.

## Blocked

Nothing.

## Standing traps

- Invoices already sent keep the totals they were sent with.

## Where the detail lives

- Spec: [SPEC.md](SPEC.md).
- The ticket as filed: `sources/01-2026-01-05-PROJ-27-full-text.md`.
EOF

put work/invoice-rounding/SPEC.md <<'EOF'
# Spec: round invoice lines the same way everywhere

## Problem

On some invoices the total is a penny away from what the customer paid. The tax on a line can leave half a penny, and how that half is rounded decides the total.

## Solution

One rule for rounding a line, in one place in billing, and a total that is the sum of its rounded lines. Which rule it is, is a decision of its own.
EOF

put work/invoice-rounding/sources/01-2026-01-05-PROJ-27-full-text.md <<'EOF'
# PROJ-27 full text

The ticket as filed, in full.

**Invoice totals a penny out**

Finance matched the invoices of last month against what was paid and found some a penny apart. It is always an invoice with a line whose tax ends in half a penny. Which figure is right, and can the two be made to agree?
EOF

put work/invoice-pdf/STATE.md <<'EOF'
---
item: invoice-pdf
title: Send an invoice as a PDF
status: active
ticket: "PROJ-29"
---
# invoice-pdf: Send an invoice as a PDF

## Where it stands

The layout is drafted and nothing is built. The PDF prints each line and the total as billing holds them, so its totals can be checked only once PROJ-27 is released.

## Done

## Next

Build the PDF in worker from the drafted layout.

## Blocked

The check of the totals waits for PROJ-27.

## Standing traps

- The PDF never works a total out for itself: see [rounding](../../concepts/rounding.md).

## Where the detail lives

- Research: [the layout of the PDF](notes/2026-01-12-research-pdf-layout.md).
- What an invoice is made of: [invoices](../../concepts/invoices.md).
EOF

put work/invoice-pdf/notes/2026-01-12-research-pdf-layout.md <<'EOF'
# Research: the layout of the PDF

One page for up to twenty lines, then a page for each twenty more. The total sits under the last line. Tax is shown for each line, in pence as billing holds it.
EOF

put work/rate-limit-gateway/STATE.md <<'EOF'
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

## Where the detail lives

- Spec: [SPEC.md](SPEC.md).
- Research: [rate limits](notes/2026-01-08-research-rate-limits.md).
- Where calls come in: [the gateway](../../concepts/gateway.md).
EOF

put work/rate-limit-gateway/SPEC.md <<'EOF'
# Spec: rate limit the gateway

## Problem

The script of one shop made forty calls a second for an hour, and every other shop slowed down.

## Solution

Each shop gets a fixed number of calls a minute at the gateway. A call over the limit is refused with a message that says when to try again.

## Slices

1. The limiter, in api: `api/src/limit.js`, with its test.
2. A settings screen in web, where a shop sees its limit and how much of it is used.
EOF

put work/rate-limit-gateway/notes/2026-01-08-research-rate-limits.md <<'EOF'
# Research: rate limits

A token bucket fits: the bucket of a shop holds its calls for a minute and fills at a steady rate. A fixed window was turned down, since a script can spend the calls of two windows across the boundary between them.
EOF

put work/PROJ-40/STATE.md <<'EOF'
---
item: PROJ-40
title: Show the plan on the account page
status: active
---
# PROJ-40: Show the plan on the account page

## Where it stands

Not started. The account page in web shows the name of the shop and nothing about what it pays for.

## Done

## Next

Add the name of the plan and its price to the account page, from the `/account` route.

## Blocked

Nothing.

## Standing traps

## Where the detail lives

- The routes web may call: [web to api](../../edges/web-api.md).
EOF

put web/README.md <<'EOF'
# web

The back office a shop's staff use. Start it with `npm start`.
EOF

put web/src/index.js <<'EOF'
import { account } from './account.js'

export const screens = { account }
EOF

put web/src/account.js <<'EOF'
export function account(shop) {
  return { title: 'Account', name: shop.name }
}
EOF

put api/README.md <<'EOF'
# api

Routes for orders, invoices, exports and accounts. Run the tests with `npm test`.
EOF

put api/src/limit.js <<'EOF'
export function limiter({ perMinute, now = Date.now }) {
  const buckets = new Map()
  return function allow(shop) {
    const at = now()
    const bucket = buckets.get(shop) ?? { tokens: perMinute, at }
    const tokens = Math.min(perMinute, bucket.tokens + ((at - bucket.at) / 60000) * perMinute)
    buckets.set(shop, { tokens: Math.max(0, tokens - 1), at })
    return tokens >= 1
  }
}
EOF

put api/test/limit.test.js <<'EOF'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { limiter } from '../src/limit.js'

test('a shop is refused once its calls for the minute are spent', () => {
  const allow = limiter({ perMinute: 2, now: () => 0 })

  assert.deepEqual([allow('acme'), allow('acme'), allow('acme')], [true, true, false])
})
EOF

put billing/README.md <<'EOF'
# billing

Invoices and payments. Money is whole pence.
EOF

put billing/src/round.js <<'EOF'
export function roundHalfEven(pence) {
  const floor = Math.floor(pence)
  if (pence - floor !== 0.5) return Math.round(pence)
  return floor % 2 === 0 ? floor : floor + 1
}
EOF

put billing/src/invoice.js <<'EOF'
import { roundHalfEven } from './round.js'

export function line({ quantity, unitPence, taxRate }) {
  const net = quantity * unitPence
  return { net, tax: roundHalfEven(net * taxRate) }
}

export function total(lines) {
  return lines.reduce((sum, { net, tax }) => sum + net + tax, 0)
}
EOF

put worker/README.md <<'EOF'
# worker

Background jobs: exports and invoice emails.
EOF

put worker/src/export.js <<'EOF'
import { retry } from './retry.js'

export function runExport(job, { build, store, tries }) {
  return retry(() => store(build(job)), tries)
}
EOF

put worker/src/retry.js <<'EOF'
const longerEachTime = attempt => new Promise(done => setTimeout(done, 1000 * 2 ** attempt))

export async function retry(run, tries, pause = longerEachTime) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await run()
    } catch (error) {
      if (attempt >= tries) throw error
      await pause(attempt)
    }
  }
}
EOF
