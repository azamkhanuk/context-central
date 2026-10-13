import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { ACME_CONFIG, acme, acmeIndex, acmePointers, checkout, disposable, hook, makeTree, notOnWindows, run } from './helpers.mts'
import type { Result, Skip } from './helpers.mts'

const tree = disposable()

type Made = (root: string) => string[]

const BY_MODE = notOnWindows('a file or a folder on Windows is not closed to reading by its mode')
const LINKS = notOnWindows('symlinks need a right most Windows accounts lack')
const GRAPH = '7 nodes, 5 links\nORPHAN repos/web.md\nUNREFERENCED work/PROJ-12/sources/01-2026-01-09-PROJ-12-full-text.md\n'
const WORK_LIST = 'PROJ-12 | Rate limit the gateway | work/PROJ-12/STATE.md | 2 notes, 1 deep file (53 B)\n'

const closedFolder: Made = root => {
  mkdirSync(join(root, 'work/PROJ-12/closed'))
  chmodSync(join(root, 'work/PROJ-12/closed'), 0o000)
  return [join(root, 'work/PROJ-12/closed')]
}
const folderForANote: Made = root => {
  mkdirSync(join(root, 'work/PROJ-12.md'))
  return []
}
const linkToItself: Made = root => {
  symlinkSync(join(root, 'areas'), join(root, 'areas'))
  return []
}
const closedNote: Made = root => {
  writeFileSync(join(root, 'concepts/closed.md'), '# Closed\n')
  chmodSync(join(root, 'concepts/closed.md'), 0o000)
  return [join(root, 'concepts/closed.md')]
}
const linkToNowhere: Made = root => {
  symlinkSync(join(root, 'nowhere.md'), join(root, 'concepts/gone.md'))
  return []
}

const CASES: [what: string, rel: string, why: string, make: Made, skip: Skip][] = [
  ['a folder under a work item that cannot be read', 'work/PROJ-12/closed', 'cannot be read (EACCES)', closedFolder, BY_MODE],
  ["a folder where a work item's older note would be read", 'work/PROJ-12.md', 'is a folder where a note would be read', folderForANote, {}],
  ['a node folder that is a link to itself', 'areas', 'is a link that leads nowhere (ELOOP)', linkToItself, LINKS],
  ['a note that cannot be read', 'concepts/closed.md', 'cannot be read (EACCES)', closedNote, BY_MODE],
  ['a link among the notes that leads nowhere', 'concepts/gone.md', 'is a link that leads nowhere (ENOENT)', linkToNowhere, LINKS],
]

function withEntry<Answer>(root: string, make: Made, ask: () => Answer) {
  const closed = make(root)
  try {
    return ask()
  } finally {
    for (const path of closed) chmodSync(path, 0o755)
  }
}

const context = (result: Result) => (JSON.parse(result.stdout) as { hookSpecificOutput: { additionalContext: string } }).hookSpecificOutput.additionalContext
const fire = (event: string, input: object) => hook(event, input, { env: { CONTEXT_CENTRAL_STATE_DIR: tree(makeTree({})) } })

for (const [what, rel, why, make, skip] of CASES) {
  test(`with ${what} in the map, the listings and both hooks answer as if it were not there`, skip, () => {
    const root = tree(acme())

    const said = withEntry(root, make, () => ({
      index: run(['index', '--absolute'], { cwd: root }),
      resolve: run(['resolve', 'PROJ-12', '--absolute'], { cwd: root }),
      graph: run(['graph'], { cwd: root }),
      list: run(['work', 'list'], { cwd: root }),
      started: fire('session-start', { session_id: 's1', cwd: root, source: 'startup' }),
      prompted: fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'pick up PROJ-12' }),
    }))

    assert.deepEqual(said.index, { code: 0, stdout: `${acmeIndex(root)}\n`, stderr: '' })
    assert.deepEqual(said.resolve, { code: 0, stdout: `${acmePointers(root)}\n`, stderr: '' })
    assert.deepEqual(said.graph, { code: 0, stdout: GRAPH, stderr: '' })
    assert.deepEqual(said.list, { code: 0, stdout: WORK_LIST, stderr: '' })
    assert.equal(context(said.started), acmeIndex(root))
    assert.equal(context(said.prompted), acmePointers(root))
  })

  test(`lint reports ${what} as one error that names it, and the lint row of doctor says FIX`, skip, () => {
    const root = tree(acme())

    const { lint, doctor } = withEntry(root, make, () => ({ lint: run(['lint'], { cwd: root }), doctor: run(['doctor'], { cwd: root }) }))

    assert.deepEqual(lint, { code: 1, stdout: `ERROR read: ${rel} ${why}, so the listings pass over it\n`, stderr: '' })
    assert.equal(doctor.stderr, '')
    assert.equal(doctor.code, 1)
    assert.deepEqual(doctor.stdout.split('\n').filter(line => line.startsWith('FIX')), ['FIX  lint: 1 error; run context-central lint'])
  })
}

