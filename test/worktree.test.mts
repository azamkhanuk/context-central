import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { ACME_CONFIG, ACME_FILES, INDEX_CLOSING_LINE, NEEDS_STAND_IN, SOLO_CONFIG, SOLO_STATE, checkout, disposable, hook, makeTree, run, solo, standIns, workTree } from './helpers.mts'
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

const standards = (made: Checkout, cwd: string, ...args: string[]) => run(['standards', ...args], { cwd, env: made.env }).stdout
const rootOf = (made: Checkout, cwd: string, repo: string) => (JSON.parse(standards(made, cwd, repo, '--json')) as { root: unknown }[])[0].root

test("standards gives the work tree's own folder as where the checks of its repo run", () => {
  const made = estate()

  assert.equal(standards(made, made.inside).split('\n')[1], `Checks for repo solo, run from ${made.inside}:`)
  assert.equal(rootOf(made, made.inside, 'solo'), made.inside)
  assert.equal(standards(made, made.main).split('\n')[1], `Checks for repo solo, run from ${made.main}:`)
})

test('in a root layout standards gives the work tree for its repo and the registered folder for another', () => {
  const made = rootLayout()

  assert.equal(standards(made, made.inside, 'api').split('\n')[1], `Checks for repo api, run from ${made.inside}:`)
  assert.equal(rootOf(made, made.inside, 'web'), join(made.base, 'web'))
})

test("standards gives a file of the repo as the work tree's copy, a file only the main checkout holds as that one, and the standards note where the map is", () => {
  const listed = { ...SOLO_CONFIG, repos: [{ ...SOLO_CONFIG.repos[0], standards: ['CLAUDE.md', 'local-rules.md'] }] }
  const made = estate(solo({ [`${MAP}/estate.json`]: listed, [`${MAP}/standards/solo.md`]: '# solo\n' }))
  writeFileSync(join(made.main, 'local-rules.md'), '# Rules kept on this machine\n')

  assert.deepEqual(standards(made, made.inside).split('\n').slice(1, 4), [
    `- ${join(made.main, MAP, 'standards', 'solo.md')} (the standards note)`,
    `- ${join(made.inside, 'CLAUDE.md')}`,
    `- ${join(made.main, 'local-rules.md')}`,
  ])
})

const HOW_A_FILE_IS_WRITTEN = 'A file of the map is written from here with context-central draft, which prints the file to write, and context-central take, which puts it in the map.'
const index = (made: Checkout, cwd: string) => run(['index', '--absolute'], { cwd, env: made.env }).stdout.trimEnd().split('\n')
const soloIndex = (made: Checkout, ...workTreeLines: string[]) => [
  `Context map "solo": ${join(made.main, MAP)}`,
  `Hub: ${join(made.main, 'CLAUDE.md')}`,
  ...workTreeLines,
  'Work in flight (1):',
  `- PROJ-12 | Rate limit the gateway | ${join(made.main, MAP, SOLO_STATE)}`,
  INDEX_CLOSING_LINE,
]

test('the index names the work tree and says how a file of the map is written from it', () => {
  const made = estate()

  assert.deepEqual(index(made, made.inside), soloIndex(made, `Work tree: ${made.inside}, of the checkout at ${made.main}. ${HOW_A_FILE_IS_WRITTEN}`))
})

test('in the main checkout the index says nothing of a work tree', () => {
  const made = estate()

  assert.deepEqual(index(made, made.main), soloIndex(made))
})

test("the index counts the drafts that wait, and not one that is the same as the map's file", () => {
  const made = estate()
  run(['draft', SOLO_STATE], { cwd: made.inside, env: made.env })
  mkdirSync(join(made.inside, MAP, 'concepts'))
  writeFileSync(join(made.inside, MAP, 'concepts', 'limits.md'), '# Limits\n')

  assert.equal(index(made, made.inside)[3], `Drafts not yet in the map: 1, under ${join(made.inside, MAP)}.`)
})

test('in a root layout the index names the work tree of a repo after the line for the repo, and says nothing of drafts', () => {
  const made = rootLayout()

  assert.deepEqual(index(made, made.inside).slice(2, 4), [`Repo api: ${join(made.base, 'repos', 'api.md')}`, `Work tree: ${made.inside}, of the checkout at ${made.main}.`])
})

