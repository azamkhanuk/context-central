set -eu
. "$(dirname "$0")/../../acme.sh"

put worker/src/keep.js <<'CODE'
export const KEEP_DAYS = 7

export function expired(file, now = Date.now()) {
  return now - file.builtAt > KEEP_DAYS * 24 * 60 * 60 * 1000
}
CODE
