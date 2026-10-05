import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { ACME_FILES, acme, disposable, makeTree, run } from './helpers.mts'

const tree = disposable()

const at = (now: string) => ({ TZ: 'UTC', CONTEXT_CENTRAL_NOW: now })
const note = (root: string, args: string[], now = '2026-01-15T12:00:00Z') => run(['note', ...args], { cwd: root, env: at(now) })
const read = (root: string, rel: string) => readFileSync(join(root, rel), 'utf8')

test('the first note of a month starts that month\'s log', () => {
  const root = tree(acme())

  const result = note(root, ['Gateway', 'limits', 'agreed'])

  assert.equal(result.code, 0)
  assert.equal(result.stdout, 'log/2026-01.md\n')
  assert.equal(read(root, 'log/2026-01.md'), '# 2026-01\n\n## 2026-01-15\n\n- Gateway limits agreed\n')
})

test('a second note on the same day goes under the same heading', () => {
  const root = tree(acme())
  note(root, ['Gateway limits agreed'])

  note(root, ['Limiter goes in api'])

  assert.equal(read(root, 'log/2026-01.md'), '# 2026-01\n\n## 2026-01-15\n\n- Gateway limits agreed\n- Limiter goes in api\n')
})

test('a new day gets its own heading below the last', () => {
  const root = tree(acme())
  note(root, ['Gateway limits agreed'])

  note(root, ['Limiter built'], '2026-01-16T12:00:00Z')

  assert.equal(read(root, 'log/2026-01.md'), '# 2026-01\n\n## 2026-01-15\n\n- Gateway limits agreed\n\n## 2026-01-16\n\n- Limiter built\n')
})

test('a note for a day that is no longer last still lands under that day', () => {
  const log = '# 2026-01\n\n## 2026-01-15\n\n- Earlier\n\n## 2026-01-16\n\n- Written ahead\n'
  const root = tree(acme({ 'log/2026-01.md': log }))

  note(root, ['Later'])

  assert.equal(read(root, 'log/2026-01.md'), '# 2026-01\n\n## 2026-01-15\n\n- Earlier\n- Later\n\n## 2026-01-16\n\n- Written ahead\n')
})

test('a new month starts a new file', () => {
  const root = tree(acme())
  note(root, ['Gateway limits agreed'])

  const result = note(root, ['Limiter shipped'], '2026-02-01T12:00:00Z')

  assert.equal(result.stdout, 'log/2026-02.md\n')
  assert.equal(read(root, 'log/2026-02.md'), '# 2026-02\n\n## 2026-02-01\n\n- Limiter shipped\n')
})

test('a note with no text is wrong usage', () => {
  const root = tree(acme())

  assert.equal(note(root, []).code, 2)
})

test('a note needs a map', () => {
  const root = tree(makeTree({ 'readme.md': '# nothing here\n' }))

  const result = note(root, ['Lost'])

  assert.equal(result.code, 1)
  assert.match(result.stderr, /no context map found/)
})

test('a new concept is a title and nothing else', () => {
  const root = tree(acme())

  const result = note(root, ['--new', 'concepts/token-bucket', '--title', 'The token bucket'])

  assert.equal(result.code, 0)
  assert.equal(result.stdout, 'concepts/token-bucket.md\n')
  assert.equal(read(root, 'concepts/token-bucket.md'), '# The token bucket\n')
})

test('a new node with no title is headed by its name', () => {
  const root = tree(acme())

  note(root, ['--new', 'concepts/token-bucket'])

  assert.equal(read(root, 'concepts/token-bucket.md'), '# token-bucket\n')
})

test('a new repo note has the three parts a repo needs', () => {
  const root = tree(acme())

  note(root, ['--new', 'repos/billing'])

  assert.equal(read(root, 'repos/billing.md'), '# billing\n\n## What it is\n\n## Traps\n\n## How to work in it\n')
})

