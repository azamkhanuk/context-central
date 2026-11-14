import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { NEEDS_STAND_IN, SOLO_CONFIG, SOLO_STATE, disposable, git, makeTree, run, solo, standIns, workTree } from './helpers.mts'
import type { Checkout, Json, TreeFiles } from './helpers.mts'

type Held = { repo?: string, check?: string, exit?: number, commit?: string, branch?: string | null, dirty?: boolean }

const tree = disposable()

const STATE = `.context-central/${SOLO_STATE}`
const RECORD = '.context-central/work/PROJ-12/proof.jsonl'
const OK = { code: 0, stdout: 'ok\n', stderr: '' }
const TWO_CHECKS = { '.context-central/estate.json': { ...SOLO_CONFIG, repos: [{ name: 'solo', path: '.', checks: ['./check.sh', 'npm test', 'npm run lint'] }] } }
const KEPT_IN_GIT = { '.gitignore': '' }

const made = (one: Checkout) => (tree(one.base), one)
const lint = (one: Pick<Checkout, 'env'>, cwd: string, ...flags: string[]) => run(['lint', ...flags], { cwd, env: one.env })
const warned = (one: Checkout, cwd = one.main) => lint(one, cwd).stdout
const headOf = (one: Checkout, dir = one.main) => git(one, dir, 'rev-parse', 'HEAD').stdout.trim()
const proved = (one: Checkout, exit = 0, check = './check.sh', cwd = one.main) => run(['proof', 'PROJ-12', '--check', check, '--exit', String(exit)], { cwd, env: one.env })

function put(root: string, path: string, content: Json) {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), typeof content === 'string' ? content : `${JSON.stringify(content)}\n`)
}

function committed(one: Checkout, files: TreeFiles, dir = one.main) {
  for (const [path, content] of Object.entries(files)) put(dir, path, content)
  git(one, dir, 'add', '-A')
  git(one, dir, 'commit', '-q', '-m', 'more')
  return headOf(one, dir)
}

function recorded(one: Checkout, runs: Held[], record = join(one.main, RECORD)) {
  const whole = (held: Held) => ({ repo: 'solo', check: './check.sh', exit: 0, commit: headOf(one), branch: 'main', dirty: false, date: '2026-01-15', system: 'linux x64', ...held })
  put(dirname(record), 'proof.jsonl', `${runs.map(held => JSON.stringify(whole(held))).join('\n')}\n`)
}

test('an item whose every recorded check passed at the head of its branch, with nothing uncommitted, earns no line', () => {
  const one = made(solo())

  proved(one)

  assert.deepEqual(lint(one, one.main), OK)
  assert.deepEqual(lint(one, one.main, '--strict'), OK)
})

test('an item with nothing built and no run recorded earns no line, though its repo records a check', () => {
  const one = made(solo())

  assert.deepEqual(lint(one, one.main), OK)
})

test('a check that last ran on an older commit earns a warning that names the item, the repo, the check and the branch, and fails only under --strict', () => {
  const one = made(solo())
  proved(one)
  committed(one, { 'src/app.js': 'export const limited = true\n' })

  const result = lint(one, one.main)

  assert.deepEqual(result, { code: 0, stdout: 'WARN proof: PROJ-12 in solo: "./check.sh" last ran on code older than the head of main\n', stderr: '' })
  assert.equal(lint(one, one.main, '--strict').code, 1)
  assert.deepEqual(JSON.parse(lint(one, one.main, '--json').stdout), [{ level: 'WARN', check: 'proof', rel: 'work/PROJ-12/STATE.md', message: 'proof: PROJ-12 in solo: "./check.sh" last ran on code older than the head of main' }])
})

test('a check whose only run was made on changes that were not committed earns a warning that says so', () => {
  const one = made(solo())
  writeFileSync(join(one.main, 'src/app.js'), 'export const limited = true\n')

  proved(one)

  assert.equal(warned(one), 'WARN proof: PROJ-12 in solo: "./check.sh" last ran on changes that were not committed\n')
})

test('a check that came back red at the head earns a warning with what it exited with, and a later run that passes there takes it away', () => {
  const one = made(solo())
  proved(one)
  proved(one, 3)

  const red = warned(one)
  proved(one)

  assert.equal(red, 'WARN proof: PROJ-12 in solo: "./check.sh" exited 3 at the head of main\n')
  assert.deepEqual(lint(one, one.main), OK)
})

test('a run on changes that were not committed takes nothing from a check proven at the head', () => {
  const one = made(solo())
  proved(one)
  writeFileSync(join(one.main, 'src/app.js'), 'export const next = true\n')

  proved(one, 1)

  assert.deepEqual(lint(one, one.main), OK)
})

