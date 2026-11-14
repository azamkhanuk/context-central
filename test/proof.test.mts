import assert from 'node:assert/strict'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { LOCK, NEEDS_STAND_IN, SOLO_CONFIG, SOLO_FILES, acme, checkout, disposable, git, makeTree, notOnWindows, run, solo, standIns, together, workTree } from './helpers.mts'
import type { Checkout, Env, TreeFiles } from './helpers.mts'

type Run = { repo: string, check: string, exit: number, commit: string, branch: string | null, dirty: boolean, date: string, system: string }

const tree = disposable()

const RECORD = 'work/PROJ-12/proof.jsonl'
const SYSTEM = `${process.platform} ${process.arch}`
const PASSED = ['PROJ-12', '--check', './check.sh', '--exit', '0']
const NO_ANSWER = (folder: string) => `context-central proof: git gave no answer in ${folder}, so nothing was recorded\n`
const ROOT_LAYOUT = {
  'estate.json': { contextCentral: 1, name: 'solo', repos: [{ name: 'solo', path: '.', checks: ['./check.sh'] }] },
  'CLAUDE.md': '# Solo\n',
  'glossary.md': '# Glossary\n',
  'src/app.js': 'export {}\n',
  'work/PROJ-12/STATE.md': '---\nitem: PROJ-12\ntitle: Rate limit the gateway\nstatus: active\n---\n# PROJ-12: Rate limit the gateway\n',
}

const A_FOLDER_NOBODY_WRITES = process.getuid?.() === 0 ? { skip: 'root writes to a folder whatever its mode' } : notOnWindows('a folder is made read-only by its mode, which Windows does not hold a write to')

const made = (one: Checkout) => (tree(one.base), one)

function soloWithAMapGitDoesNotIgnore() {
  const one = made(checkout({ 'CLAUDE.md': '# Solo\n', 'src/app.js': 'export {}\n' }))
  for (const [path, content] of Object.entries(SOLO_FILES).filter(([path]) => path.startsWith('.context-central/'))) {
    mkdirSync(dirname(join(one.main, path)), { recursive: true })
    writeFileSync(join(one.main, path), typeof content === 'string' ? content : `${JSON.stringify(content)}\n`)
  }
  return one
}
const proof = (one: Pick<Checkout, 'env'>, cwd: string, ...args: string[]) => run(['proof', ...args], { cwd, env: one.env })
const headOf = (one: Checkout, dir = one.main) => git(one, dir, 'rev-parse', 'HEAD').stdout.trim()
const mapOf = (one: Checkout) => join(one.main, '.context-central')
const text = (...path: string[]) => readFileSync(join(...path), 'utf8')
const runsIn = (...path: string[]) => text(...path).trimEnd().split('\n').map(line => JSON.parse(line) as Run)
const aRun = (commit: string, more: Partial<Run> = {}): Run => ({ repo: 'solo', check: './check.sh', exit: 0, commit, branch: 'main', dirty: false, date: '2026-01-15', system: SYSTEM, ...more })

test('a run of a recorded check is written to the proof record of the item, with the commit, the branch, the day and the system that the command read', () => {
  const one = made(solo())

  const result = proof(one, one.main, ...PASSED)

  assert.deepEqual(result, { code: 0, stdout: `recorded: solo "./check.sh" exit 0 at ${headOf(one).slice(0, 7)} on main\n`, stderr: '' })
  assert.equal(text(mapOf(one), RECORD), `${JSON.stringify(aRun(headOf(one)))}\n`)
})

test('a run that came back red is recorded with what the check exited with, and a second run is a second line', () => {
  const one = made(solo())

  proof(one, one.main, ...PASSED)
  const result = proof(one, join(one.main, 'src'), 'proj-12', '--check', './check.sh', '--exit', '3')

  assert.deepEqual(result, { code: 0, stdout: `recorded: solo "./check.sh" exit 3 at ${headOf(one).slice(0, 7)} on main\n`, stderr: '' })
  assert.deepEqual(runsIn(mapOf(one), RECORD), [aRun(headOf(one)), aRun(headOf(one), { exit: 3 })])
})

test('a run made while a file of the repo is changed, or a new one is there, is marked as made on changes that were not committed', () => {
  const one = made(solo())

  writeFileSync(join(one.main, 'src/app.js'), 'export const changed = true\n')
  const changed = proof(one, one.main, ...PASSED)
  git(one, one.main, 'checkout', '-q', '--', 'src/app.js')
  writeFileSync(join(one.main, 'src/new.js'), 'export {}\n')
  const added = proof(one, one.main, ...PASSED)

  assert.equal(changed.stdout, `recorded: solo "./check.sh" exit 0 at ${headOf(one).slice(0, 7)} on main, with changes not committed\n`)
  assert.equal(added.stdout, changed.stdout)
  assert.deepEqual(runsIn(mapOf(one), RECORD).map(held => held.dirty), [true, true])
})

