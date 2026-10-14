import assert from 'node:assert/strict'
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, statSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { LOCK, acme, disposable, leftByAWrite, makeTree, notOnWindows, run, staleLock, together } from './helpers.mts'
import type { TreeFiles } from './helpers.mts'

const tree = disposable()

const BREAKER = `${LOCK}.break`
const ITS_BREAKER = `${BREAKER}.break`
const JANUARY = 'log/2026-01.md'
const EARLIER = Array.from({ length: 300 }, (_, at) => `- earlier ${at}`)
const LOG = `# 2026-01\n\n## 2026-01-15\n\n${EARLIER.join('\n')}\n`
const HELD = 'context-central note: the map is being written by another command, and still was after 5 seconds, so nothing was written; run this again\n'
const BY_MODE = notOnWindows('a file on Windows is not closed to writing by its mode in the same way')
const LINKS = notOnWindows('symlinks need a right most Windows accounts lack')

const note = (root: string, text: string) => run(['note', text], { cwd: root, env: { TZ: 'UTC' } })
const read = (root: string, rel: string) => readFileSync(join(root, rel), 'utf8')
const hidden = (dir: string) => readdirSync(dir).filter(name => name.startsWith('.'))

const IN_THE_WAY = {
  'no lock in the way': [],
  'a lock thirty seconds old in the way': [LOCK],
  'such a lock and a breaker as old in the way': [LOCK, BREAKER],
  "such a lock, a breaker and that breaker's own breaker, all as old, in the way": [LOCK, BREAKER, ITS_BREAKER],
}

for (const [what, stale] of Object.entries(IN_THE_WAY)) {
  test(`twenty notes written at once, with ${what}, are all in the log below every earlier line`, async () => {
    const root = tree(acme({ [JANUARY]: LOG }))
    for (const name of stale) staleLock(root, name)
    const texts = Array.from({ length: 20 }, (_, at) => `new ${at}`)

    const results = await together(texts.map(text => ({ args: ['note', text], options: { cwd: root, env: { TZ: 'UTC' } } })))

    const log = read(root, JANUARY)
    assert.deepEqual(results.map(result => result.stderr + result.code), texts.map(() => '0'))
    assert.equal(log.slice(0, LOG.length), LOG)
    assert.deepEqual(log.slice(LOG.length).trimEnd().split('\n').sort(), texts.map(text => `- ${text}`).sort())
    assert.deepEqual([...hidden(root), ...hidden(join(root, 'log'))], [])
  })
}

test('a note that finds the lock held waits five seconds, then stops with one line, and the log is as it was', () => {
  const root = tree(acme({ [JANUARY]: LOG }))
  mkdirSync(join(root, LOCK))
  const from = Date.now()

  const result = note(root, 'Too late')

  assert.ok(Date.now() - from >= 5000)
  assert.deepEqual(result, { code: 1, stdout: '', stderr: HELD })
  assert.equal(read(root, JANUARY), LOG)
  assert.deepEqual(hidden(root), [LOCK])
})

test('a lock thirty seconds old is taken over, the note is written and the lock is gone', () => {
  const root = tree(acme())
  staleLock(root)

  const result = note(root, 'Gateway limits agreed')

  assert.deepEqual(result, { code: 0, stdout: `${JANUARY}\n`, stderr: '' })
  assert.equal(read(root, JANUARY), '# 2026-01\n\n## 2026-01-15\n\n- Gateway limits agreed\n')
  assert.deepEqual(hidden(root), [])
})

test('a breaker left by a process that died is not removed while another command holds the breaker of that breaker: the note waits and stops', () => {
  const root = tree(acme({ [JANUARY]: LOG }))
  staleLock(root)
  staleLock(root, BREAKER)
  mkdirSync(join(root, ITS_BREAKER))

  const result = note(root, 'Too late')

  assert.deepEqual(result, { code: 1, stdout: '', stderr: HELD })
  assert.equal(read(root, JANUARY), LOG)
  assert.deepEqual(hidden(root).sort(), [LOCK, BREAKER, ITS_BREAKER])
})

test('a note leaves nothing beside the log but the log', () => {
  const root = tree(acme())

  note(root, 'Gateway limits agreed')
  note(root, 'Limiter goes in api')

  assert.deepEqual(readdirSync(join(root, 'log')), ['2026-01.md'])
  assert.deepEqual(hidden(root), [])
})

test('a log that is closed to writing is not replaced: one line names it and the code, and it is as it was', BY_MODE, () => {
  const root = tree(acme({ [JANUARY]: LOG }))
  chmodSync(join(root, JANUARY), 0o444)

  const result = note(root, 'Not written')

  assert.equal(result.code, 1)
  assert.equal(result.stderr, `context-central note: EACCES: permission denied, access '${join(root, JANUARY)}'. Set CONTEXT_CENTRAL_DEBUG=1 to see the trace.\n`)
  assert.equal(read(root, JANUARY), LOG)
  assert.deepEqual([...hidden(root), ...hidden(join(root, 'log'))], [])
})