test('a recorded check with no run earns a warning, and the line counts how many more checks of the repo lack proof', () => {
  const one = made(solo(TWO_CHECKS))
  const two = made(solo(TWO_CHECKS))
  proved(one, 0, 'npm test')
  proved(two)
  proved(two, 0, 'npm test')

  assert.equal(warned(one), 'WARN proof: PROJ-12 in solo: no run of "./check.sh" is recorded, and 1 more check lacks proof\n')
  assert.equal(warned(two), 'WARN proof: PROJ-12 in solo: no run of "npm run lint" is recorded\n')
  committed(two, { 'src/app.js': 'export const limited = true\n' })
  assert.equal(warned(two), 'WARN proof: PROJ-12 in solo: "./check.sh" last ran on code older than the head of main, and 2 more checks lack proof\n')
})

test('an item built with no run recorded earns the warning, by a Built at line in its state file or in its design', () => {
  const inState = made(solo())
  const inDesign = made(solo())
  put(inState.main, STATE, `---\nstatus: active\n---\n# PROJ-12\n\n## Done\n\n- Built at ${headOf(inState).slice(0, 7)}: the limiter\n`)
  put(inDesign.main, '.context-central/work/PROJ-12/DESIGN.md', `# Design\n\n1. **The limiter.** Its tests. Built at \`${headOf(inDesign)}\`.\n`)

  assert.equal(warned(inState), 'WARN proof: PROJ-12 in solo: no run of "./check.sh" is recorded\n')
  assert.equal(warned(inDesign), 'WARN proof: PROJ-12 in solo: no run of "./check.sh" is recorded\n')
})

test('a Built at line that names a commit the repo does not hold, or no commit at all, says nothing of that repo', () => {
  const one = made(solo())
  put(one.main, STATE, '---\nstatus: active\n---\n# PROJ-12\n\n## Done\n\n- Built at 0123abc: elsewhere\n- Built at last: the limiter\n- Built at main: the rest\n')

  assert.deepEqual(lint(one, one.main), OK)
})

test('a commit that changes only the map ages no proof, where the map is kept in git inside the repo', () => {
  const one = made(solo(KEPT_IN_GIT))
  proved(one)
  const proven = headOf(one)

  const later = committed(one, { [STATE]: '---\nstatus: active\n---\n# PROJ-12\n\nBuilt and verified.\n', 'CLAUDE.md': '# Solo\n\nA rule.\n', '.context-central/concepts/gateway.md': '# The gateway\n' })

  assert.notEqual(later, proven)
  assert.deepEqual(lint(one, one.main), OK)
  committed(one, { 'src/app.js': 'export const limited = true\n' })
  assert.equal(warned(one), 'WARN proof: PROJ-12 in solo: "./check.sh" last ran on code older than the head of main\n')
})

test('a finished item earns no line, whatever its record holds', () => {
  const one = made(solo())
  proved(one)
  committed(one, { 'src/app.js': 'export const limited = true\n' })

  run(['work', 'done', 'PROJ-12'], { cwd: one.main, env: one.env })

  assert.deepEqual(lint(one, one.main), OK)
})

test('where no repo of the estate records a check nothing is said of proof, and a repo that records none is passed over', () => {
  const none = made(solo({ '.context-central/estate.json': { ...SOLO_CONFIG, repos: [{ name: 'solo', path: '.' }] } }))
  const built = made(solo({ '.context-central/estate.json': { ...SOLO_CONFIG, repos: [{ name: 'solo', path: '.' }] } }))
  recorded(none, [{ commit: '0'.repeat(40) }])
  put(built.main, STATE, `---\nstatus: active\n---\n# PROJ-12\n\n- Built at ${headOf(built)}: the limiter\n`)

  assert.deepEqual(lint(none, none.main), OK)
  assert.deepEqual(lint(built, built.main), OK)
})

test('nothing is said of a repo whose last run was on a branch that is gone, or on no branch', () => {
  const gone = made(solo())
  const detached = made(solo())
  recorded(gone, [{ branch: 'work/gone' }])
  recorded(detached, [{ branch: null }])
  committed(gone, { 'src/app.js': 'export const limited = true\n' })
  committed(detached, { 'src/app.js': 'export const limited = true\n' })

  assert.deepEqual(lint(gone, gone.main), OK)
  assert.deepEqual(lint(detached, detached.main), OK)
})

