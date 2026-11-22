import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { NEEDS_STAND_IN, SOLO_CONFIG, disposable, git, makeTree, run, solo, standIns, workTree } from './helpers.mts'
import type { Checkout, TreeFiles } from './helpers.mts'

const tree = disposable()

const NAME = 'limits'
const SHEET = 'research/limits/index.md'
const LIMIT = { 'src/limit.js': 'const LIMIT = 60\n\nexport function limited(calls) {\n  return calls > LIMIT\n}\n' }
const AT_ITS_EDGE = 'const LIMIT = 60\n\nexport function limited(calls) {\n  return calls >= LIMIT\n}\n'
const PAST_ITS_EDGE = 'const LIMIT = 60\n\nexport function limited(calls) {\n  return calls - 1 >= LIMIT\n}\n'
const OPENING = ['---', 'research: limits', '---', '# Limits', '', '## Facts', '']
const NOT_MOVED = 'The one fact that cites a line of a repo has not moved since the commit it was read at.\n'
const ONE_MOVED = 'The one fact that cites a line of a repo has moved since the commit it was read at.\n'
const ONE_NOT_COMPARED = `${NOT_MOVED.trimEnd()} 1 has a line that was not compared.\n`
const USAGE = 'expected one of: new <name> [--title <title>] [--item <item>] [--json], open <name> [--json], moved <name> [--json]'

const made = (one: Checkout) => (tree(one.base), one)
const headOf = (one: Checkout, dir = one.main) => git(one, dir, 'rev-parse', 'HEAD').stdout.trim()
const shortOf = (one: Checkout, dir = one.main) => headOf(one, dir).slice(0, 7)
const moved = (one: Pick<Checkout, 'env'>, cwd: string, ...args: string[]) => run(['research', 'moved', NAME, ...args], { cwd, env: one.env })
const said = (...lines: string[]) => ({ code: 0, stdout: lines.map(line => `${line}\n`).join(''), stderr: '' })
const page = (...below: string[]) => [...OPENING, ...below, ''].join('\n')
const fact = (number: number, ...nested: string[]) => [`- **F${number}** \`verified\` A limit is compared in one place.`, ...nested.map(line => `  - ${line}`)]

function put(root: string, path: string, content: string) {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), content)
}

function committed(one: Checkout, files: TreeFiles, dir = one.main) {
  for (const [path, content] of Object.entries(files)) put(dir, path, String(content))
  git(one, dir, 'add', '-A')
  git(one, dir, 'commit', '-q', '-m', 'more')
  return headOf(one, dir).slice(0, 7)
}

function sheet(one: Checkout, ...below: string[]) {
  put(one.main, `.context-central/${SHEET}`, page(...below))
}

function estateOf(repos: string[], files: TreeFiles, settings: TreeFiles = {}) {
  const base = tree(makeTree({ 'estate.json': { contextCentral: 1, name: 'acme', repos: repos.map(name => ({ name })), ...settings }, 'CLAUDE.md': '# Acme\n', gitconfig: '', ...files }))
  const env = { GIT_CONFIG_GLOBAL: join(base, 'gitconfig'), GIT_CONFIG_NOSYSTEM: '1' }
  const repo = (name: string): Checkout => ({ base, main: join(base, name), env })
  for (const one of repos.map(repo)) {
    git(one, one.main, 'init', '-q', '-b', 'main')
    committed(one, {})
  }
  return { base, env, repo }
}

test('a fact whose cited line reads as it did at the commit its line names earns no line, though its file has changed round it', () => {
  const one = made(solo(LIMIT))
  sheet(one, ...fact(1, `Source: \`src/limit.js:1\` at \`${shortOf(one)}\``))

  committed(one, { 'src/limit.js': 'const LIMIT = 60\nconst WINDOW = 1000\n\nexport function limited(calls) {\n  return calls > LIMIT\n}\n' })

  assert.deepEqual(moved(one, one.main), said(NOT_MOVED.trimEnd()))
})

test('a fact whose cited line no longer reads as it did is listed with the citation as written, its commit and its place on the sheet, and the command still exits 0', () => {
  const one = made(solo(LIMIT))
  const read = shortOf(one)
  sheet(one, ...fact(1, `Source: \`src/limit.js:4\` at \`${read}\``))

  committed(one, { 'src/limit.js': AT_ITS_EDGE })

  assert.deepEqual(moved(one, one.main), said(`F1 has moved: \`src/limit.js:4\` at \`${read}\` (${SHEET}:9)`, ONE_MOVED.trimEnd()))
})

