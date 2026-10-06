import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { ACME_SHOT, acme, disposable, makeTree, run } from './helpers.mts'
import type { Json } from './helpers.mts'

const tree = disposable()

const lint = (root: string, ...flags: string[]) => run(['lint', ...flags], { cwd: root })
const lines = (count: number) => 'A rule.\n'.repeat(count)

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

  assert.deepEqual(JSON.parse(result.stdout) as unknown, [
    { level: 'WARN', check: 'entry', rel: 'work/PROJ-7.md', message: 'entry: PROJ-7 has no STATE.md; its entry file work/PROJ-7.md is 20 B' },
  ])
})

test('json is an empty list when there is nothing to report', () => {
  const root = tree(acme())

  assert.deepEqual(JSON.parse(lint(root, '--json').stdout) as unknown, [])
})

test('lint run from inside the map folder of a map kept in a repository finds the hub at the repository root', () => {
  const root = tree(makeTree({ '.context-central/estate.json': { contextCentral: 1, name: 'solo' }, 'CLAUDE.md': '# Solo\n' }))

  const result = lint(join(root, '.context-central'))

  assert.deepEqual(result, { code: 0, stdout: 'ok\n', stderr: '' })
})

test('outside a map lint says there is none', () => {
  const root = tree(makeTree({ 'notes.md': '# Notes\n' }))

  const result = lint(root)

  assert.equal(result.code, 1)
  assert.match(result.stderr, /no context map found/)
})

test('a file in a work item that is neither Markdown nor under its evidence folder earns a warning', () => {
  const root = tree(acme({ 'work/PROJ-12/notes/shot.png': 'x'.repeat(300) }))

  const result = lint(root)

  assert.equal(result.stdout, 'WARN evidence: work/PROJ-12/notes/shot.png is not Markdown and is outside work/PROJ-12/evidence/\n')
  assert.equal(result.code, 0)
  assert.equal(lint(root, '--strict').code, 1)
})

test('dot names and files under the evidence folder are left alone', () => {
  const root = tree(acme({ 'work/PROJ-12/.DS_Store': 'xxxx', 'work/PROJ-12/notes/.keep': '', [ACME_SHOT]: 'x'.repeat(300) }))

  assert.equal(lint(root).stdout, 'ok\n')
})

test('a stray file is reported for a finished item and for a folder named evidence deeper down, and json carries it', () => {
  const root = tree(acme({ 'work/PROJ-9/STATE.md': '---\nstatus: done\n---\n# PROJ-9\n', 'work/PROJ-9/notes/evidence/trace.json': '{}' }))

  assert.deepEqual(JSON.parse(lint(root, '--json').stdout) as unknown, [
    {
      level: 'WARN',
      check: 'evidence',
      rel: 'work/PROJ-9/notes/evidence/trace.json',
      message: 'evidence: work/PROJ-9/notes/evidence/trace.json is not Markdown and is outside work/PROJ-9/evidence/',
    },
  ])
})

const RECORDING = 'work/PROJ-12/evidence/2026-01-15-demo.mov'
const COMMITTED = { evidence: { commit: true } }

test('where evidence is committed, an evidence file over the limit earns a warning', () => {
  const root = tree(acme({ [RECORDING]: 'x'.repeat(2 * 1024 * 1024) }, COMMITTED))

  const result = lint(root)

  assert.equal(result.stdout, 'WARN evidence: work/PROJ-12/evidence/2026-01-15-demo.mov is 2.0 MB (limit 1.0 MB)\n')
  assert.equal(result.code, 0)
  assert.equal(lint(root, '--strict').code, 1)
})

test('where evidence is not committed, or the map does not say, an evidence file may be any size', () => {
  const unset = tree(acme({ [RECORDING]: 'x'.repeat(2 * 1024 * 1024) }))
  const no = tree(acme({ [RECORDING]: 'x'.repeat(2 * 1024 * 1024) }, { evidence: { commit: false } }))

  assert.equal(lint(unset).stdout, 'ok\n')
  assert.equal(lint(no).stdout, 'ok\n')
})

test('an evidence file exactly on the limit passes, and one byte over does not', () => {
  const on = tree(acme({ [RECORDING]: 'x'.repeat(2048) }, { ...COMMITTED, budgets: { evidenceBytes: 2048 } }))
  const over = tree(acme({ [RECORDING]: 'x'.repeat(2049) }, { ...COMMITTED, budgets: { evidenceBytes: 2048 } }))

  assert.equal(lint(on).stdout, 'ok\n')
  assert.equal(lint(over).stdout, 'WARN evidence: work/PROJ-12/evidence/2026-01-15-demo.mov is 2.0 KB (limit 2.0 KB)\n')
})

test('a stray file is reported whether or not evidence is committed', () => {
  const root = tree(acme({ 'work/PROJ-12/notes/shot.png': 'x' }, COMMITTED))

  assert.equal(lint(root).stdout, 'WARN evidence: work/PROJ-12/notes/shot.png is not Markdown and is outside work/PROJ-12/evidence/\n')
})

test('a folder that holds only evidence earns the warning of an item with no entry file', () => {
  const root = tree(acme({ 'work/PROJ-14/evidence/2026-01-14-b.png': 'x' }))

  assert.equal(lint(root).stdout, 'WARN entry: PROJ-14 has no STATE.md and no other entry file\n')
})

test('a repo whose standards name a file that does not exist earns a warning', () => {
  const repos: Json[] = [{ name: 'web' }, { name: 'api', standards: ['standards/api.md', 'api/CONTRIBUTING.md'] }]
  const root = tree(acme({ 'standards/api.md': '# api\n' }, { repos }))

  const result = lint(root)

  assert.equal(result.stdout, 'WARN standards: repo api names api/CONTRIBUTING.md, which does not exist\n')
  assert.equal(result.code, 0)
  assert.equal(lint(root, '--strict').code, 1)
})

test('standards that all exist leave the map ok', () => {
  const repos: Json[] = [{ name: 'web' }, { name: 'api', standards: ['standards/api.md', 'api/README.md'] }]
  const root = tree(acme({ 'standards/api.md': '# api\n' }, { repos }))

  assert.equal(lint(root).stdout, 'ok\n')
})

test('a listed standards file that is a folder is warned about as one, and a file listed twice is warned about once', () => {
  const repos: Json[] = [{ name: 'web' }, { name: 'api', standards: ['api', 'api/docs/review.md', 'api/docs/review.md'] }]
  const root = tree(acme({}, { repos }))

  assert.equal(lint(root).stdout, 'WARN standards: repo api names api, which is a folder, not a file\nWARN standards: repo api names api/docs/review.md, which does not exist\n')
})

test('a map kept inside a repo is warned about a missing standards file counted from the estate root', () => {
  const app = { name: 'app', path: '.', standards: ['CONTRIBUTING.md'] }
  const root = tree(makeTree({ '.context-central/estate.json': { contextCentral: 1, name: 'acme', repos: [app] }, 'CLAUDE.md': '# Acme\n', '.context-central/standards/app.md': '# app\n' }))

  assert.equal(lint(root).stdout, 'WARN standards: repo app names CONTRIBUTING.md, which does not exist\n')
})