test('a log keeps the mode it had when a note is added to it', BY_MODE, () => {
  const root = tree(acme({ [JANUARY]: LOG }))
  chmodSync(join(root, JANUARY), 0o600)

  note(root, 'Gateway limits agreed')

  assert.equal(statSync(join(root, JANUARY)).mode & 0o777, 0o600)
  assert.equal(read(root, JANUARY), `${LOG}- Gateway limits agreed\n`)
})

test('a log that is a link stays a link, and the note lands in the file it leads to', LINKS, () => {
  const root = tree(acme({ 'kept/january.md': LOG }))
  mkdirSync(join(root, 'log'))
  symlinkSync(join(root, 'kept', 'january.md'), join(root, JANUARY))

  note(root, 'Gateway limits agreed')

  assert.equal(lstatSync(join(root, JANUARY)).isSymbolicLink(), true)
  assert.equal(read(root, 'kept/january.md'), `${LOG}- Gateway limits agreed\n`)
  assert.deepEqual([...hidden(join(root, 'kept')), ...hidden(join(root, 'log'))], [])
})

test('a log that is a link to a file not yet there stays a link, and the note makes the file it leads to', LINKS, () => {
  const root = tree(acme({ 'kept/README.md': '# Kept\n' }))
  mkdirSync(join(root, 'log'))
  symlinkSync(join(root, 'kept', 'january.md'), join(root, JANUARY))

  const result = note(root, 'Gateway limits agreed')

  assert.deepEqual(result, { code: 0, stdout: `${JANUARY}\n`, stderr: '' })
  assert.equal(lstatSync(join(root, JANUARY)).isSymbolicLink(), true)
  assert.equal(read(root, 'kept/january.md'), '# 2026-01\n\n## 2026-01-15\n\n- Gateway limits agreed\n')
  assert.deepEqual([...hidden(join(root, 'kept')), ...hidden(join(root, 'log'))], [])
})

test('a log that is a relative link to a file not yet there is followed from the real folder it sits in', LINKS, () => {
  const root = tree(acme({ 'stored/README.md': '# Stored\n' }))
  mkdirSync(join(root, 'stored', 'log'))
  symlinkSync(join(root, 'stored', 'log'), join(root, 'log'))
  symlinkSync(join('..', 'january.md'), join(root, 'stored', 'log', '2026-01.md'))

  const result = note(root, 'Gateway limits agreed')

  assert.deepEqual(result, { code: 0, stdout: `${JANUARY}\n`, stderr: '' })
  assert.equal(read(root, 'stored/january.md'), '# 2026-01\n\n## 2026-01-15\n\n- Gateway limits agreed\n')
  assert.equal(existsSync(join(root, 'january.md')), false)
  assert.equal(lstatSync(join(root, 'stored', 'log', '2026-01.md')).isSymbolicLink(), true)
})

const TAKERS: [what: string, files: TreeFiles, args: string[], written: string][] = [
  ['note --new', {}, ['note', '--new', 'concepts/limits'], 'concepts/limits.md'],
  ['work new', {}, ['work', 'new', 'PROJ-13'], 'work/PROJ-13/STATE.md'],
  ['work adopt', { 'work/PROJ-7.md': '# PROJ-7: Old shape\n' }, ['work', 'adopt', 'PROJ-7'], 'work/PROJ-7/STATE.md'],
  ['work done', {}, ['work', 'done', 'PROJ-12'], 'work/PROJ-12/STATE.md'],
  ['work reopen', {}, ['work', 'reopen', 'PROJ-12'], 'work/PROJ-12/STATE.md'],
  ['evidence add', { 'scratch/shot.png': 'x' }, ['evidence', 'add', 'scratch/shot.png', '--item', 'PROJ-12'], 'work/PROJ-12/evidence/2026-01-15-shot.png'],
  ['wrapper --write', {}, ['wrapper', '--write'], 'bin/context-central'],
]

for (const [what, files, args, written] of TAKERS) {
  test(`${what} takes the map lock: one thirty seconds old is taken over, and nothing but what was written is left`, () => {
    const root = tree(acme(files))
    staleLock(root)

    const result = run(args, { cwd: root, env: { TZ: 'UTC' } })

    assert.equal(result.stderr, '')
    assert.equal(result.code, 0)
    assert.equal(existsSync(join(root, written)), true)
    assert.deepEqual(leftByAWrite(root), [])
  })
}

for (const layout of ['root', 'inner']) {
  test(`init of a map with the ${layout} layout takes the map lock in the map's folder, which it makes first, and leaves none there`, () => {
    const root = tree(makeTree({ 'answers.json': { layout, config: { name: 'acme' } } }))
    const mapDir = layout === 'inner' ? join(root, '.context-central') : root
    mkdirSync(mapDir, { recursive: true })
    staleLock(mapDir)

    const result = run(['init', '--from', 'answers.json'], { cwd: root })

    assert.equal(result.stderr, '')
    assert.equal(result.code, 0)
    assert.equal(existsSync(join(mapDir, 'estate.json')), true)
    assert.deepEqual(leftByAWrite(root), [])
  })
}

