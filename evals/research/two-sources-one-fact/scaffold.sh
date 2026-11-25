set -eu
. "$(dirname "$0")/../../acme.sh"

put worker/src/keep.js <<'CODE'
export const KEEP_DAYS = 7

export function expired(file, now = Date.now()) {
  return now - file.builtAt > KEEP_DAYS * 24 * 60 * 60 * 1000
}
CODE

put worker/src/clean.js <<'CODE'
const A_WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function clean(files, remove, now = Date.now()) {
  for (const file of files) if (now - file.builtAt > A_WEEK_MS) remove(file)
}
CODE

put work/export-csv/sources/01-2025-11-10-PROJ-22-full-text.md <<'TICKET'
# PROJ-22 full text

The ticket as filed, in full.

**Export orders as CSV**

A shop should be able to ask for a month of orders as a CSV file and get a link to it.
The file should stay available for 7 days after it is built, then be removed.
TICKET

put work/export-csv/STATE.md <<'NOTE'
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
- The ticket as filed: `sources/01-2025-11-10-PROJ-22-full-text.md`.
NOTE