test('the map and the hub are not changes that were not committed, where the map sits in the repo and git neither tracks nor ignores it', () => {
  const one = soloWithAMapGitDoesNotIgnore()
  writeFileSync(join(one.main, 'CLAUDE.md'), '# Solo\n\nA rule.\n')

  proof(one, one.main, ...PASSED)
  proof(one, one.main, ...PASSED)

  assert.match(git(one, one.main, 'status', '--porcelain').stdout, /^\?\? \.context-central\/$/m)
  assert.deepEqual(runsIn(mapOf(one), RECORD).map(held => held.dirty), [false, false])
})

test('in the root layout the node folders, the settings, the glossary and the hub are the map, and a file of the code beside them is not', () => {
  const one = made(checkout(ROOT_LAYOUT))

  proof(one, one.main, ...PASSED)
  for (const file of ['work/PROJ-12/STATE.md', 'estate.json', 'glossary.md', 'CLAUDE.md']) writeFileSync(join(one.main, file), `${text(one.main, file)}\n`)
  mkdirSync(join(one.main, 'docs'))
  writeFileSync(join(one.main, 'docs/note.md'), '# A note\n')
  proof(one, one.main, ...PASSED)
  writeFileSync(join(one.main, 'README.md'), '# Solo\n')
  proof(one, one.main, ...PASSED)

  assert.deepEqual(runsIn(one.main, RECORD).map(held => held.dirty), [false, false, true])
})

test('a run on a detached HEAD has no branch', () => {
  const one = made(solo())
  git(one, one.main, 'checkout', '-q', '--detach')

  const result = proof(one, one.main, ...PASSED)

  assert.equal(result.stdout, `recorded: solo "./check.sh" exit 0 at ${headOf(one).slice(0, 7)} on no branch\n`)
  assert.deepEqual(runsIn(mapOf(one), RECORD), [aRun(headOf(one), { branch: null })])
})

test('a run from a git work tree goes straight into the map of the main checkout, with the commit and the branch of the work tree, and leaves no draft', () => {
  const one = made(solo())
  const linked = workTree(one, join(one.base, 'tree'))
  writeFileSync(join(linked, 'src/app.js'), 'export const limited = true\n')
  git(one, linked, 'commit', '-q', '-am', 'second')

  const result = proof(one, linked, ...PASSED)

  assert.notEqual(headOf(one, linked), headOf(one))
  assert.deepEqual(result, { code: 0, stdout: `recorded: solo "./check.sh" exit 0 at ${headOf(one, linked).slice(0, 7)} on work/limit\n`, stderr: '' })
  assert.deepEqual(runsIn(mapOf(one), RECORD), [aRun(headOf(one, linked), { branch: 'work/limit' })])
  assert.equal(existsSync(join(linked, '.context-central')), false)
})

test('a draft that waits in a git work tree is not a change that was not committed', () => {
  const one = soloWithAMapGitDoesNotIgnore()
  const linked = workTree(one, join(one.base, 'tree'))
  run(['draft', 'work/PROJ-12/STATE.md'], { cwd: linked, env: one.env })

  proof(one, linked, ...PASSED)

  assert.match(git(one, linked, 'status', '--porcelain').stdout, /^\?\? \.context-central\/$/m)
  assert.deepEqual(runsIn(mapOf(one), RECORD).map(held => held.dirty), [false])
})

test('twenty runs recorded at the same moment are all in the record, each on a line of its own', async () => {
  const one = made(solo())

  const results = await together(Array.from({ length: 20 }, (_, exit) => ({ args: ['proof', 'PROJ-12', '--check', './check.sh', '--exit', String(exit)], options: { cwd: one.main, env: one.env } })))

  assert.deepEqual(results.map(result => result.code), Array(20).fill(0))
  assert.deepEqual(runsIn(mapOf(one), RECORD).map(held => held.exit).sort((a, b) => a - b), Array.from({ length: 20 }, (_, exit) => exit))
})

test('a line of the record that is no run is kept as it is, and the new run goes after it on a line of its own', () => {
  const held = 'not a run\n{"repo":"solo"}'
  const one = made(solo({ [`.context-central/${RECORD}`]: held }))

  proof(one, one.main, ...PASSED)

  assert.equal(text(mapOf(one), RECORD), `${held}\n${JSON.stringify(aRun(headOf(one)))}\n`)
})