test('a cited line changed only in the white space at its ends has not moved', () => {
  const one = made(solo(LIMIT))
  sheet(one, ...fact(1, `Source: \`src/limit.js:4\` at \`${shortOf(one)}\``))

  committed(one, { 'src/limit.js': 'const LIMIT = 60\r\n\r\nexport function limited(calls) {\r\n\t\treturn calls > LIMIT  \r\n}\r\n' })

  assert.deepEqual(moved(one, one.main), said(NOT_MOVED.trimEnd()))
})

test('a cited line whose file is gone at the head has moved', () => {
  const one = made(solo(LIMIT))
  const read = shortOf(one)
  sheet(one, ...fact(1, `Source: \`src/limit.js:4\` at \`${read}\``))

  rmSync(join(one.main, 'src/limit.js'))
  committed(one, { 'src/limits.js': LIMIT['src/limit.js'] })

  assert.deepEqual(moved(one, one.main), said(`F1 has moved: \`src/limit.js:4\` at \`${read}\` (${SHEET}:9)`, ONE_MOVED.trimEnd()))
})

test('a cited range has moved when any line of it reads another way, and not when the lines beside it do', () => {
  const beside = made(solo(LIMIT))
  const inside = made(solo(LIMIT))
  const read = shortOf(inside)
  for (const one of [beside, inside]) sheet(one, ...fact(1, `Source: \`src/limit.js:3-5\` at \`${shortOf(one)}\``))

  committed(beside, { 'src/limit.js': 'const LIMIT = 90\n\nexport function limited(calls) {\n  return calls > LIMIT\n}\n' })
  committed(inside, { 'src/limit.js': AT_ITS_EDGE })

  assert.deepEqual(moved(beside, beside.main), said(NOT_MOVED.trimEnd()))
  assert.deepEqual(moved(inside, inside.main), said(`F1 has moved: \`src/limit.js:3-5\` at \`${read}\` (${SHEET}:9)`, ONE_MOVED.trimEnd()))
})

test('a line cited on a From line of a fact is compared as one on a Source line is', () => {
  const one = made(solo(LIMIT))
  const read = shortOf(one)
  sheet(one, '- **F2** `inferred` An export is limited the same way, since it calls the limiter.', `  - From: F1 and \`src/limit.js:4\` at \`${read}\``)

  committed(one, { 'src/limit.js': AT_ITS_EDGE })

  assert.deepEqual(moved(one, one.main), said(`F2 has moved: \`src/limit.js:4\` at \`${read}\` (${SHEET}:9)`, ONE_MOVED.trimEnd()))
})

test('a cited line whose own line names no commit is said as not compared, and counts as no fact that moved', () => {
  const one = made(solo(LIMIT))
  sheet(one, ...fact(1, 'Source: `src/limit.js:4`'))

  committed(one, { 'src/limit.js': AT_ITS_EDGE })

  assert.deepEqual(moved(one, one.main), said(`F1 was not compared: its line names no commit (\`src/limit.js:4\`, ${SHEET}:9)`, ONE_NOT_COMPARED.trimEnd()))
})

test('a cited line read at a commit the repo does not hold is said as not compared, with the commit as written', () => {
  const one = made(solo(LIMIT))
  sheet(one, ...fact(1, 'Source: `src/limit.js:4` at `0123abc`'))

  committed(one, { 'src/limit.js': AT_ITS_EDGE })

  assert.deepEqual(moved(one, one.main), said(`F1 was not compared: repo solo does not hold the commit \`0123abc\` (\`src/limit.js:4\`, ${SHEET}:9)`, ONE_NOT_COMPARED.trimEnd()))
})

test('a tag named as a commit is written does not stand in for a commit the repo does not hold', () => {
  const one = made(solo(LIMIT))
  committed(one, { 'src/limit.js': AT_ITS_EDGE })
  git(one, one.main, 'tag', '0123abc', 'HEAD~1')
  sheet(one, ...fact(1, 'Source: `src/limit.js:4` at `0123abc`'))

  assert.deepEqual(moved(one, one.main), said(`F1 was not compared: repo solo does not hold the commit \`0123abc\` (\`src/limit.js:4\`, ${SHEET}:9)`, ONE_NOT_COMPARED.trimEnd()))
})

