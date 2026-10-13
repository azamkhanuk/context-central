import assert from 'node:assert/strict'
import { chmodSync, lstatSync, mkdirSync, readFileSync, readdirSync, statSync, symlinkSync, utimesSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { acme, disposable, notOnWindows, run, together } from './helpers.mts'

const tree = disposable()

const LOCK = '.context-central.lock'
const BREAKER = `${LOCK}.break`
const JANUARY = 'log/2026-01.md'
const EARLIER = Array.from({ length: 300 }, (_, at) => `- earlier ${at}`)
const LOG = `# 2026-01\n\n## 2026-01-15\n\n${EARLIER.join('\n')}\n`
const HELD = 'context-central note: the map is being written by another command, and still was after 5 seconds, so nothing was written; run this again\n'
const BY_MODE = notOnWindows('a file on Windows is not closed to writing by its mode in the same way')

const note = (root: string, text: string) => run(['note', text], { cwd: root, env: { TZ: 'UTC' } })
const read = (root: string, rel: string) => readFileSync(join(root, rel), 'utf8')
const hidden = (dir: string) => readdirSync(dir).filter(name => name.startsWith('.'))

function leftStale(root: string, name: string) {
  const folder = join(root, name)
  const then = new Date(Date.now() - 31_000)
  mkdirSync(folder)
  utimesSync(folder, then, then)
  return folder
}

for (const [what, stale] of Object.entries({ 'no lock in the way': [], 'a lock thirty seconds old in the way': [LOCK], 'such a lock and a breaker as old in the way': [LOCK, BREAKER] })) {
  test(`twenty notes written at once, with ${what}, are all in the log below every earlier line`, async () => {
    const root = tree(acme({ [JANUARY]: LOG }))
    for (const name of stale) leftStale(root, name)
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
  leftStale(root, LOCK)

  const result = note(root, 'Gateway limits agreed')

  assert.deepEqual(result, { code: 0, stdout: `${JANUARY}\n`, stderr: '' })
  assert.equal(read(root, JANUARY), '# 2026-01\n\n## 2026-01-15\n\n- Gateway limits agreed\n')
  assert.deepEqual(hidden(root), [])
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

test('a log that is a link stays a link, and the note lands in the file it leads to', notOnWindows('symlinks need a right most Windows accounts lack'), () => {
  const root = tree(acme({ 'kept/january.md': LOG }))
  mkdirSync(join(root, 'log'))
  symlinkSync(join(root, 'kept', 'january.md'), join(root, JANUARY))

  note(root, 'Gateway limits agreed')

  assert.equal(lstatSync(join(root, JANUARY)).isSymbolicLink(), true)
  assert.equal(read(root, 'kept/january.md'), `${LOG}- Gateway limits agreed\n`)
  assert.deepEqual([...hidden(join(root, 'kept')), ...hidden(join(root, 'log'))], [])
})