test('the session-start hook gives a session in a work tree the same index', () => {
  const made = estate()

  const answer = JSON.parse(hook('session-start', { cwd: made.inside, session_id: 'in-a-work-tree', source: 'startup' }, { env: made.env }).stdout) as { hookSpecificOutput: { additionalContext: string } }

  assert.deepEqual(answer.hookSpecificOutput.additionalContext.split('\n'), index(made, made.inside))
})

function beside(made = solo()) {
  tree(made.base)
  return { ...made, beside: workTree(made, join(made.base, 'solo-limit')) }
}

const session = (cwd: string) => ({ cwd, session_id: 'in-a-work-tree', source: 'startup' })
const indexFrom = (made: Checkout, cwd: string, env = made.env) => (JSON.parse(hook('session-start', session(cwd), { env }).stdout) as { hookSpecificOutput: { additionalContext: string } }).hookSpecificOutput.additionalContext.split('\n')

test('a work tree beside the checkout finds the map of its main checkout', () => {
  const made = beside()

  assert.equal(mapLine(made, made.beside), `map: solo at ${join(made.main, MAP)}`)
  assert.deepEqual(where(made, made.beside).slice(3), ['here: root', `work tree: ${made.beside}, of the checkout at ${made.main}`, `drafts: ${join(made.beside, MAP)}`, ''])
  assert.equal(run(['work', 'list'], { cwd: join(made.beside, 'src'), env: made.env }).stdout, `PROJ-12 | Rate limit the gateway | ${SOLO_STATE} | 0 notes, 0 deep files (0 B)\n`)
})

test('the session-start hook answers for a work tree beside the checkout, whichever folder is the project folder', () => {
  const made = beside()
  const expected = [`Context map "solo": ${join(made.main, MAP)}`, `Hub: ${join(made.main, 'CLAUDE.md')}`, `Work tree: ${made.beside}, of the checkout at ${made.main}. ${HOW_A_FILE_IS_WRITTEN}`]

  assert.deepEqual(indexFrom(made, made.beside).slice(0, 3), expected)
  assert.deepEqual(indexFrom(made, made.beside, { ...made.env, CLAUDE_PROJECT_DIR: made.beside }).slice(0, 3), expected)
  assert.deepEqual(indexFrom(made, made.beside, { ...made.env, CLAUDE_PROJECT_DIR: made.main }).slice(0, 3), expected)
})

test('a folder in a work tree counts as the same folder of its main checkout, so a work tree inside the checkout is not a folder of its own', () => {
  const made = estate()

  assert.equal(where(made, made.inside)[3], 'here: root')
  assert.equal(where(made, join(made.inside, 'src'))[3], 'here: inside')
})

test('in a root layout a work tree beside its repo is covered as that repo, and the hook answers there', () => {
  const made = checkout({ 'README.md': '# api checkout\n' }, 'api', { 'estate.json': ACME_CONFIG, ...ACME_FILES })
  tree(made.base)
  const outside = workTree(made, join(made.base, 'api-limit'))

  assert.equal(where(made, outside)[3], 'here: repo:api')
  assert.equal(indexFrom(made, outside)[2], `Repo api: ${join(made.base, 'repos', 'api.md')}`)
})

test('the hook answers from the map a work tree has of its own, kept in git, when the project folder is the main checkout', () => {
  const made = estate(solo({ '.gitignore': 'node_modules/\n' }))

  assert.equal(indexFrom(made, made.inside, { ...made.env, CLAUDE_PROJECT_DIR: made.main })[0], `Context map "solo": ${join(made.inside, MAP)}`)
})

test('the hook still answers from the project folder when the session has moved to a work tree no map answers for', () => {
  const made = estate()
  const other = checkout({ 'README.md': '# another repository\n' }, 'other')
  tree(other.base)
  const elsewhere = workTree(other, join(other.base, 'other-limit'))

  assert.equal(indexFrom(made, elsewhere, { ...made.env, CLAUDE_PROJECT_DIR: made.main })[0], `Context map "solo": ${join(made.main, MAP)}`)
})

test('the index does not count a draft that was only read: one never edited, whose file in the map has changed since', () => {
  const made = estate()
  run(['draft', SOLO_STATE], { cwd: made.inside, env: made.env })
  writeFileSync(join(made.main, MAP, SOLO_STATE), '# PROJ-12, as another session left it\n')

  assert.deepEqual(index(made, made.inside).slice(2, 4), [`Work tree: ${made.inside}, of the checkout at ${made.main}. ${HOW_A_FILE_IS_WRITTEN}`, 'Work in flight (1):'])
})