test('a cited line read at a commit that is not yet in the history of the head is said as not compared, and is compared once the head holds it', () => {
  const one = made(solo(LIMIT))
  git(one, one.main, 'checkout', '-q', '-b', 'work/limit')
  const built = committed(one, { 'src/limit.js': AT_ITS_EDGE })
  committed(one, { 'src/limit.js': PAST_ITS_EDGE })
  git(one, one.main, 'checkout', '-q', 'main')
  sheet(one, ...fact(1, `Source: \`src/limit.js:4\` at \`${built}\``))

  const onTheBase = moved(one, one.main)
  git(one, one.main, 'merge', '-q', 'work/limit')

  assert.deepEqual(onTheBase, said(`F1 was not compared: the commit is not behind the head of repo solo (\`src/limit.js:4\`, ${SHEET}:9)`, ONE_NOT_COMPARED.trimEnd()))
  assert.deepEqual(moved(one, one.main), said(`F1 has moved: \`src/limit.js:4\` at \`${built}\` (${SHEET}:9)`, ONE_MOVED.trimEnd()))
})

test('a cited line of a file that was not there at the commit is said as not compared, where a standards note stays silent', () => {
  const one = made(solo(LIMIT))
  sheet(one, ...fact(1, `Source: \`src/window.js:1\` at \`${shortOf(one)}\``))

  committed(one, { 'src/window.js': 'export const WINDOW = 1000\n' })

  assert.deepEqual(moved(one, one.main), said(`F1 was not compared: repo solo holds no such file at the commit (\`src/window.js:1\`, ${SHEET}:9)`, ONE_NOT_COMPARED.trimEnd()))
})

test("a line of a repo below the estate root is cited with the repo's path on it, and git is asked in that repo's own folder", () => {
  const acme = estateOf(['api', 'web'], { 'api/src/limit.js': LIMIT['src/limit.js'] })
  const read = shortOf(acme.repo('api'))
  put(acme.base, SHEET, page(...fact(1, `Source: \`api/src/limit.js:4\` at \`${read}\``), ...fact(2, `Source: \`src/limit.js:4\` at \`${read}\``)))

  committed(acme.repo('api'), { 'src/limit.js': AT_ITS_EDGE })

  assert.deepEqual(
    moved(acme, acme.base),
    said(
      `F1 has moved: \`api/src/limit.js:4\` at \`${read}\` (${SHEET}:9)`,
      `F2 was not compared: it is in no repo the map registers (\`src/limit.js:4\`, ${SHEET}:11)`,
      '1 of 2 facts that cite a line of a repo has moved since the commit it was read at. 1 has a line that was not compared.',
    ),
  )
})

test('facts that cite lines of two repos are each compared with the head of their own repo', () => {
  const acme = estateOf(['api', 'web'], { 'api/src/limit.js': LIMIT['src/limit.js'], 'api/README.md': '# api\n', 'web/src/limit.js': LIMIT['src/limit.js'] })
  const api = shortOf(acme.repo('api'))
  const web = shortOf(acme.repo('web'))
  put(acme.base, SHEET, page(...fact(1, `Source: \`api/src/limit.js:4\` at \`${api}\``), ...fact(2, `Source: \`web/src/limit.js:4\` at \`${web}\``), ...fact(3, `Source: \`web/src/limit.js:4\` at \`${api}\``)))

  committed(acme.repo('web'), { 'src/limit.js': AT_ITS_EDGE })

  assert.deepEqual(
    moved(acme, acme.base),
    said(
      `F2 has moved: \`web/src/limit.js:4\` at \`${web}\` (${SHEET}:11)`,
      `F3 was not compared: repo web does not hold the commit \`${api}\` (\`web/src/limit.js:4\`, ${SHEET}:13)`,
      '1 of 3 facts that cite a line of a repo has moved since the commit it was read at. 1 has a line that was not compared.',
    ),
  )
})

test('a cited path that lies in no repo the map registers is said as not compared: in a folder of notes, in one the estate leaves alone and in one it does not name', () => {
  const acme = estateOf(['api'], { 'concepts/gateway.md': '# The gateway\n', 'scratch/try.js': 'export {}\n', 'elsewhere/readme.md': '# Elsewhere\n' }, { leftAlone: ['scratch'] })
  const read = shortOf(acme.repo('api'))
  put(acme.base, SHEET, page(...fact(1, `Source: \`concepts/gateway.md:1\` at \`${read}\``, `Source: \`scratch/try.js:1\` at \`${read}\``, `Source: \`elsewhere/readme.md:1\` at \`${read}\``)))

  assert.deepEqual(
    moved(acme, acme.base),
    said(
      `F1 was not compared: it is in no repo the map registers (\`concepts/gateway.md:1\`, ${SHEET}:9)`,
      `F1 was not compared: it is in no repo the map registers (\`scratch/try.js:1\`, ${SHEET}:10)`,
      `F1 was not compared: it is in no repo the map registers (\`elsewhere/readme.md:1\`, ${SHEET}:11)`,
      ONE_NOT_COMPARED.trimEnd(),
    ),
  )
})

