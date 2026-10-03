import assert from 'node:assert/strict'
import { test } from 'node:test'
import { acme, disposable, makeTree, run } from './helpers.mjs'

const tree = disposable()

const lint = (root, ...flags) => run(['lint', ...flags], { cwd: root })
const lines = count => 'A rule.\n'.repeat(count)

test('a map within every budget is ok', () => {
  const root = tree(acme())

  const result = lint(root)

  assert.equal(result.stdout, 'ok\n')
  assert.equal(result.code, 0)
})

test('a missing hub is an error', () => {
  const root = tree(acme({}, { hub: 'START.md' }))

  const result = lint(root)

  assert.equal(result.stdout, 'ERROR hub: START.md does not exist\n')
  assert.equal(result.code, 1)
})

test('the hub is measured together with the files it imports', () => {
  const hub = '# Acme estate\n\n@rules/style.md\n'
  const root = tree(acme({ 'CLAUDE.md': hub, 'rules/style.md': lines(8) }, { budgets: { hubLines: 10 } }))

  const result = lint(root)

  assert.equal(result.stdout, 'ERROR hub: CLAUDE.md is 11 lines with its imports (budget 10)\n')
  assert.equal(result.code, 1)
})

test('a hub exactly on its line budget passes', () => {
  const hub = '# Acme estate\n\n@rules/style.md\n'
  const root = tree(acme({ 'CLAUDE.md': hub, 'rules/style.md': lines(7) }, { budgets: { hubLines: 10 } }))

  assert.equal(lint(root).stdout, 'ok\n')
})

test('more than three dated statements in the hub earn a warning', () => {
  const hub = '# Acme estate\n\nShipped the limiter on 2026-01-09.\nReviewed 12 Sep.\nPaused 3 January.\n\nResumed 2026-01-14.\n'
  const root = tree(acme({ 'CLAUDE.md': hub }))

  const result = lint(root)

  assert.equal(result.stdout, 'WARN hub: 4 dated statements; status belongs in state files (first at line 3)\n')
  assert.equal(result.code, 0)
})

test('three dated statements in the hub are let through', () => {
  const hub = '# Acme estate\n\nShipped the limiter on 2026-01-09.\nReviewed 12 Sep.\nPaused 3 January.\n'
  const root = tree(acme({ 'CLAUDE.md': hub }))

  assert.equal(lint(root).stdout, 'ok\n')
})

test('a number before an ordinary word is not a date', () => {
  const hub = '# Acme estate\n\n2 Mayors.\n3 Marches.\n4 Junctions.\n5 Decks.\n'
  const root = tree(acme({ 'CLAUDE.md': hub }))

  assert.equal(lint(root).stdout, 'ok\n')
})

test('a date inside a file name is not a dated statement', () => {
  const hub = [
    '# Acme estate',
    '',
    '- `work/PROJ-12/notes/2026-01-10-research-rate-limits.md`',
    '- [[work/PROJ-12/notes/2026-01-11-design]]',
    '- sources/01-2026-01-09-PROJ-12-full-text.md',
    '- 2026-01-12-meeting.md and log/2026-01-13.md',
    '',
  ].join('\n')
  const root = tree(acme({ 'CLAUDE.md': hub }))

  assert.equal(lint(root).stdout, 'ok\n')
})

test('a date with a time is a dated statement', () => {
  const hub = '# Acme estate\n\nCut 2026-01-09T10:00.\nCut 2026-01-10T10:00.\nCut 2026-01-11T10:00.\nCut 2026-01-12T10:00.\n'
  const root = tree(acme({ 'CLAUDE.md': hub }))

  assert.equal(lint(root).stdout, 'WARN hub: 4 dated statements; status belongs in state files (first at line 3)\n')
})

test('a hub path that is a folder counts as a missing hub', () => {
  const root = tree(acme({ 'guide/readme.md': '# Guide\n' }, { hub: 'guide' }))

  const result = lint(root)

  assert.equal(result.stdout, 'ERROR hub: guide does not exist\n')
  assert.equal(result.code, 1)
})

test('imports are followed four files deep and no further', () => {
  const files = {
    'CLAUDE.md': '# Acme estate\n@rules/one.md\n',
    'rules/one.md': 'One.\n@two.md\n',
    'rules/two.md': 'Two.\n@three.md\n',
    'rules/three.md': 'Three.\n@four.md\n',
    'rules/four.md': 'Four.\n@five.md\n',
    'rules/five.md': lines(50),
  }
  const root = tree(acme(files, { budgets: { hubLines: 9 } }))

  assert.equal(lint(root).stdout, 'ERROR hub: CLAUDE.md is 10 lines with its imports (budget 9)\n')
})

