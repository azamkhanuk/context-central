import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { ACME_FILES, acme, disposable, run } from './helpers.mjs'

const tree = disposable()

const list = (root, ...flags) => JSON.parse(run(['work', 'list', '--json', ...flags], { cwd: root }).stdout)
const sizeOf = text => Buffer.byteLength(text)

test('a new work item gets a state file with its six parts', () => {
  const root = tree(acme())

  const result = run(['work', 'new', 'PROJ-13', '--title', 'Cache the gateway'], { cwd: root })

  assert.equal(result.code, 0)
  assert.match(result.stdout, /work\/PROJ-13\/STATE\.md/)
  const state = readFileSync(join(root, 'work/PROJ-13/STATE.md'), 'utf8')
  assert.match(state, /^---\nitem: PROJ-13\ntitle: Cache the gateway\nstatus: active\n---\n/)
  for (const part of ['Where it stands', 'Done', 'Next', 'Blocked', 'Standing traps', 'Where the detail lives']) {
    assert.match(state, new RegExp(`^## ${part}$`, 'm'))
  }
})

test('a new work item gets folders for its notes, its sources and its evidence', () => {
  const root = tree(acme())

  run(['work', 'new', 'PROJ-13'], { cwd: root })

  for (const folder of ['notes', 'sources', 'evidence']) assert.equal(existsSync(join(root, 'work/PROJ-13', folder)), true, folder)
})

test('a new state file says where evidence that is not text goes', () => {
  const root = tree(acme())

  run(['work', 'new', 'PROJ-13'], { cwd: root })

  const state = readFileSync(join(root, 'work/PROJ-13/STATE.md'), 'utf8')
  assert.match(state, /^- Evidence that is not text \(screenshots, recordings, exports\): `evidence\/`, each file named in a note\.$/m)
})

test('creating an item that already exists is refused', () => {
  const root = tree(acme())

  const result = run(['work', 'new', 'PROJ-12'], { cwd: root })

  assert.equal(result.code, 1)
  assert.match(result.stderr, /PROJ-12 already exists/)
})

test('an item name that would leave the work folder is refused', () => {
  const root = tree(acme())

  assert.equal(run(['work', 'new', '../escape'], { cwd: root }).code, 2)
})

test('the list shows what is in flight, with its state file and what lies behind it', () => {
  const root = tree(acme())

  assert.deepEqual(list(root), [
    {
      id: 'PROJ-12',
      title: 'Rate limit the gateway',
      status: 'active',
      entry: { rel: 'work/PROJ-12/STATE.md', kind: 'state', bytes: sizeOf(ACME_FILES['work/PROJ-12/STATE.md']) },
      notes: 2,
      deep: { count: 1, bytes: sizeOf(ACME_FILES['work/PROJ-12/sources/01-2026-01-09-PROJ-12-full-text.md']) },
      evidence: { count: 0, bytes: 0 },
    },
  ])
})

test('a finished item drops out of the list unless asked for', () => {
  const root = tree(acme())

  assert.equal(run(['work', 'done', 'PROJ-12'], { cwd: root }).code, 0)

  assert.deepEqual(list(root), [])
  assert.equal(list(root, '--all')[0].status, 'done')
})

test('a reopened item is in flight again', () => {
  const root = tree(acme())
  run(['work', 'done', 'PROJ-12'], { cwd: root })

  run(['work', 'reopen', 'PROJ-12'], { cwd: root })

  assert.equal(list(root)[0].status, 'active')
})

test('marking an item done and reopening it changes the status line and nothing else', () => {
  const state = '---\nitem: PROJ-50\ntitle: "Limits: per route"\n# reviewed with the team\ntags:\n  - gateway\n  - limits\nstatus: active\n---\n# PROJ-50\n'
  const root = tree(acme({ 'work/PROJ-50/STATE.md': state }))
  const held = () => readFileSync(join(root, 'work/PROJ-50/STATE.md'), 'utf8')

  run(['work', 'done', 'PROJ-50'], { cwd: root })
  const done = held()
  run(['work', 'reopen', 'PROJ-50'], { cwd: root })

  assert.equal(done, state.replace('status: active', 'status: done'))
  assert.equal(held(), state)
})

test('a status line is added at the end of the frontmatter, or with a new block when there is none', () => {
  const root = tree(
    acme({
      'work/PROJ-51/STATE.md': '---\ntitle: "No status yet"\ntags:\n  - gateway\n---\n# PROJ-51\n',
      'work/PROJ-52/STATE.md': '# PROJ-52\n',
    }),
  )

  run(['work', 'done', 'PROJ-51'], { cwd: root })
  run(['work', 'done', 'PROJ-52'], { cwd: root })

  assert.equal(readFileSync(join(root, 'work/PROJ-51/STATE.md'), 'utf8'), '---\ntitle: "No status yet"\ntags:\n  - gateway\nstatus: done\n---\n# PROJ-51\n')
  assert.equal(readFileSync(join(root, 'work/PROJ-52/STATE.md'), 'utf8'), '---\nstatus: done\n---\n# PROJ-52\n')
})