test('with no git on the PATH nothing is compared, which is said, and the command exits 1', () => {
  const one = made(solo(LIMIT))
  sheet(one, ...fact(1, `Source: \`src/limit.js:4\` at \`${shortOf(one)}\``))

  assert.deepEqual(moved({ env: { ...one.env, PATH: tree(makeTree({})) } }, one.main), { code: 1, stdout: '', stderr: 'context-central research: git was not found on the PATH, so nothing was compared\n' })
})

test('a superseded fact, which is in the log and no longer on the sheet, is left out', () => {
  const one = made(solo(LIMIT))
  const read = shortOf(one)
  sheet(one, ...fact(2, `Source: \`src/limit.js:1\` at \`${read}\``, 'Supersedes F1, 2026-01-14: the comparison changed.'))
  put(one.main, '.context-central/research/limits/log.md', ['# Limits: the log', '', '## Round 2, 2026-01-14', '', '### Superseded', '', ...fact(1, `Source: \`src/limit.js:4\` at \`${read}\``), ''].join('\n'))

  committed(one, { 'src/limit.js': AT_ITS_EDGE })

  assert.deepEqual(moved(one, one.main), said(NOT_MOVED.trimEnd()))
})

test('with --json every cited line is given, held or not, as its fact, its citation, its commit, its repo, how it was judged and its place', () => {
  const one = made(solo(LIMIT))
  const read = shortOf(one)
  sheet(one, ...fact(1, `Source: \`src/limit.js:4\` at \`${read}\``, `Source: \`src/limit.js:1\` at \`${read}\``), ...fact(2, 'Source: `src/limit.js:3-5`'))

  committed(one, { 'src/limit.js': AT_ITS_EDGE })
  const result = moved(one, one.main, '--json')

  assert.equal(result.code, 0)
  assert.deepEqual(JSON.parse(result.stdout), [
    { fact: 'F1', span: 'src/limit.js:4', commit: read, repo: 'solo', state: 'moved', at: `${SHEET}:9` },
    { fact: 'F1', span: 'src/limit.js:1', commit: read, repo: 'solo', state: 'held', at: `${SHEET}:10` },
    { fact: 'F2', span: 'src/limit.js:3-5', commit: null, repo: 'solo', state: 'no commit', at: `${SHEET}:12` },
  ])
})

test('with --json a path in no registered repo has no repo, and a research that cites no line gives an empty list', () => {
  const acme = estateOf(['api'], { 'elsewhere/readme.md': '# Elsewhere\n' })
  put(acme.base, SHEET, page(...fact(1, 'Source: `elsewhere/readme.md:1` at `0123abc`')))
  put(acme.base, 'research/bare/index.md', '---\nresearch: bare\n---\n# Bare\n')

  assert.deepEqual(JSON.parse(moved(acme, acme.base, '--json').stdout), [{ fact: 'F1', span: 'elsewhere/readme.md:1', commit: '0123abc', repo: null, state: 'no repo', at: `${SHEET}:9` }])
  assert.deepEqual(run(['research', 'moved', 'bare', '--json'], { cwd: acme.base, env: acme.env }), { code: 0, stdout: '[]\n', stderr: '' })
})

test('a research no fact of which cites a line of a repo says so, with no git asked for: a saved source, a full address, a path with no line and a commit alone are no cited line', () => {
  const one = made(solo(LIMIT))
  sheet(one, ...fact(1, 'Source: [01-2026-01-14-chat-limits-full-text.md](sources/01-2026-01-14-chat-limits-full-text.md)', 'Source: https://example.com/limits: 60', `Source: \`src/limit.js\` at \`${shortOf(one)}\``, 'Source: the limiter, `LIMIT`'), '- **F2** `inferred` Nothing else compares it.', '  - From: F1')

  assert.deepEqual(moved({ env: { ...one.env, PATH: tree(makeTree({})) } }, one.main), said('No fact of limits cites a line of a repo.'))
})

