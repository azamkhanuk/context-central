import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { NEEDS_STAND_IN, SOLO_CONFIG, SOLO_STATE, disposable, git, hook, makeTree, run, solo, standIns } from './helpers.mts'
import type { Checkout, Env, Result } from './helpers.mts'

type HookOutput = { hookSpecificOutput: { additionalContext: string } }

const tree = disposable()

const STATE = `.context-central/${SOLO_STATE}`
const ROW = '- PROJ-12 | Rate limit the gateway | work/PROJ-12/STATE.md'
const A_HANG_IS_WAITED_FOR_MS = 5000

const made = (one: Checkout) => (tree(one.base), one)
const index = (one: Checkout, ...flags: string[]) => run(['index', ...flags], { cwd: one.main, env: one.env })
const rowOf = (text: string) => text.split('\n').find(line => line.startsWith('- PROJ-12 |'))
const proved = (one: Checkout, exit = 0) => run(['proof', 'PROJ-12', '--check', './check.sh', '--exit', String(exit)], { cwd: one.main, env: one.env })
const context = (result: Result) => (JSON.parse(result.stdout) as HookOutput).hookSpecificOutput.additionalContext
const atStart = (one: Checkout, env: Env = one.env) => hook('session-start', { session_id: 's1', cwd: one.main, hook_event_name: 'SessionStart', source: 'startup' }, { env: { CONTEXT_CENTRAL_STATE_DIR: tree(makeTree({})), ...env } })

function changed(one: Checkout) {
  writeFileSync(join(one.main, 'src/app.js'), 'export const limited = true\n')
  git(one, one.main, 'commit', '-q', '-am', 'second')
}

test('the row of an item whose proof is older than the head ends with those words, from the index command and at session start', () => {
  const one = made(solo())
  proved(one)
  const whole = rowOf(index(one).stdout)

  changed(one)

  assert.equal(whole, ROW)
  assert.equal(rowOf(index(one).stdout), `${ROW} | proof: older than the head`)
  assert.equal(rowOf(context(atStart(one))), `- PROJ-12 | Rate limit the gateway | ${join(one.main, STATE)} | proof: older than the head`)
})

test('the words on a row say which of the four things is so, and an item with nothing built has none', () => {
  const noRun = made(solo({ [STATE]: '---\nitem: PROJ-12\ntitle: Rate limit the gateway\nstatus: active\n---\n# PROJ-12\n\n## Done\n\n- Built at 0000000: the limiter\n' }))
  const uncommitted = made(solo())
  const red = made(solo())
  const nothingBuilt = made(solo())
  changed(noRun)
  writeFileSync(join(noRun.main, STATE), `---\nitem: PROJ-12\ntitle: Rate limit the gateway\nstatus: active\n---\n# PROJ-12\n\n## Done\n\n- Built at ${git(noRun, noRun.main, 'rev-parse', 'HEAD').stdout.trim()}: the limiter\n`)
  writeFileSync(join(uncommitted.main, 'src/app.js'), 'export const limited = true\n')
  proved(uncommitted)
  proved(red, 2)

  assert.equal(rowOf(index(noRun).stdout), `${ROW} | proof: no run recorded`)
  assert.equal(rowOf(index(uncommitted).stdout), `${ROW} | proof: run on uncommitted changes`)
  assert.equal(rowOf(index(red).stdout), `${ROW} | proof: a check is red at the head`)
  assert.equal(rowOf(index(nothingBuilt).stdout), ROW)
})

test('index --json gives each item its words on proof, or null', () => {
  const one = made(solo({ '.context-central/work/PROJ-13/STATE.md': '---\nstatus: active\n---\n# PROJ-13\n' }))
  proved(one)
  changed(one)

  const { items } = JSON.parse(index(one, '--json').stdout) as { items: { id: string, proof: string | null }[] }

  assert.deepEqual(items.map(item => [item.id, item.proof]), [['PROJ-12', 'older than the head'], ['PROJ-13', null]])
})

test('the words on proof count against the index budget, and lint says when the rows no longer fit', () => {
  const one = made(solo())
  proved(one)
  const fitsExactly = index(one).stdout.length - 1
  writeFileSync(join(one.main, '.context-central/estate.json'), JSON.stringify({ ...SOLO_CONFIG, budgets: { indexChars: fitsExactly } }))
  const whole = index(one).stdout

  changed(one)

  assert.equal(rowOf(whole), ROW)
  assert.equal(rowOf(index(one).stdout), undefined)
  assert.ok(index(one).stdout.split('\n').includes('- and 1 more: context-central work list'))
  assert.ok(index(one).stdout.length - 1 <= fitsExactly)
  assert.ok(run(['lint'], { cwd: one.main, env: one.env }).stdout.split('\n').includes(`WARN index: 1 items in flight do not fit in ${fitsExactly} characters; the list is cut`))
})

test('the budget command counts the words on proof in the index it measures', () => {
  const one = made(solo())
  proved(one)
  changed(one)

  const { plugin } = JSON.parse(run(['budget', '--json'], { cwd: one.main, env: { ...one.env, HOME: tree(makeTree({})) } }).stdout) as { plugin: { indexChars: number } }

  assert.equal(plugin.indexChars, index(one, '--absolute').stdout.length - 1)
  assert.match(index(one, '--absolute').stdout, / \| proof: older than the head\n/)
})

test('at session start a git that gives no answer is waited for two seconds and no longer, and the row has no words on proof', NEEDS_STAND_IN, () => {
  const one = made(solo())
  proved(one)
  changed(one)
  const hangs: Env = { ...one.env, PATH: tree(standIns({ git: '#!/bin/sh\nexec /bin/sleep 9\n' })) }
  const started = performance.now()

  const result = atStart(one, hangs)

  assert.ok(performance.now() - started < A_HANG_IS_WAITED_FOR_MS)
  assert.equal(result.code, 0)
  assert.equal(result.stderr, '')
  assert.equal(rowOf(context(result)), `- PROJ-12 | Rate limit the gateway | ${join(one.main, STATE)}`)
})

test('at session start a row has no words on proof where git answers for the head and then gives no answer for the comparison', NEEDS_STAND_IN, () => {
  const one = made(solo())
  proved(one)
  changed(one)
  const real = process.env.PATH ?? ''
  const hangsOnDiff: Env = { ...one.env, PATH: tree(standIns({ git: `#!/bin/sh\ncase "$1" in diff) exec /bin/sleep 9 ;; esac\nPATH='${real}' exec git "$@"\n` })) }
  const started = performance.now()

  const result = atStart(one, hangsOnDiff)

  assert.ok(performance.now() - started < A_HANG_IS_WAITED_FOR_MS)
  assert.equal(rowOf(context(result)), `- PROJ-12 | Rate limit the gateway | ${join(one.main, STATE)}`)
})
