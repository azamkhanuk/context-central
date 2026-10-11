import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { ACME_CONFIG, ACME_FILES, NEEDS_STAND_IN, SOLO_CONFIG, checkout, disposable, makeTree, run, solo, standIns, workTree } from './helpers.mts'
import type { Checkout } from './helpers.mts'

const tree = disposable()

const MAP = '.context-central'

function estate(made = solo()) {
  tree(made.base)
  return { ...made, inside: workTree(made, join(made.main, '.claude', 'worktrees', 'limit')) }
}

function withCopy() {
  const made = estate()
  cpSync(join(made.main, MAP), join(made.inside, MAP), { recursive: true })
  return made
}

const mapLine = (made: Checkout, cwd: string, env = made.env) => run(['where'], { cwd, env }).stdout.split('\n')[0]

test('with a copy of the map in the work tree, where names the map of the main checkout', () => {
  const made = withCopy()

  assert.equal(mapLine(made, made.inside), `map: solo at ${join(made.main, MAP)}`)
})

test('with such a copy, work new writes the map of the main checkout', () => {
  const made = withCopy()

  const result = run(['work', 'new', 'PROJ-30'], { cwd: made.inside, env: made.env })

  assert.equal(result.stdout, 'work/PROJ-30/STATE.md\n')
  assert.equal(existsSync(join(made.main, MAP, 'work', 'PROJ-30', 'STATE.md')), true)
  assert.equal(existsSync(join(made.inside, MAP, 'work', 'PROJ-30')), false)
})

test("a map that git tracks in the work tree is that work tree's own", () => {
  const made = estate(solo({ '.gitignore': 'node_modules/\n' }))

  const result = run(['work', 'new', 'PROJ-30'], { cwd: made.inside, env: made.env })

  assert.equal(mapLine(made, made.inside), `map: solo at ${join(made.inside, MAP)}`)
  assert.equal(result.stdout, 'work/PROJ-30/STATE.md\n')
  assert.equal(existsSync(join(made.inside, MAP, 'work', 'PROJ-30', 'STATE.md')), true)
  assert.equal(existsSync(join(made.main, MAP, 'work', 'PROJ-30')), false)
})

test("a map in a work tree whose main checkout holds none is that work tree's map", () => {
  const made = checkout({ 'src/app.js': 'export {}\n' })
  tree(made.base)
  const inside = workTree(made, join(made.main, '.claude', 'worktrees', 'limit'))
  mkdirSync(join(inside, MAP))
  writeFileSync(join(inside, MAP, 'estate.json'), JSON.stringify(SOLO_CONFIG))

  assert.equal(mapLine(made, inside), `map: solo at ${join(inside, MAP)}`)
})

test('with no git on the PATH a copy in the work tree is taken for the map, as it was before', () => {
  const made = withCopy()

  assert.equal(mapLine(made, made.inside, { ...made.env, PATH: tree(makeTree({})) }), `map: solo at ${join(made.inside, MAP)}`)
})

test('where git refuses to answer, a copy in the work tree is taken for the map', NEEDS_STAND_IN, () => {
  const made = withCopy()
  const refusing = tree(standIns({ git: '#!/bin/sh\necho "fatal: detected dubious ownership" >&2\nexit 128\n' }))

  assert.equal(mapLine(made, made.inside, { ...made.env, PATH: refusing }), `map: solo at ${join(made.inside, MAP)}`)
})

const where = (made: Checkout, cwd: string) => run(['where'], { cwd, env: made.env }).stdout.split('\n')
const whereJson = (made: Checkout, cwd: string) => JSON.parse(run(['where', '--json'], { cwd, env: made.env }).stdout) as { workTree: unknown, drafts: unknown }

function rootLayout() {
  const made = checkout({ 'README.md': '# api checkout\n' }, 'api', { 'estate.json': { ...ACME_CONFIG, repos: [{ name: 'web' }, { name: 'api', checks: ['./check.sh'] }] }, ...ACME_FILES })
  tree(made.base)
  return { ...made, inside: workTree(made, join(made.main, '.claude', 'worktrees', 'limit')) }
}

test('where names the work tree, the main checkout it belongs to and the drafts folder', () => {
  const made = estate()

  assert.deepEqual(where(made, made.inside).slice(4), [`work tree: ${made.inside}, of the checkout at ${made.main}`, `drafts: ${join(made.inside, MAP)}`, ''])
  assert.deepEqual(whereJson(made, made.inside).workTree, { root: made.inside, main: made.main })
  assert.equal(whereJson(made, made.inside).drafts, join(made.inside, MAP))
})

test('in the main checkout where names no work tree and no drafts folder', () => {
  const made = estate()

  assert.deepEqual(where(made, made.main).slice(3), ['here: root', ''])
  assert.equal(whereJson(made, made.main).workTree, null)
  assert.equal(whereJson(made, made.main).drafts, null)
})

test('in a root layout where names the work tree of a repo and no drafts folder, since the map is outside the repository', () => {
  const made = rootLayout()

  assert.deepEqual(where(made, made.inside).slice(3), ['here: repo:api', `work tree: ${made.inside}, of the checkout at ${made.main}`, ''])
  assert.equal(whereJson(made, made.inside).drafts, null)
})

test("in a work tree with a map of its own, kept in git, where names no work tree: it is that map's checkout", () => {
  const made = estate(solo({ '.gitignore': 'node_modules/\n' }))

  assert.deepEqual(where(made, made.inside).slice(3), ['here: root', ''])
})