test('a state file exactly on its character budget passes', () => {
  const root = tree(acme({ 'work/PROJ-13/STATE.md': 'a'.repeat(400) }, { budgets: { stateChars: 400 } }))

  assert.equal(lint(root).stdout, 'ok\n')
})

test('a state file over its character budget is an error', () => {
  const state = `# PROJ-13\n${'a'.repeat(395)}`
  const root = tree(acme({ 'work/PROJ-13/STATE.md': state }, { budgets: { stateChars: 400 } }))

  const result = lint(root)

  assert.equal(result.stdout, 'ERROR state: work/PROJ-13/STATE.md is 405 characters (budget 400)\n')
  assert.equal(result.code, 1)
})

test('an item in flight without a state file earns a warning naming its entry file', () => {
  const root = tree(acme({ 'work/PROJ-7.md': '# PROJ-7: Old shape\n' }))

  const result = lint(root)

  assert.equal(result.stdout, 'WARN entry: PROJ-7 has no STATE.md; its entry file work/PROJ-7.md is 20 B\n')
  assert.equal(result.code, 0)
})

test('a finished item without a state file is left alone', () => {
  const root = tree(acme({ 'work/PROJ-7.md': '---\nstatus: done\n---\n# PROJ-7: Old shape\n' }))

  assert.equal(lint(root).stdout, 'ok\n')
})

test('an item in flight with no entry file at all earns a warning', () => {
  const root = tree(acme({ 'work/PROJ-9/notes/idea.md': '# Idea\n' }))

  assert.equal(lint(root).stdout, 'WARN entry: PROJ-9 has no STATE.md and no other entry file\n')
})

test('a note over the soft cap earns a warning', () => {
  const root = tree(acme({ 'concepts/big.md': `# Big\n${'x'.repeat(2042)}` }, { budgets: { nodeBytes: 1024 } }))

  const result = lint(root)

  assert.equal(result.stdout, 'WARN node: concepts/big.md is 2.0 KB (soft cap 1.0 KB)\n')
  assert.equal(result.code, 0)
})

test('a deep file may be any size', () => {
  const root = tree(acme({ 'work/PROJ-12/sources/02-thread.md': `# Thread\n${'x'.repeat(4000)}` }, { budgets: { nodeBytes: 1024 } }))

  assert.equal(lint(root).stdout, 'ok\n')
})

test('more work in flight than the index can list earns a warning', () => {
  const items = Object.fromEntries(Array.from({ length: 40 }, (_, n) => [`work/PROJ-${100 + n}/STATE.md`, `# PROJ-${100 + n}\n`]))
  const root = tree(acme(items))

  const result = lint(root)

  assert.equal(result.stdout, 'WARN index: 41 items in flight do not fit in 2000 characters; the list is cut\n')
  assert.equal(result.code, 0)
})

test('finished items take no room in the index', () => {
  const items = Object.fromEntries(Array.from({ length: 40 }, (_, n) => [`work/PROJ-${100 + n}/STATE.md`, `---\nstatus: done\n---\n# PROJ-${100 + n}\n`]))
  const root = tree(acme(items))

  assert.equal(lint(root).stdout, 'ok\n')
})

test('strict fails the run on a warning', () => {
  const root = tree(acme({ 'work/PROJ-7.md': '# PROJ-7: Old shape\n' }))

  assert.equal(lint(root, '--strict').code, 1)
})

test('errors and warnings are listed together, one line each', () => {
  const state = `# PROJ-13\n${'a'.repeat(395)}`
  const root = tree(acme({ 'work/PROJ-13/STATE.md': state, 'work/PROJ-7.md': '# PROJ-7: Old shape\n' }, { budgets: { stateChars: 400 } }))

  const result = lint(root)

  assert.equal(
    result.stdout,
    'ERROR state: work/PROJ-13/STATE.md is 405 characters (budget 400)\nWARN entry: PROJ-7 has no STATE.md; its entry file work/PROJ-7.md is 20 B\n',
  )
  assert.equal(result.code, 1)
})

test('json lists each finding with its level, check and file', () => {
  const root = tree(acme({ 'work/PROJ-7.md': '# PROJ-7: Old shape\n' }))

  const result = lint(root, '--json')

  assert.deepEqual(JSON.parse(result.stdout), [
    { level: 'WARN', check: 'entry', rel: 'work/PROJ-7.md', message: 'entry: PROJ-7 has no STATE.md; its entry file work/PROJ-7.md is 20 B' },
  ])
})

test('json is an empty list when there is nothing to report', () => {
  const root = tree(acme())

  assert.deepEqual(JSON.parse(lint(root, '--json').stdout), [])
})

test('outside a map lint says there is none', () => {
  const root = tree(makeTree({ 'notes.md': '# Notes\n' }))

  const result = lint(root)

  assert.equal(result.code, 1)
  assert.match(result.stderr, /no context map found/)
})