test('the head is that of the branch the last run was made on, so a work tree on another branch does not change what is said', () => {
  const one = made(solo())
  const linked = workTree(one, join(one.base, 'tree'))
  committed(one, { 'src/app.js': 'export const limited = true\n' }, linked)
  proved(one, 0, './check.sh', linked)

  assert.deepEqual(lint(one, one.main), OK)
  assert.deepEqual(lint(one, linked), OK)
  committed(one, { 'src/app.js': 'export const limited = 2\n' }, linked)
  assert.equal(warned(one), 'WARN proof: PROJ-12 in solo: "./check.sh" last ran on code older than the head of work/limit\n')
})

test('with no git on the PATH nothing is said of proof', () => {
  const one = made(solo())
  proved(one)
  committed(one, { 'src/app.js': 'export const limited = true\n' })

  assert.deepEqual(lint({ env: { ...one.env, PATH: tree(makeTree({})) } }, one.main), OK)
})

test('a git that gives no answer in five seconds is asked once for a repo, and nothing is said of that repo', NEEDS_STAND_IN, () => {
  const one = made(solo({ '.context-central/work/PROJ-13/STATE.md': '---\nstatus: active\n---\n# PROJ-13\n' }))
  recorded(one, [{}])
  recorded(one, [{}], join(one.main, '.context-central/work/PROJ-13/proof.jsonl'))
  const standIn = tree(standIns({ git: '#!/bin/sh\necho asked >> "$0.log"\nexec /bin/sleep 7\n' }))

  const result = lint({ env: { ...one.env, PATH: standIn } }, one.main)

  assert.deepEqual(result, OK)
  assert.equal(readFileSync(join(standIn, 'git.log'), 'utf8'), 'asked\n')
})

test('a line of the record that is no run is passed over, and the runs beside it still count', () => {
  const one = made(solo())
  proved(one)
  put(one.main, RECORD, `not a run\n{"repo":"solo","check":"./check.sh","exit":"0"}\n${JSON.stringify({ repo: 'solo', check: './check.sh', exit: 0, commit: headOf(one), branch: 'main', dirty: false, date: '2026-01-15', system: 'linux x64' })}\n[]\n`)

  assert.deepEqual(lint(one, one.main), OK)
})

test('an item that touches two repos earns one line that names each repo where its proof is not whole', () => {
  const settings: Json = { contextCentral: 1, name: 'pair', repos: [{ name: 'web', checks: ['npm test'] }, { name: 'api', checks: ['./check.sh'] }, { name: 'docs' }] }
  const base = tree(makeTree({ 'estate.json': settings, 'CLAUDE.md': '# Pair\n', 'work/PROJ-12/STATE.md': '---\nstatus: active\n---\n# PROJ-12\n', gitconfig: '' }))
  const env = { GIT_CONFIG_GLOBAL: join(base, 'gitconfig'), GIT_CONFIG_NOSYSTEM: '1' }
  for (const repo of ['web', 'api', 'docs']) {
    put(base, `${repo}/src/app.js`, 'export {}\n')
    git({ env }, join(base, repo), 'init', '-q', '-b', 'main')
    git({ env }, join(base, repo), 'add', '-A')
    git({ env }, join(base, repo), 'commit', '-q', '-m', 'first')
  }
  const inRepo = (repo: string, ...args: string[]) => run(args, { cwd: join(base, repo), env })
  inRepo('web', 'proof', 'PROJ-12', '--check', 'npm test', '--exit', '0')
  inRepo('api', 'proof', 'PROJ-12', '--check', './check.sh', '--exit', '2')

  const whole = inRepo('web', 'lint').stdout
  put(base, 'web/src/app.js', 'export const changed = true\n')
  git({ env }, join(base, 'web'), 'commit', '-q', '-am', 'second')

  assert.equal(whole, 'WARN proof: PROJ-12 in api: "./check.sh" exited 2 at the head of main\n')
  assert.equal(run(['lint'], { cwd: base, env }).stdout, 'WARN proof: PROJ-12 in web: "npm test" last ran on code older than the head of main; in api: "./check.sh" exited 2 at the head of main\n')
})

test('a line whose commit is not a whole commit id, or whose branch holds a control character, is no run: it never reaches git and no reader stops on it', () => {
  const one = made(solo({ 'kept.txt': 'kept\n' }))
  const kept = join(one.main, 'kept.txt')
  recorded(one, [{ branch: 'ma\u0000in' }, { branch: 'ma\nin' }, { branch: '' }, { commit: 'main' }, { commit: headOf(one).slice(0, 7) }, { commit: `${headOf(one).slice(0, 20)}\u0000${headOf(one).slice(20)}` }, { commit: `--output=${kept}` }])
  committed(one, { 'src/app.js': 'export const limited = true\n' })

  assert.deepEqual(lint(one, one.main), OK)
  assert.equal(readFileSync(kept, 'utf8'), 'kept\n')
  assert.deepEqual(run(['work', 'done', 'PROJ-12'], { cwd: one.main, env: one.env }), { code: 0, stdout: 'PROJ-12: done\n', stderr: '' })
})