test('done and reopen with no item are wrong usage', () => {
  const root = tree(acme())

  assert.equal(run(['work', 'done'], { cwd: root }).code, 2)
  assert.equal(run(['work', 'reopen'], { cwd: root }).code, 2)
})

test('a flag that belongs to another action is wrong usage and changes nothing', () => {
  const root = tree(acme())

  assert.equal(run(['work', 'new', 'PROJ-13', '--json'], { cwd: root }).code, 2)
  assert.equal(run(['work', 'done', 'PROJ-12', '--all'], { cwd: root }).code, 2)
  assert.equal(run(['work', 'reopen', 'PROJ-12', '--json'], { cwd: root }).code, 2)
  assert.equal(run(['work', 'list', '--title', 'Cache the gateway'], { cwd: root }).code, 2)
  assert.equal(run(['work', 'done', 'PROJ-12', '--title', 'Cache the gateway'], { cwd: root }).code, 2)
  assert.deepEqual(
    list(root, '--all').map(item => [item.id, item.status]),
    [['PROJ-12', 'active']],
  )
})

test('a note with no folder is still a work item', () => {
  const note = '# PROJ-7: Old shape\n\nWritten before state files.\n'
  const root = tree(acme({ 'work/PROJ-7.md': note }))

  const item = list(root).find(found => found.id === 'PROJ-7')

  assert.equal(item.title, 'Old shape')
  assert.deepEqual(item.entry, { rel: 'work/PROJ-7.md', kind: 'note', bytes: sizeOf(note) })
})

test('a start-here file is the entry when there is no state file', () => {
  const root = tree(acme({ 'work/PROJ-9/00-START-HERE.md': '# Start here\n', 'work/PROJ-9/01-notes.md': '# Notes\n' }))

  const item = list(root).find(found => found.id === 'PROJ-9')

  assert.equal(item.entry.kind, 'start-here')
  assert.equal(item.notes, 1)
})

test('a full-text note counts as the deep tier wherever it sits', () => {
  const root = tree(acme({ 'work/PROJ-9/STATE.md': '# PROJ-9\n', 'work/PROJ-9/05-2026-01-02-PROJ-9-full-text.md': 'long\n' }))

  const item = list(root).find(found => found.id === 'PROJ-9')

  assert.deepEqual(item.deep, { count: 1, bytes: 5 })
  assert.equal(item.notes, 0)
})

test('items are listed in natural order', () => {
  const root = tree(acme({ 'work/PROJ-2/STATE.md': '# PROJ-2\n', 'work/PROJ-100/STATE.md': '# PROJ-100\n' }))

  assert.deepEqual(list(root).map(item => item.id), ['PROJ-2', 'PROJ-12', 'PROJ-100'])
})

test('the plain list names each state file', () => {
  const root = tree(acme())

  const result = run(['work', 'list'], { cwd: root })

  assert.match(result.stdout, /PROJ-12 \| Rate limit the gateway \| work\/PROJ-12\/STATE\.md \| 2 notes, 1 deep file \(\d+ B\)$/m)
})

test('one note and several deep files are counted in plain English', () => {
  const root = tree(acme({ 'work/PROJ-9/STATE.md': '# PROJ-9\n', 'work/PROJ-9/plan.md': '# Plan\n', 'work/PROJ-9/sources/a.md': 'a\n', 'work/PROJ-9/sources/b.md': 'b\n' }))

  const result = run(['work', 'list'], { cwd: root })

  assert.match(result.stdout, /^PROJ-9 \| .* \| 1 note, 2 deep files \(4 B\)$/m)
})

test('files of any type under an item\'s evidence folder are counted as its evidence', () => {
  const root = tree(acme({ 'work/PROJ-12/evidence/2026-01-14-limit-reached.png': 'x'.repeat(300), 'work/PROJ-12/evidence/2026-01-14-trace.json': 'x'.repeat(50) }))

  const item = list(root)[0]

  assert.deepEqual(item.evidence, { count: 2, bytes: 350 })
  assert.equal(item.notes, 2)
  assert.equal(item.deep.count, 1)
})

test('a dot name under the evidence folder is not counted', () => {
  const root = tree(acme({ 'work/PROJ-12/evidence/.DS_Store': 'xxxx', 'work/PROJ-12/evidence/2026-01-14-limit-reached.png': 'x'.repeat(300) }))

  assert.deepEqual(list(root)[0].evidence, { count: 1, bytes: 300 })
})

test('a Markdown file under the evidence folder is evidence and not a note', () => {
  const root = tree(acme({ 'work/PROJ-12/evidence/2026-01-14-export.md': 'x'.repeat(40), 'work/PROJ-12/evidence/sources/2026-01-14-inner-full-text.md': 'x'.repeat(60) }))

  const item = list(root)[0]

  assert.deepEqual(item.evidence, { count: 2, bytes: 100 })
  assert.equal(item.notes, 2)
  assert.equal(item.deep.count, 1)
})

