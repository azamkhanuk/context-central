import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { acme, disposable, run } from './helpers.mts'

const tree = disposable()

const add = (root, ...args) => run(['evidence', 'add', ...args], { cwd: root })
const held = root => readdirSync(join(root, 'work/PROJ-12/evidence'))

test('a file is copied into the item\'s evidence folder under the day and a cleaned name', () => {
  const root = tree(acme({ 'scratch/Limit Reached (2).PNG': 'x'.repeat(300) }))

  const result = add(root, 'scratch/Limit Reached (2).PNG', '--item', 'PROJ-12')

  assert.deepEqual(result, { code: 0, stdout: 'saved: work/PROJ-12/evidence/2026-01-15-limit-reached-2.png (300 B)\n', stderr: '' })
  assert.equal(readFileSync(join(root, 'work/PROJ-12/evidence/2026-01-15-limit-reached-2.png'), 'utf8'), 'x'.repeat(300))
  assert.equal(existsSync(join(root, 'scratch/Limit Reached (2).PNG')), true)
})

test('what follows the last dot is an extension only when it is letters and digits', () => {
  const root = tree(acme({ 'scratch/a.My Ext': 'x', 'scratch/notes v1.2 final': 'x', 'scratch/Trace.JSON5': 'x' }))

  const spaced = add(root, 'scratch/a.My Ext', '--item', 'PROJ-12')
  const versioned = add(root, 'scratch/notes v1.2 final', '--item', 'PROJ-12')
  const plain = add(root, 'scratch/Trace.JSON5', '--item', 'PROJ-12')

  assert.equal(spaced.stdout, 'saved: work/PROJ-12/evidence/2026-01-15-a-my-ext (1 B)\n')
  assert.equal(versioned.stdout, 'saved: work/PROJ-12/evidence/2026-01-15-notes-v1-2-final (1 B)\n')
  assert.equal(plain.stdout, 'saved: work/PROJ-12/evidence/2026-01-15-trace.json5 (1 B)\n')
})

test('the words of the name can be given', () => {
  const root = tree(acme({ 'scratch/IMG_0042.png': 'x' }))

  const result = add(root, 'scratch/IMG_0042.png', '--item', 'PROJ-12', '--as', 'Limit reached: 429')

  assert.equal(result.stdout, 'saved: work/PROJ-12/evidence/2026-01-15-limit-reached-429.png (1 B)\n')
})

test('a name that already starts with a date keeps that date', () => {
  const root = tree(acme({ 'scratch/2026-01-09 Before.png': 'x', 'scratch/after.png': 'x' }))

  const fromName = add(root, 'scratch/2026-01-09 Before.png', '--item', 'PROJ-12')
  const fromWords = add(root, 'scratch/after.png', '--item', 'PROJ-12', '--as', '2026-01-10-after')

  assert.equal(fromName.stdout, 'saved: work/PROJ-12/evidence/2026-01-09-before.png (1 B)\n')
  assert.equal(fromWords.stdout, 'saved: work/PROJ-12/evidence/2026-01-10-after.png (1 B)\n')
})

test('a leading date that is not a day of the calendar is kept as words under today', () => {
  const root = tree(acme({ 'scratch/2025-13-45-old.mov': 'x', 'scratch/2025-02-30 Late.png': 'x' }))

  const noSuchMonth = add(root, 'scratch/2025-13-45-old.mov', '--item', 'PROJ-12')
  const noSuchDay = add(root, 'scratch/2025-02-30 Late.png', '--item', 'PROJ-12')

  assert.equal(noSuchMonth.stdout, 'saved: work/PROJ-12/evidence/2026-01-15-2025-13-45-old.mov (1 B)\n')
  assert.equal(noSuchDay.stdout, 'saved: work/PROJ-12/evidence/2026-01-15-2025-02-30-late.png (1 B)\n')
})

test('the folder is made when it is missing, and work list then counts the file', () => {
  const root = tree(acme({ 'scratch/trace.json': 'x'.repeat(50) }))
  run(['work', 'new', 'PROJ-13'], { cwd: root })
  const before = existsSync(join(root, 'work/PROJ-12/evidence'))

  add(root, 'scratch/trace.json', '--item', 'PROJ-12')
  add(root, join(root, 'scratch/trace.json'), '--item', 'proj-13')

  assert.equal(before, false)
  assert.deepEqual(held(root), ['2026-01-15-trace.json'])
  assert.deepEqual(
    JSON.parse(run(['work', 'list', '--json'], { cwd: root }).stdout).map(item => [item.id, item.evidence]),
    [['PROJ-12', { count: 1, bytes: 50 }], ['PROJ-13', { count: 1, bytes: 50 }]],
  )
})

test('a name already taken is refused and nothing is overwritten', () => {
  const root = tree(acme({ 'scratch/trace.json': 'new', 'work/PROJ-12/evidence/2026-01-15-trace.json': 'old' }))

  const result = add(root, 'scratch/trace.json', '--item', 'PROJ-12')

  assert.deepEqual(result, { code: 1, stdout: '', stderr: 'context-central evidence: work/PROJ-12/evidence/2026-01-15-trace.json already exists; give other words with --as\n' })
  assert.equal(readFileSync(join(root, 'work/PROJ-12/evidence/2026-01-15-trace.json'), 'utf8'), 'old')
})

test('a missing file, a folder, an unknown item and a name with nothing left of it are each refused', () => {
  const root = tree(acme({ 'scratch/trace.json': 'x', 'scratch/---.png': 'x' }))
  const refused = (...args) => add(root, ...args)

  assert.deepEqual(refused('scratch/gone.png', '--item', 'PROJ-12'), { code: 1, stdout: '', stderr: 'context-central evidence: no file at scratch/gone.png\n' })
  assert.deepEqual(refused('scratch', '--item', 'PROJ-12'), { code: 1, stdout: '', stderr: 'context-central evidence: scratch is a folder, not a file\n' })
  assert.deepEqual(refused('scratch/trace.json', '--item', 'PROJ-99'), { code: 1, stdout: '', stderr: 'context-central evidence: no work item "PROJ-99"\n' })
  assert.deepEqual(refused('scratch/---.png', '--item', 'PROJ-12'), {
    code: 1,
    stdout: '',
    stderr: 'context-central evidence: nothing is left of the name "---" once it is cleaned; give the words with --as\n',
  })
  assert.deepEqual(refused('scratch/trace.json', '--item', 'PROJ-12', '--as', '2026-01-09'), {
    code: 1,
    stdout: '',
    stderr: 'context-central evidence: nothing is left of the name "2026-01-09" once it is cleaned; give the words with --as\n',
  })
  assert.equal(existsSync(join(root, 'work/PROJ-12/evidence')), false)
})

test('no file, no item, or an action other than add is wrong usage', () => {
  const root = tree(acme({ 'scratch/trace.json': 'x' }))

  for (const args of [['add', '--item', 'PROJ-12'], ['add', 'scratch/trace.json'], ['move', 'scratch/trace.json', '--item', 'PROJ-12'], []]) {
    const result = run(['evidence', ...args], { cwd: root })

    assert.equal(result.code, 2, args.join(' '))
    assert.equal(result.stderr, 'context-central evidence: expected: evidence add <file> --item <item> [--as <what>]\n')
  }
  assert.equal(existsSync(join(root, 'work/PROJ-12/evidence')), false)
})
