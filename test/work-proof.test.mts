import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { SOLO_STATE, disposable, git, run, solo } from './helpers.mts'
import type { Checkout } from './helpers.mts'

const tree = disposable()

const made = (one: Checkout) => (tree(one.base), one)
const work = (one: Checkout, ...args: string[]) => run(['work', ...args], { cwd: one.main, env: one.env })
const proved = (one: Checkout) => run(['proof', 'PROJ-12', '--check', './check.sh', '--exit', '0'], { cwd: one.main, env: one.env })
const status = (one: Checkout) => /^status: (\w+)$/m.exec(readFileSync(join(one.main, '.context-central', SOLO_STATE), 'utf8'))?.[1]

function changed(one: Checkout) {
  writeFileSync(join(one.main, 'src/app.js'), 'export const limited = true\n')
  git(one, one.main, 'commit', '-q', '-am', 'second')
}

test('an item whose proof is whole, or that has nothing built, is marked done in one line', () => {
  const whole = made(solo())
  const nothingBuilt = made(solo())
  proved(whole)

  assert.deepEqual(work(whole, 'done', 'PROJ-12'), { code: 0, stdout: 'PROJ-12: done\n', stderr: '' })
  assert.deepEqual(work(nothingBuilt, 'done', 'PROJ-12'), { code: 0, stdout: 'PROJ-12: done\n', stderr: '' })
})

test('an item whose proof is not whole is marked done all the same, and a second line says what its proof lacks', () => {
  const one = made(solo())
  proved(one)
  changed(one)

  const result = work(one, 'done', 'PROJ-12')

  assert.deepEqual(result, { code: 0, stdout: 'PROJ-12: done\nproof: PROJ-12 in solo: "./check.sh" last ran on code older than the head of main\n', stderr: '' })
  assert.equal(status(one), 'done')
})

test('reopening an item says nothing of its proof', () => {
  const one = made(solo())
  proved(one)
  changed(one)
  work(one, 'done', 'PROJ-12')

  assert.deepEqual(work(one, 'reopen', 'PROJ-12'), { code: 0, stdout: 'PROJ-12: active\n', stderr: '' })
})