test('a run at a commit git no longer holds is on older code', () => {
  const one = made(solo())
  recorded(one, [{ commit: 'abcdef0123456789abcdef0123456789abcdef01' }])

  assert.equal(warned(one), 'WARN proof: PROJ-12 in solo: "./check.sh" last ran on code older than the head of main\n')
})

test('an empty record holds no run', () => {
  const built = made(solo())
  const notBuilt = made(solo())
  put(built.main, RECORD, '')
  put(notBuilt.main, RECORD, '\n\n')
  put(built.main, STATE, `---\nstatus: active\n---\n# PROJ-12\n\n- Built at ${headOf(built)}: the limiter\n`)

  assert.equal(warned(built), 'WARN proof: PROJ-12 in solo: no run of "./check.sh" is recorded\n')
  assert.deepEqual(lint(notBuilt, notBuilt.main), OK)
})

test('a check that a repo lists twice is one check', () => {
  const one = made(solo({ '.context-central/estate.json': { ...SOLO_CONFIG, repos: [{ name: 'solo', path: '.', checks: ['./check.sh', './check.sh'] }] } }))

  proved(one, 2)

  assert.equal(warned(one), 'WARN proof: PROJ-12 in solo: "./check.sh" exited 2 at the head of main\n')
})

test('the branch of a run is found where a tag carries the same name, so its proof still ages', () => {
  const one = made(solo())
  git(one, one.main, 'tag', 'main')
  proved(one)

  committed(one, { 'src/app.js': 'export const limited = true\n' })

  assert.equal(warned(one), 'WARN proof: PROJ-12 in solo: "./check.sh" last ran on code older than the head of main\n')
})

test('a repo whose folder is missing is passed over, and the other repos of the item are still judged', () => {
  const settings: Json = { contextCentral: 1, name: 'pair', repos: [{ name: 'web', checks: ['npm test'] }, { name: 'api', checks: ['./check.sh'] }] }
  const base = tree(makeTree({ 'estate.json': settings, 'CLAUDE.md': '# Pair\n', 'work/PROJ-12/STATE.md': '---\nstatus: active\n---\n# PROJ-12\n', gitconfig: '' }))
  const env = { GIT_CONFIG_GLOBAL: join(base, 'gitconfig'), GIT_CONFIG_NOSYSTEM: '1' }
  for (const repo of ['web', 'api']) {
    put(base, `${repo}/src/app.js`, 'export {}\n')
    git({ env }, join(base, repo), 'init', '-q', '-b', 'main')
    git({ env }, join(base, repo), 'add', '-A')
    git({ env }, join(base, repo), 'commit', '-q', '-m', 'first')
  }
  run(['proof', 'PROJ-12', '--check', 'npm test', '--exit', '1'], { cwd: join(base, 'web'), env })
  run(['proof', 'PROJ-12', '--check', './check.sh', '--exit', '1'], { cwd: join(base, 'api'), env })

  rmSync(join(base, 'api'), { recursive: true })

  assert.equal(run(['lint'], { cwd: base, env }).stdout, 'WARN proof: PROJ-12 in web: "npm test" exited 1 at the head of main\n')
})

test('the largest record, ten thousand runs, is read whole and judged by its last run at the head', () => {
  const one = made(solo())
  const older = { repo: 'solo', check: './check.sh', exit: 1, commit: headOf(one), branch: 'main', dirty: false, date: '2026-01-15', system: 'linux x64' }
  put(one.main, RECORD, `${Array(9999).fill(JSON.stringify(older)).join('\n')}\n${JSON.stringify({ ...older, exit: 0 })}\n`)

  assert.deepEqual(lint(one, one.main), OK)
})

test('a check is compared with the head at twenty commits of its record at most, the newest first, and a run older than those is on older code', NEEDS_STAND_IN, () => {
  const one = made(solo())
  const real = process.env.PATH ?? ''
  const counting = tree(standIns({ git: `#!/bin/sh\necho "$*" >> "$0.log"\nPATH='${real}' exec git "$@"\n` }))
  recorded(one, Array.from({ length: 30 }, (_, at) => ({ commit: String(at).padStart(40, 'a') })))

  const result = lint({ env: { ...one.env, PATH: counting } }, one.main)

  assert.equal(result.stdout, 'WARN proof: PROJ-12 in solo: "./check.sh" last ran on code older than the head of main\n')
  assert.equal(readFileSync(join(counting, 'git.log'), 'utf8').split('\n').filter(line => line.startsWith('diff ')).length, 20)
})