test('a dry run of init takes no lock and makes no folder for one', () => {
  const root = tree(makeTree({ 'answers.json': { layout: 'root', config: { name: 'acme' } } }))
  const lock = staleLock(root)

  const result = run(['init', '--from', 'answers.json', '--dry-run'], { cwd: root })

  assert.equal(result.code, 0)
  assert.equal(existsSync(lock), true)
  assert.deepEqual(readdirSync(root).sort(), [LOCK, 'answers.json'])
})

test('answers that are refused for a map with the inner layout leave no map folder behind', () => {
  const root = tree(makeTree({ 'answers.json': { layout: 'inner', config: { name: 'acme', nodeDirs: 'repos' } } }))

  const result = run(['init', '--from', 'answers.json'], { cwd: root })

  assert.equal(result.code, 1)
  assert.deepEqual(readdirSync(root), ['answers.json'])
})

test('ten decisions recorded at once are each given a number of their own', async () => {
  const root = tree(acme())
  const slugs = Array.from({ length: 10 }, (_, at) => `choice-${at}`)

  const results = await together(slugs.map(slug => ({ args: ['note', '--new', `decisions/${slug}`], options: { cwd: root } })))

  assert.deepEqual(results.map(result => result.stderr + result.code), slugs.map(() => '0'))
  assert.deepEqual(readdirSync(join(root, 'decisions')).map(name => name.slice(0, 4)).sort(), ['0001', '0002', '0003', '0004', '0005', '0006', '0007', '0008', '0009', '0010'])
  assert.deepEqual(leftByAWrite(root), [])
})

const linkToNowhere = (root: string, rel: string) => {
  mkdirSync(join(root, rel, '..'), { recursive: true })
  symlinkSync(join(root, 'nowhere', 'gone.md'), join(root, rel))
}
const isLink = (root: string, rel: string) => lstatSync(join(root, rel)).isSymbolicLink()

test('a new note is refused where a link that leads nowhere stands at its place, and the link is left', LINKS, () => {
  const root = tree(acme())
  linkToNowhere(root, 'concepts/limits.md')

  const result = run(['note', '--new', 'concepts/limits'], { cwd: root })

  assert.deepEqual(result, { code: 1, stdout: '', stderr: 'context-central note: concepts/limits.md already exists\n' })
  assert.equal(isLink(root, 'concepts/limits.md'), true)
})

test('adopting an item is refused in one line where a link stands at the state file\'s place, and what it leads to is left as it was', LINKS, () => {
  const root = tree(acme({ 'work/PROJ-7/README.md': '# PROJ-7: Old shape\n', 'kept/state.md': '# Kept elsewhere\n' }))
  symlinkSync(join(root, 'kept', 'state.md'), join(root, 'work/PROJ-7/STATE.md'))

  const result = run(['work', 'adopt', 'PROJ-7'], { cwd: root, env: { TZ: 'UTC' } })

  assert.deepEqual(result, { code: 1, stdout: '', stderr: 'context-central work: work/PROJ-7/STATE.md is there already as a link, so nothing was written: move it, then adopt the item again\n' })
  assert.equal(read(root, 'kept/state.md'), '# Kept elsewhere\n')
  assert.equal(isLink(root, 'work/PROJ-7/STATE.md'), true)
})

test('a launcher is kept where a link that leads nowhere stands at its place', LINKS, () => {
  const root = tree(acme())
  linkToNowhere(root, 'bin/context-central')

  const result = run(['wrapper', '--write'], { cwd: root })

  assert.equal(result.code, 0)
  assert.equal(result.stdout.split('\n')[0], 'kept bin/context-central (differs from the one this release writes: delete it and run this again to renew it)')
  assert.equal(isLink(root, 'bin/context-central'), true)
})

test('init does not replace a hub that is a link leading nowhere: it stops with one line that names it', LINKS, () => {
  const root = tree(makeTree({ 'answers.json': { layout: 'root', config: { name: 'acme' } } }))
  linkToNowhere(root, 'CLAUDE.md')

  const result = run(['init', '--from', 'answers.json'], { cwd: root })

  assert.equal(result.code, 1)
  assert.equal(result.stderr, `context-central init: ENOENT: no such file or directory, open '${join(root, 'CLAUDE.md')}'. Set CONTEXT_CENTRAL_DEBUG=1 to see the trace.\n`)
  assert.equal(isLink(root, 'CLAUDE.md'), true)
  assert.deepEqual(leftByAWrite(root), [])
})

test('evidence is refused where a link that leads nowhere stands at its name, and the link is left', LINKS, () => {
  const root = tree(acme({ 'scratch/shot.png': 'x' }))
  linkToNowhere(root, 'work/PROJ-12/evidence/2026-01-15-shot.png')

  const result = run(['evidence', 'add', 'scratch/shot.png', '--item', 'PROJ-12'], { cwd: root, env: { TZ: 'UTC' } })

  assert.deepEqual(result, { code: 1, stdout: '', stderr: 'context-central evidence: work/PROJ-12/evidence/2026-01-15-shot.png already exists; give other words with --as\n' })
  assert.equal(isLink(root, 'work/PROJ-12/evidence/2026-01-15-shot.png'), true)
})