test('a new area note says what it covers and its traps', () => {
  const root = tree(acme())

  note(root, ['--new', 'areas/checkout', '--title', 'Checkout'])

  assert.equal(read(root, 'areas/checkout.md'), '# Checkout\n\n## What it covers\n\n## Traps\n')
})

test('a new edge note is a table of crossings, each marked verified or inferred', () => {
  const root = tree(acme())

  note(root, ['--new', 'edges/web-billing', '--title', 'web to billing'])

  assert.equal(
    read(root, 'edges/web-billing.md'),
    '# web to billing\n\nStatus is `verified` (checked in the code) or `inferred` (read from names or documents).\n\n| From | To | Status |\n|---|---|---|\n',
  )
})

test('the first decision is numbered 0001', () => {
  const root = tree(acme())

  const result = note(root, ['--new', 'decisions/use-token-bucket', '--title', 'Use a token bucket'])

  assert.equal(result.stdout, 'decisions/0001-use-token-bucket.md\n')
  assert.equal(read(root, 'decisions/0001-use-token-bucket.md'), '# 0001: Use a token bucket\n\n## Context\n\n## Decision\n\n## Consequences\n')
})

test('a decision is numbered after the highest there is', () => {
  const root = tree(acme({ 'decisions/0002-one-gateway.md': '# 0002: One gateway\n', 'decisions/0007-limits-per-route.md': '# 0007: Limits per route\n' }))

  const result = note(root, ['--new', 'decisions/use-token-bucket'])

  assert.equal(result.stdout, 'decisions/0008-use-token-bucket.md\n')
})

test('a decision already recorded under another number is not recorded twice', () => {
  const root = tree(acme({ 'decisions/0002-one-gateway.md': '# 0002: One gateway\n' }))

  const result = note(root, ['--new', 'decisions/one-gateway'])

  assert.equal(result.code, 1)
  assert.match(result.stderr, /decisions\/0002-one-gateway\.md already exists/)
})

test('an existing node is never overwritten', () => {
  const root = tree(acme())

  const result = note(root, ['--new', 'concepts/gateway'])

  assert.equal(result.code, 1)
  assert.match(result.stderr, /concepts\/gateway\.md already exists/)
  assert.equal(read(root, 'concepts/gateway.md'), ACME_FILES['concepts/gateway.md'])
})

test('work items and the log are not made with note --new', () => {
  const root = tree(acme())

  for (const target of ['work/PROJ-13', 'log/2026-03', 'nowhere/thing']) {
    const result = note(root, ['--new', target])

    assert.equal(result.code, 2, target)
    assert.match(result.stderr, /repos, areas, concepts, edges, decisions, docs/)
  }
})

test('a name that would leave its folder is refused', () => {
  const root = tree(acme())

  assert.equal(note(root, ['--new', 'concepts/../escape']).code, 2)
  assert.equal(note(root, ['--new', 'concepts']).code, 2)
})

test('log text alongside --new is wrong usage', () => {
  const root = tree(acme())

  assert.equal(note(root, ['--new', 'concepts/token-bucket', 'and', 'a', 'log', 'line']).code, 2)
})

test('text that starts with a dash is logged, not read as a flag', () => {
  const root = tree(acme())

  const result = note(root, ['-5% on the gateway', 'after `npm test`'])

  assert.equal(result.code, 0)
  assert.equal(read(root, 'log/2026-01.md'), '# 2026-01\n\n## 2026-01-15\n\n- -5% on the gateway after `npm test`\n')
})

test('text typed as a bullet is not given a second bullet', () => {
  const root = tree(acme())

  note(root, ['- Gateway limits agreed'])

  assert.equal(read(root, 'log/2026-01.md'), '# 2026-01\n\n## 2026-01-15\n\n- Gateway limits agreed\n')
})