test('a file that is not Markdown outside the evidence folder is neither a note nor evidence', () => {
  const root = tree(acme({ 'work/PROJ-12/notes/shot.png': 'x'.repeat(300), 'work/PROJ-12/notes/evidence/deeper.png': 'x'.repeat(300) }))

  const item = list(root)[0]

  assert.deepEqual(item.evidence, { count: 0, bytes: 0 })
  assert.equal(item.notes, 2)
})

test('the plain list adds the evidence of an item that has some', () => {
  const root = tree(acme({ 'work/PROJ-12/evidence/2026-01-14-limit-reached.png': 'x'.repeat(300), 'work/PROJ-12/evidence/2026-01-14-trace.json': 'x'.repeat(50) }))

  const result = run(['work', 'list'], { cwd: root })

  assert.equal(result.stdout, 'PROJ-12 | Rate limit the gateway | work/PROJ-12/STATE.md | 2 notes, 1 deep file (53 B), 2 evidence files (350 B)\n')
})

test('the plain list says nothing of evidence for an item with none', () => {
  const root = tree(acme())

  const result = run(['work', 'list'], { cwd: root })

  assert.equal(result.stdout, 'PROJ-12 | Rate limit the gateway | work/PROJ-12/STATE.md | 2 notes, 1 deep file (53 B)\n')
})

test('a folder that holds only evidence is a work item with no entry file', () => {
  const root = tree(acme({ 'work/PROJ-14/evidence/2026-01-14-b.png': 'x'.repeat(300) }))

  const result = run(['work', 'list'], { cwd: root })

  assert.equal(result.stdout.split('\n')[1], 'PROJ-14 | PROJ-14 | no entry file | 0 notes, 0 deep files (0 B), 1 evidence file (300 B)')
})

const BOM = '\uFEFF'
const crlf = text => text.replaceAll('\n', '\r\n')
const CACHE_STATE = '---\nitem: PROJ-60\ntitle: Cache the gateway\nstatus: active\n---\n# PROJ-60: a heading that is not the title\n\n## Next\n\nMeasure first.\n'
const AS_FOUND = { 'Windows line endings': crlf(CACHE_STATE), 'a byte-order mark': BOM + CACHE_STATE, both: BOM + crlf(CACHE_STATE) }

for (const [how, state] of Object.entries(AS_FOUND)) {
  test(`a state file with ${how} is listed with the title and status of its frontmatter`, () => {
    const root = tree(acme({ 'work/PROJ-60/STATE.md': state.replace('status: active', 'status: done') }))

    const [item] = list(root, '--all').filter(listed => listed.id === 'PROJ-60')

    assert.equal(item.title, 'Cache the gateway')
    assert.equal(item.status, 'done')
  })

  test(`marking an item done and reopening it changes one line of a state file with ${how}`, () => {
    const root = tree(acme({ 'work/PROJ-60/STATE.md': state }))
    const held = () => readFileSync(join(root, 'work/PROJ-60/STATE.md'), 'utf8')

    run(['work', 'done', 'PROJ-60'], { cwd: root })
    const done = held()
    run(['work', 'reopen', 'PROJ-60'], { cwd: root })

    assert.equal(done, state.replace('status: active', 'status: done'))
    assert.equal(held(), state)
  })
}

test('a status line added to frontmatter with Windows line endings ends as the others do', () => {
  const root = tree(acme({ 'work/PROJ-61/STATE.md': '---\r\ntitle: No status yet\r\n---\r\n# PROJ-61\r\n' }))

  run(['work', 'done', 'PROJ-61'], { cwd: root })

  assert.equal(readFileSync(join(root, 'work/PROJ-61/STATE.md'), 'utf8'), '---\r\ntitle: No status yet\r\nstatus: done\r\n---\r\n# PROJ-61\r\n')
})

test('a new frontmatter block takes the line ending the file uses and sits after a byte-order mark', () => {
  const root = tree(
    acme({
      'work/PROJ-62/STATE.md': '# PROJ-62\r\n\r\nMeasure first.\r\n',
      'work/PROJ-63/STATE.md': `${BOM}# PROJ-63\n`,
      'work/PROJ-64/STATE.md': '# PROJ-64',
    }),
  )
  const after = item => {
    run(['work', 'done', item], { cwd: root })
    return readFileSync(join(root, 'work', item, 'STATE.md'), 'utf8')
  }

  assert.equal(after('PROJ-62'), '---\r\nstatus: done\r\n---\r\n# PROJ-62\r\n\r\nMeasure first.\r\n')
  assert.equal(after('PROJ-63'), `${BOM}---\nstatus: done\n---\n# PROJ-63\n`)
  assert.equal(after('PROJ-64'), '---\nstatus: done\n---\n# PROJ-64')
})