test('a check the repo does not record is refused with the checks it does record, and nothing is written', () => {
  const one = made(solo())
  const none = made(solo({ '.context-central/estate.json': { ...SOLO_CONFIG, repos: [{ name: 'solo', path: '.' }] } }))

  assert.deepEqual(proof(one, one.main, 'PROJ-12', '--check', 'npm test', '--exit', '0'), { code: 1, stdout: '', stderr: 'context-central proof: repo solo records no check "npm test". Its checks: "./check.sh"\n' })
  assert.deepEqual(proof(none, none.main, ...PASSED), { code: 1, stdout: '', stderr: 'context-central proof: repo solo records no check "./check.sh". Its checks: none\n' })
  assert.equal(existsSync(join(mapOf(one), RECORD)), false)
})

test('an item that is not there, a folder in no registered repo and a folder no map covers are each refused', () => {
  const one = made(solo())
  const estate = tree(acme())
  const bare = tree(makeTree({}))

  assert.deepEqual(proof(one, one.main, 'PROJ-99', '--check', './check.sh', '--exit', '0'), { code: 1, stdout: '', stderr: 'context-central proof: no work item "PROJ-99"\n' })
  assert.deepEqual(run(['proof', ...PASSED], { cwd: estate }), { code: 1, stdout: '', stderr: `context-central proof: ${estate} is in no registered repo, so there is no recorded check to record; run this from the repo's folder\n` })
  assert.equal(run(['proof', ...PASSED], { cwd: bare }).code, 1)
  assert.match(run(['proof', ...PASSED], { cwd: bare }).stderr, /^context-central proof: no context map found from /)
})

test('no item, no check, no exit code or a second word is wrong usage', () => {
  const one = made(solo())

  for (const args of [[], ['--check', './check.sh', '--exit', '0'], ['PROJ-12', '--exit', '0'], ['PROJ-12', '--check', './check.sh'], ['PROJ-12', 'PROJ-13', '--check', './check.sh', '--exit', '0']]) {
    assert.deepEqual(proof(one, one.main, ...args), { code: 2, stdout: '', stderr: 'context-central proof: expected: proof <item> --check "<check>" --exit <code>\n' }, args.join(' '))
  }
  assert.equal(existsSync(join(mapOf(one), RECORD)), false)
})

test('an exit code that is not a whole number of 0 or more is wrong usage', () => {
  const one = made(solo())

  for (const code of ['red', '1.5', '-1', '', '0x10', '1e3', ' 1', '99999999999999999999']) {
    assert.deepEqual(proof(one, one.main, 'PROJ-12', '--check', './check.sh', `--exit=${code}`), { code: 2, stdout: '', stderr: 'context-central proof: --exit takes what the check exited with, a whole number of 0 or more\n' }, code)
  }
  assert.equal(existsSync(join(mapOf(one), RECORD)), false)
})

test('with no git on the PATH, in a folder that is no checkout and in a repo with no commit yet, nothing is recorded and the command says that git gave no answer', () => {
  const one = made(solo())
  const noGit: Env = { ...one.env, PATH: tree(makeTree({})) }
  const noCheckout = tree(makeTree({ ...SOLO_FILES }))
  const noCommit = tree(makeTree({ ...SOLO_FILES }))
  git(one, noCommit, 'init', '-q', '-b', 'main')

  assert.deepEqual(proof({ env: noGit }, one.main, ...PASSED), { code: 1, stdout: '', stderr: NO_ANSWER(one.main) })
  assert.deepEqual(proof(one, noCheckout, ...PASSED), { code: 1, stdout: '', stderr: NO_ANSWER(noCheckout) })
  assert.deepEqual(proof(one, noCommit, ...PASSED), { code: 1, stdout: '', stderr: NO_ANSWER(noCommit) })
  for (const root of [one.main, noCheckout, noCommit]) assert.equal(existsSync(join(root, '.context-central', RECORD)), false, root)
})

test('a git that gives no answer in five seconds is not waited for, and nothing is recorded', NEEDS_STAND_IN, () => {
  const one = made(solo())
  const slow: Env = { ...one.env, PATH: tree(standIns({ git: '#!/bin/sh\nexec /bin/sleep 7\n' })) }

  assert.deepEqual(proof({ env: slow }, one.main, ...PASSED), { code: 1, stdout: '', stderr: NO_ANSWER(one.main) })
  assert.equal(existsSync(join(mapOf(one), RECORD)), false)
})

test('while another command holds the map the run waits five seconds, then says so and records nothing', () => {
  const one = made(solo())
  mkdirSync(join(mapOf(one), LOCK))

  const result = proof(one, one.main, ...PASSED)

  assert.deepEqual(result, { code: 1, stdout: '', stderr: 'context-central proof: the map is being written by another command, and still was after 5 seconds, so nothing was written; run this again\n' })
  assert.equal(existsSync(join(mapOf(one), RECORD)), false)
})