test('lint gives what the listings pass over as a finding of its own kind in JSON', () => {
  const root = tree(acme())
  folderForANote(root)

  const result = run(['lint', '--json'], { cwd: root })

  assert.equal(result.code, 1)
  assert.deepEqual(JSON.parse(result.stdout) as unknown, [{ level: 'ERROR', check: 'read', rel: 'work/PROJ-12.md', message: 'read: work/PROJ-12.md is a folder where a note would be read, so the listings pass over it' }])
})

test('a work folder that cannot be listed is no work in flight, and lint names it', BY_MODE, () => {
  const root = tree(makeTree({ 'estate.json': { contextCentral: 1, name: 'acme' }, 'CLAUDE.md': '# Acme\n', 'work/PROJ-1/STATE.md': '# PROJ-1\n' }))

  const { list, lint } = withEntry(root, () => (chmodSync(join(root, 'work'), 0o000), [join(root, 'work')]), () => ({ list: run(['work', 'list'], { cwd: root }), lint: run(['lint'], { cwd: root }) }))

  assert.deepEqual(list, { code: 0, stdout: 'No work in flight.\n', stderr: '' })
  assert.deepEqual(lint, { code: 1, stdout: 'ERROR read: work cannot be read (EACCES), so the listings pass over it\n', stderr: '' })
})

test('a link among the notes that leads to a file is passed over and nothing is said of it', LINKS, () => {
  const root = tree(acme({ 'kept/elsewhere.md': '# Elsewhere\n' }))
  symlinkSync(join(root, 'kept/elsewhere.md'), join(root, 'concepts/linked.md'))

  assert.deepEqual(run(['lint'], { cwd: root }), { code: 0, stdout: 'ok\n', stderr: '' })
  assert.equal(run(['graph'], { cwd: root }).stdout, GRAPH)
})

test('a folder at the place of a repo note is no repo note, to a prompt that names the repo and to an item that names it', () => {
  const repos = [...ACME_CONFIG.repos, { name: 'billing', role: 'invoices', baseBranch: 'main' }]
  const state = '---\nitem: PROJ-13\ntitle: Bill by the call\nstatus: active\n---\n# PROJ-13: Bill by the call\n\nThe change is in billing.\n'
  const root = tree(acme({ 'repos/billing.md/kept.txt': 'x', 'work/PROJ-13/STATE.md': state }, { repos }))

  const byName = run(['resolve', 'billing'], { cwd: root })
  const byItem = run(['resolve', 'PROJ-13'], { cwd: root })

  assert.deepEqual(byName, { code: 0, stdout: 'No confident match for "billing".\n', stderr: '' })
  assert.deepEqual(byItem, { code: 0, stdout: `Context for work item PROJ-13:\n- work/PROJ-13/STATE.md (${Buffer.byteLength(state)} B) state file: where the work stands and what is next\n`, stderr: '' })
})

test('doctor answers for a map kept in git that has a node folder which is a link to itself', LINKS, () => {
  const made = checkout({ 'estate.json': { contextCentral: 1, name: 'acme' }, 'CLAUDE.md': '# Acme\n', 'concepts/gateway.md': '# The gateway\n' }, 'acme')
  tree(made.base)
  symlinkSync(join(made.main, 'areas'), join(made.main, 'areas'))

  const result = run(['doctor'], { cwd: made.main, env: made.env })

  assert.equal(result.stderr, '')
  assert.deepEqual(result.stdout.split('\n').filter(line => line.startsWith('FIX')), ['FIX  lint: 1 error; run context-central lint'])
})