test('a flag note does not know, after --new, is wrong usage, said in one line', () => {
  const root = tree(acme())

  const result = note(root, ['--new', 'concepts/token-bucket', '--bogus'])

  assert.equal(result.code, 2)
  assert.match(result.stderr, /^context-central note: Unknown option '--bogus'.*\n$/)
  assert.equal(existsSync(join(root, 'concepts/token-bucket.md')), false)
})

test('text that quotes a flag further in is logged whole', () => {
  const root = tree(acme())

  const result = note(root, ['ran', 'git', 'push', '--force', 'on', 'the', 'branch'])

  assert.equal(result.code, 0)
  assert.equal(read(root, 'log/2026-01.md'), '# 2026-01\n\n## 2026-01-15\n\n- ran git push --force on the branch\n')
})

test('text that starts with a flag of another tool is logged whole', () => {
  const root = tree(acme())

  note(root, ['--force', 'was', 'needed', '--title=none'])

  assert.equal(read(root, 'log/2026-01.md'), '# 2026-01\n\n## 2026-01-15\n\n- --force was needed --title=none\n')
})

test('a leading double dash is dropped, so text may start with --new', () => {
  const root = tree(acme())

  note(root, ['--', '--new', 'is', 'how', 'a', 'node', 'starts'])

  assert.equal(read(root, 'log/2026-01.md'), '# 2026-01\n\n## 2026-01-15\n\n- --new is how a node starts\n')
})

test('a title given first, in either spelling, still starts a node', () => {
  const root = tree(acme())

  assert.equal(note(root, ['--title=The token bucket', '--new', 'concepts/token-bucket']).stdout, 'concepts/token-bucket.md\n')
  assert.equal(note(root, ['--new=concepts/leaky-bucket']).stdout, 'concepts/leaky-bucket.md\n')
  assert.equal(read(root, 'concepts/token-bucket.md'), '# The token bucket\n')
})

test('text over several lines is logged as one line', () => {
  const root = tree(acme())

  note(root, ['Limits agreed.\n\nLimiter goes in api.'])

  assert.equal(read(root, 'log/2026-01.md'), '# 2026-01\n\n## 2026-01-15\n\n- Limits agreed. Limiter goes in api.\n')
})

test('an empty log file is given its month heading', () => {
  const root = tree(acme({ 'log/2026-01.md': '' }))

  note(root, ['Gateway limits agreed'])

  assert.equal(read(root, 'log/2026-01.md'), '# 2026-01\n\n## 2026-01-15\n\n- Gateway limits agreed\n')
})

test('a day heading followed by blank space is still that day', () => {
  const root = tree(acme({ 'log/2026-01.md': '# 2026-01\n\n## 2026-01-15  \n\n- Earlier\n' }))

  note(root, ['Later'])

  assert.equal(read(root, 'log/2026-01.md'), '# 2026-01\n\n## 2026-01-15  \n\n- Earlier\n- Later\n')
})

test('a name given with .md makes the same node as the name without', () => {
  const root = tree(acme())

  const made = note(root, ['--new', 'concepts/token-bucket.md'])
  const refused = note(root, ['--new', 'concepts/gateway.md'])

  assert.equal(made.stdout, 'concepts/token-bucket.md\n')
  assert.equal(read(root, 'concepts/token-bucket.md'), '# token-bucket\n')
  assert.equal(refused.code, 1)
  assert.match(refused.stderr, /concepts\/gateway\.md already exists/)
})

test('a decision named with its own number is refused, because the number is given for it', () => {
  const root = tree(acme())

  const result = note(root, ['--new', 'decisions/0003-use-token-bucket'])

  assert.equal(result.code, 2)
  assert.match(result.stderr, /name the decision without a number/)
  assert.equal(existsSync(join(root, 'decisions')), false)
})

test('an empty title falls back to the name', () => {
  const root = tree(acme())

  note(root, ['--new', 'concepts/token-bucket', '--title', ''])

  assert.equal(read(root, 'concepts/token-bucket.md'), '# token-bucket\n')
})