test('a research that is not there, a folder for researches that is not the plugin\'s to use, no name and a flag of another action are each refused as research open refuses them', () => {
  const one = made(solo({ ...LIMIT, '.context-central/research/limits/index.md': page() }))
  const taken = made(solo({ ...LIMIT, '.context-central/estate.json': { ...SOLO_CONFIG, researchDir: 'kept', notNodes: ['kept'] }, '.context-central/kept/limits/index.md': page() }))
  const refused = (code: number, line: string) => ({ code, stdout: '', stderr: `context-central research: ${line}\n` })

  assert.deepEqual(run(['research', 'moved', 'retries'], { cwd: one.main, env: one.env }), refused(1, 'no research "retries" in this map. Its researches: limits.'))
  assert.deepEqual(moved(taken, taken.main), refused(1, 'kept is under a notNodes entry, so it holds no research: name another folder with "researchDir" in estate.json'))
  assert.deepEqual(run(['research', 'moved'], { cwd: one.main, env: one.env }), refused(2, USAGE))
  assert.deepEqual(moved(one, one.main, '--title', 'x'), refused(2, '--title does not go with moved'))
  assert.match(run(['research', 'moved', NAME], { cwd: tree(makeTree({ 'readme.txt': 'x\n' })) }).stderr, /^context-central research: no context map found/)
})

test('a repo whose folder is missing, and one whose folder is in no repository, are said on the lines of their facts as not compared, and the repo beside them is still compared', () => {
  const acme = estateOf(['api'], { 'api/src/limit.js': LIMIT['src/limit.js'], 'web/src/page.js': 'export {}\n' }, { repos: [{ name: 'api' }, { name: 'web' }, { name: 'gone' }] })
  const read = shortOf(acme.repo('api'))
  put(acme.base, SHEET, page(...fact(1, `Source: \`api/src/limit.js:4\` at \`${read}\``), ...fact(2, `Source: \`web/src/page.js:1\` at \`${read}\``), ...fact(3, `Source: \`gone/src/page.js:1\` at \`${read}\``)))

  committed(acme.repo('api'), { 'src/limit.js': AT_ITS_EDGE })

  assert.deepEqual(
    moved(acme, acme.base),
    said(
      `F1 has moved: \`api/src/limit.js:4\` at \`${read}\` (${SHEET}:9)`,
      `F2 was not compared: git gave no answer in repo web (\`web/src/page.js:1\`, ${SHEET}:11)`,
      `F3 was not compared: git gave no answer in repo gone (\`gone/src/page.js:1\`, ${SHEET}:13)`,
      '1 of 3 facts that cite a line of a repo has moved since the commit it was read at. 2 have a line that was not compared.',
    ),
  )
})

test('in a git work tree a cited line is compared with the head of the work tree, and in the main checkout with its own', () => {
  const one = made(solo(LIMIT))
  const read = shortOf(one)
  sheet(one, ...fact(1, `Source: \`src/limit.js:4\` at \`${read}\``))
  const linked = workTree(one, join(one.base, 'tree'))

  committed(one, { 'src/limit.js': AT_ITS_EDGE }, linked)

  assert.deepEqual(moved(one, linked), said(`F1 has moved: \`src/limit.js:4\` at \`${read}\` (${SHEET}:9)`, ONE_MOVED.trimEnd()))
  assert.deepEqual(moved(one, one.main), said(NOT_MOVED.trimEnd()))
})

test('each line under a fact is read at the commit it names itself, and two citations on one line share the last commit of that line', () => {
  const one = made(solo({ ...LIMIT, 'src/window.js': 'export const WINDOW = 1000\n' }))
  const first = shortOf(one)
  const second = committed(one, { 'src/limit.js': AT_ITS_EDGE })
  sheet(one, ...fact(1, `Source: \`src/limit.js:4\` at \`${first}\``, `Source: \`src/limit.js:4\` at \`${second}\``, `Source: \`src/limit.js:4\` at \`${first}\` and \`src/window.js:1\` at \`${second}\``))

  assert.deepEqual(moved(one, one.main), said(`F1 has moved: \`src/limit.js:4\` at \`${first}\` (${SHEET}:9)`, ONE_MOVED.trimEnd()))
})