test('nothing is recorded for an item whose folder notNodes lists', () => {
  const files: TreeFiles = { '.context-central/estate.json': { ...SOLO_CONFIG, notNodes: ['work/arch'] }, '.context-central/work/arch.md': '# arch: The archive\n', '.context-central/work/arch/kept.md': '# Kept\n' }
  const one = made(solo(files))

  const result = proof(one, one.main, 'arch', '--check', './check.sh', '--exit', '0')

  assert.deepEqual(result, { code: 1, stdout: '', stderr: 'context-central proof: work/arch is under a notNodes entry, so nothing is saved there for arch\n' })
  assert.equal(existsSync(join(mapOf(one), 'work/arch/proof.jsonl')), false)
})

test('a record the system will not let the command read is one line and exit 1', () => {
  const one = made(solo({ [`.context-central/${RECORD}/in-the-way`]: '' }))

  const result = proof(one, one.main, ...PASSED)

  assert.equal(result.code, 1)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /^context-central proof: EISDIR[^\n]*\. Set CONTEXT_CENTRAL_DEBUG=1 to see the trace\.\n$/)
})

test('neither lint nor graph has a line for the proof record, and a file of its name deeper in the item still earns the warning for a stray file', () => {
  const one = made(solo({ '.context-central/work/PROJ-12/notes/proof.jsonl': '' }))
  const noRepoRecordsACheck = { '.context-central/estate.json': { ...SOLO_CONFIG, repos: [{ name: 'solo', path: '.' }] } }
  const quiet = made(solo({ [`.context-central/${RECORD}`]: `${JSON.stringify(aRun('0'.repeat(40)))}\n`, ...noRepoRecordsACheck }))

  assert.deepEqual(run(['lint'], { cwd: quiet.main, env: quiet.env }), { code: 0, stdout: 'ok\n', stderr: '' })
  assert.doesNotMatch(run(['graph', '--strict'], { cwd: quiet.main, env: quiet.env }).stdout, /proof\.jsonl/)
  assert.equal(run(['lint'], { cwd: one.main, env: one.env }).stdout, 'WARN evidence: work/PROJ-12/notes/proof.jsonl is not Markdown and is outside work/PROJ-12/evidence/\n')
})

test('the work folder and the saved launcher are the map too in the root layout, where the work folder is no node folder', () => {
  const one = made(checkout({ ...ROOT_LAYOUT, 'estate.json': { contextCentral: 1, name: 'solo', workDir: 'items', nodeDirs: ['concepts'], repos: [{ name: 'solo', path: '.', checks: ['./check.sh'] }] }, 'items/PROJ-12/STATE.md': '---\nstatus: active\n---\n# PROJ-12\n' }))

  proof(one, one.main, ...PASSED)
  run(['wrapper', '--write'], { cwd: one.main, env: one.env })
  proof(one, one.main, ...PASSED)

  assert.match(git(one, one.main, 'status', '--porcelain').stdout, /^\?\? bin\/$/m)
  assert.deepEqual(runsIn(one.main, 'items/PROJ-12/proof.jsonl').map(held => held.dirty), [false, false])
})

test('the branch is recorded by its own name where a tag carries the same name', () => {
  const one = made(solo())
  git(one, one.main, 'tag', 'main')

  const result = proof(one, one.main, ...PASSED)

  assert.equal(result.stdout, `recorded: solo "./check.sh" exit 0 at ${headOf(one).slice(0, 7)} on main\n`)
  assert.deepEqual(runsIn(mapOf(one), RECORD), [aRun(headOf(one))])
})

test('a write the system refuses is one line and exit 1, and no part of a run is left behind', A_FOLDER_NOBODY_WRITES, () => {
  const one = made(solo())
  const folder = join(mapOf(one), 'work/PROJ-12')
  chmodSync(folder, 0o555)

  const result = proof(one, one.main, ...PASSED)
  chmodSync(folder, 0o755)

  assert.equal(result.code, 1)
  assert.match(result.stderr, /^context-central proof: EACCES[^\n]*\. Set CONTEXT_CENTRAL_DEBUG=1 to see the trace\.\n$/)
  assert.equal(existsSync(join(mapOf(one), RECORD)), false)
})

test('a new file is a change that was not committed where git is set to hide the files it does not track', () => {
  const one = made(solo())
  git(one, one.main, 'config', 'status.showUntrackedFiles', 'no')
  writeFileSync(join(one.main, 'src/new.js'), 'export {}\n')

  const added = proof(one, one.main, ...PASSED)

  assert.equal(added.stdout, `recorded: solo "./check.sh" exit 0 at ${headOf(one).slice(0, 7)} on main, with changes not committed\n`)
  assert.deepEqual(runsIn(mapOf(one), RECORD).map(held => held.dirty), [true])
})