test('a fact on a page of the sheet is compared as one on the sheet is, with the page as its place', () => {
  const one = made(solo(LIMIT))
  const read = shortOf(one)
  sheet(one, '- [Limits](facts-limits.md): F1')
  put(one.main, '.context-central/research/limits/facts-limits.md', ['# Limits', '', ...fact(1, `Source: \`src/limit.js:4\` at \`${read}\``), ''].join('\n'))

  committed(one, { 'src/limit.js': AT_ITS_EDGE })

  assert.deepEqual(moved(one, one.main), said(`F1 has moved: \`src/limit.js:4\` at \`${read}\` (research/limits/facts-limits.md:4)`, ONE_MOVED.trimEnd()))
})

test('the last line counts facts and not cited lines: a fact with two lines that moved is one, and the words follow the counts', () => {
  const one = made(solo({ ...LIMIT, 'src/window.js': 'export const WINDOW = 1000\n' }))
  const read = shortOf(one)
  const lines = [`Source: \`src/limit.js:4\` at \`${read}\``, `Source: \`src/window.js:1\` at \`${read}\``]
  sheet(one, ...fact(1, ...lines), ...fact(2, lines[1], 'Source: `src/limit.js:1`'), ...fact(3, `Source: \`src/limit.js:1\` at \`${read}\``), ...fact(4, 'Source: `src/limit.js:5`'))
  const none = moved(one, one.main)

  committed(one, { 'src/limit.js': AT_ITS_EDGE, 'src/window.js': 'export const WINDOW = 500\n' })

  assert.deepEqual(none, said(
    `F2 was not compared: its line names no commit (\`src/limit.js:1\`, ${SHEET}:13)`,
    `F4 was not compared: its line names no commit (\`src/limit.js:5\`, ${SHEET}:17)`,
    'None of 4 facts that cite a line of a repo has moved since the commit it was read at. 2 have a line that was not compared.',
  ))
  assert.deepEqual(moved(one, one.main), said(
    `F1 has moved: \`src/limit.js:4\` at \`${read}\` (${SHEET}:9)`,
    `F1 has moved: \`src/window.js:1\` at \`${read}\` (${SHEET}:10)`,
    `F2 has moved: \`src/window.js:1\` at \`${read}\` (${SHEET}:12)`,
    `F2 was not compared: its line names no commit (\`src/limit.js:1\`, ${SHEET}:13)`,
    `F4 was not compared: its line names no commit (\`src/limit.js:5\`, ${SHEET}:17)`,
    '2 of 4 facts that cite a line of a repo have moved since the commit they were read at. 2 have a line that was not compared.',
  ))
})

test('a git that exits other than 0 is said on the line of every fact as no answer, and the command still exits 0', NEEDS_STAND_IN, () => {
  const one = made(solo(LIMIT))
  sheet(one, ...fact(1, `Source: \`src/limit.js:4\` at \`${shortOf(one)}\``))
  const standIn = tree(standIns({ git: '#!/bin/sh\necho "fatal: refused" >&2\nexit 128\n' }))

  assert.deepEqual(moved({ env: { ...one.env, PATH: standIn } }, one.main), said(`F1 was not compared: git gave no answer in repo solo (\`src/limit.js:4\`, ${SHEET}:9)`, ONE_NOT_COMPARED.trimEnd()))
})

test('the largest research, a hundred facts that cite a hundred files of one repo, starts git twice', NEEDS_STAND_IN, () => {
  const files = Object.fromEntries(Array.from({ length: 100 }, (_, at) => [`src/part-${at}.js`, `export const part = ${at}\n`]))
  const one = made(solo(files))
  const read = headOf(one)
  const real = process.env.PATH ?? ''
  const counting = tree(standIns({ git: `#!/bin/sh\necho "$*" >> "$0.log"\nPATH='${real}' exec git "$@"\n` }))
  sheet(one, ...Object.keys(files).flatMap((path, at) => fact(at + 1, `Source: \`${path}:1\` at \`${read.slice(0, 7)}\``)))
  committed(one, { 'src/part-99.js': 'export const part = 0\n' })

  const result = moved({ env: { ...one.env, PATH: counting } }, one.main)

  assert.deepEqual(result, said(`F100 has moved: \`src/part-99.js:1\` at \`${read.slice(0, 7)}\` (${SHEET}:207)`, '1 of 100 facts that cite a line of a repo has moved since the commit it was read at.'))
  assert.equal(readFileSync(join(counting, 'git.log'), 'utf8'), `cat-file --batch --follow-symlinks\nrev-list ${read} --not HEAD\n`)
})
