import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { LOCK, NEEDS_STAND_IN, acme, checkout, disposable, git, leftByAWrite, makeTree, notOnWindows, run, spawned, standIns, workTree } from './helpers.mts'
import type { Checkout, TreeFiles } from './helpers.mts'

const tree = disposable()

const MAP = '.context-central'
const NODE_DIRS = ['repos', 'areas', 'concepts', 'edges', 'decisions', 'docs', 'standards', 'log', 'work']
const EXCLUDE = '.git/info/exclude'
const EXCLUDED = '# what this checkout alone keeps out of git\n'
const BLOCK = '<!-- context-central:start -->'
const INNER_FILES = [`${MAP}/estate.json`, ...NODE_DIRS.map(dir => `${MAP}/${dir}/`), 'CLAUDE.local.md', `${MAP}/glossary.md`]
const SOLO = { contextCentral: 1, name: 'solo', hub: 'CLAUDE.local.md', repos: [{ name: 'solo', path: '.' }], connections: {} }

function fresh(files: TreeFiles = {}) {
  const made = checkout({ 'README.md': '# Solo\n', 'src/app.js': 'export {}\n', ...files })
  tree(made.base)
  mkdirSync(join(made.main, '.git', 'info'), { recursive: true })
  writeFileSync(join(made.main, EXCLUDE), EXCLUDED)
  return made
}

const plain = (made: Pick<Checkout, 'env'>, cwd: string, ...args: string[]) => run(['init', ...args, '--plain'], { cwd, env: made.env })
const read = (root: string, rel: string) => readFileSync(join(root, rel), 'utf8')
const json = (made: Checkout, cwd: string, ...args: string[]) => JSON.parse(run(args, { cwd, env: made.env }).stdout) as unknown
const shownByGit = (made: Checkout) => git(made, made.main, 'status', '--porcelain', '--untracked-files=all').stdout
const said = (dir: string, word: string, files: string[]) => [`plain map at ${dir}:`, ...files.map(file => `${word} ${file}`), ''].join('\n')
const LINKS = notOnWindows('symlinks need a right most Windows accounts lack')
const ONE_NAME_UNDER_BOTH_CASES = (() => {
  const probe = makeTree({ 'a.md': '' })
  const one = existsSync(join(probe, 'A.md'))
  rmSync(probe, { recursive: true, force: true })
  return one
})()
const BLIND_TO_CASE = ONE_NAME_UNDER_BOTH_CASES ? {} : { skip: 'this disk tells the cases of letters apart' }
const TELLS_CASES_APART = ONE_NAME_UNDER_BOTH_CASES ? { skip: 'this disk takes a name under both cases of its letters as one' } : {}
const ONBOARD = 'set the map up with /context-central:onboard'
const refusedAs = (line: string) => ({ code: 1, stdout: '', stderr: `context-central init: ${line}\n` })
const tracked = (path: string) => refusedAs(`${path} is tracked by git, so a plain map there could not be kept out of git; ${ONBOARD}`)
const trackedAs = (path: string, landing: string) => refusedAs(`${path} would be written as ${landing}, which git tracks, so a plain map there could not be kept out of git; ${ONBOARD}`)
const laidDown = (hub: string) => refusedAs(`"${hub}" names a file or a folder that init lays down for the map itself, so it cannot be the hub`)
const laidUnder = (hub: string, own: string) => refusedAs(`"${hub}" lies under ${own}, which init lays down for the map itself, so it cannot be the hub`)
const gitsOwn = (path: string, what: string) => refusedAs(`${path} lies in a folder git keeps for itself, so ${what}`)
const caseUnset = (made: Checkout) => git(made, made.main, 'config', '--unset', 'core.ignorecase')
const renamed = (dir: string, from: string, to: string) => (renameSync(join(dir, from), join(dir, `${to}.moving`)), renameSync(join(dir, `${to}.moving`), join(dir, to)))
const ANY_DISK = 'a hub\'s name holds none of < > : " | ? * and no sign below a space, no part of it ends in a space or a dot or is longer than 255 bytes, and none is a name Windows keeps for a device, such as NUL or con.md, so that every disk can hold it'
const wrongName = (asked: string) => ({ code: 2, stdout: '', stderr: `context-central init: --hub "${asked}": a hub is a file counted from the estate root, with forward slashes, and no part that is empty, "." or ".."\n` })

test('in a fresh checkout a dry run of a plain map lists every file it would write or change, and writes nothing', () => {
  const made = fresh()

  const result = plain(made, made.main, '--dry-run')

  assert.deepEqual(result, { code: 0, stdout: [`plain map at ${made.main}:`, `would update ${EXCLUDE}`, ...INNER_FILES.map(file => `would create ${file}`), ''].join('\n'), stderr: '' })
  assert.deepEqual(readdirSync(made.main).sort(), ['.git', 'README.md', 'src'])
  assert.equal(read(made.main, EXCLUDE), EXCLUDED)
})

test('a plain map in a checkout is the map in its own folder with the hub beside it, and git shows nothing new', () => {
  const made = fresh()

  const result = plain(made, made.main)

  assert.deepEqual(result, { code: 0, stdout: [`plain map at ${made.main}:`, `updated ${EXCLUDE}`, ...INNER_FILES.map(file => `created ${file}`), ''].join('\n'), stderr: '' })
  assert.deepEqual(JSON.parse(read(made.main, `${MAP}/estate.json`)) as unknown, SOLO)
  assert.equal(read(made.main, EXCLUDE), `${EXCLUDED}\n${MAP}/\nCLAUDE.local.md\n`)
  assert.equal(shownByGit(made), '')
  assert.deepEqual(leftByAWrite(made.main), [])
})

test('a plain map registers the checkout as its one repo, so standards gives its folder and doctor finds nothing to fix', () => {
  const made = fresh()
  plain(made, made.main)

  const doctor = run(['doctor'], { cwd: made.main, env: made.env })

  assert.deepEqual(json(made, made.main, 'config', '--get', 'repos'), [{ path: '.', name: 'solo' }])
  assert.deepEqual(json(made, made.main, 'standards', 'solo', '--json'), [{ repo: 'solo', root: made.main, checks: [], standards: [] }])
  assert.deepEqual(doctor.stdout.split('\n').filter(line => line.startsWith('FIX')), [])
  assert.equal(doctor.code, 0)
})

test('a plain map records no connection, so a pull request link is read through none until one is added', () => {
  const made = fresh()
  plain(made, made.main)

  const result = run(['connections', '--pr', 'https://github.com/acme/solo/pull/7'], { cwd: made.main, env: made.env })

  assert.deepEqual(result, { code: 1, stdout: '', stderr: 'context-central connections: no connection holds pull-requests\n' })
})

test('a second run of a plain map keeps everything and changes nothing', () => {
  const made = fresh()
  plain(made, made.main)
  const before = [read(made.main, EXCLUDE), read(made.main, 'CLAUDE.local.md'), read(made.main, `${MAP}/estate.json`)]

  const result = plain(made, made.main)

  assert.deepEqual(result, { code: 0, stdout: said(made.main, 'kept', INNER_FILES), stderr: '' })
  assert.deepEqual([read(made.main, EXCLUDE), read(made.main, 'CLAUDE.local.md'), read(made.main, `${MAP}/estate.json`)], before)
})

test('a CLAUDE.local.md that is there keeps its text and gains the marked block', () => {
  const made = fresh()
  writeFileSync(join(made.main, 'CLAUDE.local.md'), '# My own notes\n\nAlways run the tests.\n')

  const result = plain(made, made.main)

  assert.match(result.stdout, /^updated CLAUDE\.local\.md$/m)
  assert.equal(read(made.main, 'CLAUDE.local.md').startsWith(`# My own notes\n\nAlways run the tests.\n\n${BLOCK}\n`), true)
  assert.equal(shownByGit(made), '')
})

test('each of the two lines is added to the exclude file only where it is not there, and a checkout with no exclude file is given one', () => {
  const [half, none] = [fresh(), fresh()]
  writeFileSync(join(half.main, EXCLUDE), `${MAP}/\n`)
  rmSync(join(none.main, '.git', 'info'), { recursive: true })

  assert.equal(plain(half, half.main).stdout.split('\n')[1], `updated ${EXCLUDE}`)
  assert.equal(plain(none, none.main).stdout.split('\n')[1], `created ${EXCLUDE}`)
  assert.equal(read(half.main, EXCLUDE), `${MAP}/\n\nCLAUDE.local.md\n`)
  assert.equal(read(none.main, EXCLUDE), `${MAP}/\nCLAUDE.local.md\n`)
})

test('from a folder below the checkout, or with the checkout named, the plain map is made at the checkout', () => {
  const [below, named] = [fresh(), fresh()]

  const fromBelow = plain(below, join(below.main, 'src'))
  const byName = plain(named, named.base, 'solo')

  assert.equal(fromBelow.stdout.split('\n')[0], `plain map at ${below.main}:`)
  assert.equal(byName.stdout.split('\n')[0], `plain map at ${named.main}:`)
  for (const made of [below, named]) assert.equal(existsSync(join(made.main, MAP, 'estate.json')), true)
  assert.equal(existsSync(join(below.main, 'src', MAP)), false)
})

test('from a git work tree the plain map is made in the main checkout, the dry run says so, and where finds it from the work tree', () => {
  const made = fresh()
  const inside = workTree(made, join(made.base, 'solo-limit'))

  const dry = plain(made, inside, '--dry-run')
  const result = plain(made, inside)

  assert.equal(dry.stdout, [`plain map at ${made.main}:`, `would update ${EXCLUDE}`, ...INNER_FILES.map(file => `would create ${file}`), ''].join('\n'))
  assert.equal(result.stdout.split('\n')[0], `plain map at ${made.main}:`)
  assert.equal(existsSync(join(inside, MAP)), false)
  assert.equal((json(made, inside, 'where', '--json') as { mapDir: unknown }).mapDir, join(made.main, MAP))
  assert.equal(git(made, inside, 'status', '--porcelain', '--untracked-files=all').stdout, '')
})

test('in a folder that holds two checkouts a plain map is the root layout with both registered', () => {
  const made = checkout({ 'README.md': '# web\n' }, 'web')
  tree(made.base)
  mkdirSync(join(made.base, 'api'))
  git(made, join(made.base, 'api'), 'init', '-q', '-b', 'main')
  mkdirSync(join(made.base, 'notes'))

  const result = plain(made, made.base)

  assert.deepEqual(result, { code: 0, stdout: said(made.base, 'created', ['estate.json', ...NODE_DIRS.map(dir => `${dir}/`), 'CLAUDE.md', 'glossary.md']), stderr: '' })
  assert.deepEqual(JSON.parse(read(made.base, 'estate.json')) as unknown, { contextCentral: 1, name: made.base.split(/[\\/]/).at(-1), repos: ['api', 'web'], connections: {} })
  assert.deepEqual(json(made, made.base, 'config', '--get', 'repos'), [{ path: 'api', name: 'api' }, { path: 'web', name: 'web' }])
})

test('in a folder that holds no checkout a plain map registers no repo', () => {
  const root = tree(makeTree({ 'notes.md': '# Notes\n' }))

  const result = plain({ env: {} }, root)

  assert.equal(result.code, 0)
  assert.deepEqual(JSON.parse(read(root, 'estate.json')) as unknown, { contextCentral: 1, name: root.split(/[\\/]/).at(-1), repos: [], connections: {} })
})

test('a plain map is refused where another map already covers the folder, and nothing is written', () => {
  const root = tree(acme())
  const kept = fresh({ 'estate.json': { contextCentral: 1, name: 'solo' } })

  const below = plain({ env: {} }, join(root, 'web'))
  const inRepo = plain(kept, kept.main)

  assert.deepEqual(below, { code: 1, stdout: '', stderr: `context-central init: a map already covers this folder: ${join(root, 'estate.json')}\n` })
  assert.deepEqual(inRepo, { code: 1, stdout: '', stderr: `context-central init: a map already covers this folder: ${join(kept.main, 'estate.json')}\n` })
  assert.equal(existsSync(join(root, 'web', 'estate.json')), false)
  assert.equal(existsSync(join(kept.main, MAP)), false)
  assert.equal(read(kept.main, EXCLUDE), EXCLUDED)
})

test('a plain map is refused in a checkout whose git folder is elsewhere, since nothing there could be kept out of git', () => {
  const root = tree(makeTree({ 'held/.git': 'gitdir: ../elsewhere/git\n', 'held/README.md': '# Held\n' }))

  const result = plain({ env: {} }, join(root, 'held'))

  assert.deepEqual(result, { code: 1, stdout: '', stderr: `context-central init: ${join(root, 'held', '.git')} is a file that names no work tree, so a plain map there could not be kept out of git; set the map up with /context-central:onboard\n` })
  assert.deepEqual(readdirSync(join(root, 'held')).sort(), ['.git', 'README.md'])
})

test('a plain map is refused where git tracks CLAUDE.local.md, in a dry run as well, and nothing is written', () => {
  const made = fresh({ 'CLAUDE.local.md': '# Shared on purpose\n' })
  const refused = { code: 1, stdout: '', stderr: `context-central init: ${join(made.main, 'CLAUDE.local.md')} is tracked by git, so a plain map there could not be kept out of git; set the map up with /context-central:onboard\n` }

  assert.deepEqual(plain(made, made.main, '--dry-run'), refused)
  assert.deepEqual(plain(made, made.main), refused)
  assert.equal(existsSync(join(made.main, MAP)), false)
  assert.equal(read(made.main, EXCLUDE), EXCLUDED)
  assert.equal(shownByGit(made), '')
})

test('--hub names the hub of a plain map in a checkout, which is kept out of git beside the map, and git shows nothing new', () => {
  const made = fresh()

  const result = plain(made, made.main, '--hub', 'notes/MAP.md')

  assert.deepEqual(result, { code: 0, stdout: [`plain map at ${made.main}:`, `updated ${EXCLUDE}`, ...INNER_FILES.map(file => `created ${file === 'CLAUDE.local.md' ? 'notes/MAP.md' : file}`), ''].join('\n'), stderr: '' })
  assert.deepEqual(JSON.parse(read(made.main, `${MAP}/estate.json`)) as unknown, { ...SOLO, hub: 'notes/MAP.md' })
  assert.ok(read(made.main, 'notes/MAP.md').includes(BLOCK))
  assert.equal(read(made.main, EXCLUDE), `${EXCLUDED}\n${MAP}/\n/notes/MAP.md\n`)
  assert.equal(existsSync(join(made.main, 'CLAUDE.local.md')), false)
  assert.equal(shownByGit(made), '')
})

test('--hub names the hub of a plain map in a folder git does not hold, over the rule a file of Claude Code there would give, and a file there keeps its text and gains the marked block', () => {
  const root = tree(makeTree({ 'AGENTS.md': '# Ours\n', 'CLAUDE.md': '# Mine\n' }))

  const result = plain({ env: {} }, root, '--hub', 'AGENTS.md')

  assert.deepEqual(result, { code: 0, stdout: said(root, 'created', ['estate.json', ...NODE_DIRS.map(dir => `${dir}/`)]).replace(/\n$/, '\nupdated AGENTS.md\ncreated glossary.md\n'), stderr: '' })
  assert.equal((JSON.parse(read(root, 'estate.json')) as { hub: unknown }).hub, 'AGENTS.md')
  assert.ok(read(root, 'AGENTS.md').startsWith(`# Ours\n\n${BLOCK}`))
  assert.equal(read(root, 'CLAUDE.md'), '# Mine\n')
})

test('with no --hub, a folder git does not hold whose only instruction file is AGENTS.md takes it as the hub, and one that holds a file of Claude Code too is as before', () => {
  const alone = tree(makeTree({ 'AGENTS.md': '# Ours\n' }))
  const beside: TreeFiles[] = [{ 'CLAUDE.md': '# Mine\n' }, { 'CLAUDE.local.md': '# Mine\n' }, { '.claude/settings.json': {} }]

  assert.equal(plain({ env: {} }, alone).code, 0)
  assert.equal((JSON.parse(read(alone, 'estate.json')) as { hub?: unknown }).hub, 'AGENTS.md')
  assert.ok(read(alone, 'AGENTS.md').startsWith(`# Ours\n\n${BLOCK}`))
  assert.equal(existsSync(join(alone, 'CLAUDE.md')), false)
  for (const files of beside) {
    const root = tree(makeTree({ 'AGENTS.md': '# Ours\n', ...files }))

    assert.equal(plain({ env: {} }, root).code, 0, Object.keys(files)[0])
    assert.equal((JSON.parse(read(root, 'estate.json')) as { hub?: unknown }).hub, undefined, Object.keys(files)[0])
    assert.ok(read(root, 'CLAUDE.md').includes(BLOCK), Object.keys(files)[0])
    assert.equal(read(root, 'AGENTS.md'), '# Ours\n', Object.keys(files)[0])
  }
})

test("with no --hub, a checkout whose only instruction file is AGENTS.md keeps the hub inside the map's folder, touches AGENTS.md not at all, and git shows nothing new", () => {
  const made = fresh({ 'AGENTS.md': '# Shared\n' })

  const result = plain(made, made.main)

  assert.deepEqual(result, { code: 0, stdout: [`plain map at ${made.main}:`, `updated ${EXCLUDE}`, ...INNER_FILES.map(file => `created ${file === 'CLAUDE.local.md' ? `${MAP}/hub.md` : file}`), ''].join('\n'), stderr: '' })
  assert.deepEqual(JSON.parse(read(made.main, `${MAP}/estate.json`)) as unknown, { ...SOLO, hub: `${MAP}/hub.md` })
  assert.ok(read(made.main, `${MAP}/hub.md`).includes(BLOCK))
  assert.equal(read(made.main, EXCLUDE), `${EXCLUDED}\n${MAP}/\n`)
  assert.equal(read(made.main, 'AGENTS.md'), '# Shared\n')
  assert.equal(existsSync(join(made.main, 'CLAUDE.local.md')), false)
  assert.equal(shownByGit(made), '')
})

test('with no --hub, a checkout that holds a file of Claude Code beside AGENTS.md has its hub in CLAUDE.local.md, as before', () => {
  const beside: TreeFiles[] = [{ 'CLAUDE.md': '# Mine\n' }, { '.claude/settings.json': '{}\n' }]

  for (const files of beside) {
    const made = fresh({ 'AGENTS.md': '# Shared\n', ...files })

    assert.equal(plain(made, made.main).code, 0, Object.keys(files)[0])
    assert.equal((JSON.parse(read(made.main, `${MAP}/estate.json`)) as { hub: unknown }).hub, 'CLAUDE.local.md', Object.keys(files)[0])
    assert.equal(existsSync(join(made.main, MAP, 'hub.md')), false, Object.keys(files)[0])
    assert.equal(shownByGit(made), '', Object.keys(files)[0])
  }
})

test('a hub that git tracks is refused by name, in a dry run as well, and nothing is written', () => {
  const made = fresh({ 'notes/MAP.md': '# Shared on purpose\n' })
  const refused = { code: 1, stdout: '', stderr: `context-central init: ${join(made.main, 'notes', 'MAP.md')} is tracked by git, so a plain map there could not be kept out of git; set the map up with /context-central:onboard\n` }

  assert.deepEqual(plain(made, made.main, '--hub', 'notes/MAP.md', '--dry-run'), refused)
  assert.deepEqual(plain(made, made.main, '--hub', 'notes/MAP.md'), refused)
  assert.equal(existsSync(join(made.main, MAP)), false)
  assert.equal(read(made.main, EXCLUDE), EXCLUDED)
  assert.equal(shownByGit(made), '')
})

test('in a folder git does not hold, a hub that a checkout below it tracks is refused by name, and nothing is written', () => {
  const made = checkout({ 'AGENTS.md': '# web\n' }, 'web')
  tree(made.base)

  const result = plain(made, made.base, '--hub', 'web/AGENTS.md')

  assert.deepEqual(result, { code: 1, stdout: '', stderr: `context-central init: ${join(made.base, 'web', 'AGENTS.md')} is tracked by git, so a plain map there could not be kept out of git; set the map up with /context-central:onboard\n` })
  assert.equal(existsSync(join(made.base, 'estate.json')), false)
  assert.equal(read(made.main, 'AGENTS.md'), '# web\n')
})

test('--hub with no --plain, and a hub that is absolute or leads out of the folder, are wrong usage, and nothing is written', () => {
  const root = tree(makeTree({ 'answers.json': { layout: 'root', config: { name: 'acme' } } }))

  const alone = run(['init', '--from', 'answers.json', '--hub', 'MAP.md'], { cwd: root })

  assert.deepEqual(alone, { code: 2, stdout: '', stderr: 'context-central init: --hub names the hub of a plain map, so it goes with --plain\n' })
  for (const odd of ['/tmp/MAP.md', 'C:/MAP.md', '../MAP.md', 'notes/../../MAP.md', 'notes\\MAP.md', '', '.', 'notes/', './MAP.md', 'notes//MAP.md', 'notes/./MAP.md']) {
    assert.deepEqual(plain({ env: {} }, root, '--hub', odd), wrongName(odd), odd)
    assert.deepEqual(plain({ env: {} }, root, '--hub', odd, '--dry-run'), wrongName(odd), odd)
  }
  assert.deepEqual(readdirSync(root), ['answers.json'])
})

test("a hub in a folder named .git, git's own, is wrong usage in either layout, whatever the case of its letters, and nothing is written", () => {
  const made = fresh()
  const above = checkout({ 'README.md': '# web\n' }, 'web')
  tree(above.base)

  for (const odd of ['.git/config', '.git/HEAD', '.git/info/exclude', '.GIT/config', 'notes/.git/x.md']) {
    assert.deepEqual(plain(made, made.main, '--hub', odd), { code: 2, stdout: '', stderr: `context-central init: --hub "${odd}": a hub cannot lie in a folder named .git, which is git's own\n` }, odd)
  }
  assert.deepEqual(plain(above, above.base, '--hub', 'web/.git/config'), { code: 2, stdout: '', stderr: `context-central init: --hub "web/.git/config": a hub cannot lie in a folder named .git, which is git's own\n` })
  assert.equal(existsSync(join(made.main, MAP)), false)
  assert.equal(read(made.main, EXCLUDE), EXCLUDED)
  assert.equal(git(made, made.main, 'status', '--short').stderr, '')
  assert.equal(existsSync(join(above.base, 'estate.json')), false)
})

test('a hub that names a file or a folder init lays down for the map itself is refused, whatever the case of its letters, and nothing is written', () => {
  const made = fresh()
  const root = tree(makeTree({ 'notes.md': '# Notes\n' }))

  for (const own of [`${MAP}/estate.json`, `${MAP}/glossary.md`, `${MAP}/repos`, MAP, `${MAP}/Docs`]) {
    const result = plain(made, made.main, '--hub', own)

    assert.deepEqual(result, laidDown(own), own)
  }
  for (const own of ['estate.json', 'glossary.md', 'docs', 'ESTATE.JSON']) {
    assert.deepEqual(plain({ env: {} }, root, '--hub', own, '--dry-run'), laidDown(own), own)
  }
  assert.equal(existsSync(join(made.main, MAP)), false)
  assert.equal(read(made.main, EXCLUDE), EXCLUDED)
  assert.deepEqual(readdirSync(root), ['notes.md'])
})

test('a hub that is a folder, or a link that leads nowhere, is refused before anything is written, in a dry run as well', LINKS, () => {
  const made = fresh()
  mkdirSync(join(made.main, 'drafts'))
  symlinkSync(join('nowhere', 'x.md'), join(made.main, 'GONE.md'))

  for (const dryRun of [[], ['--dry-run']]) {
    assert.deepEqual(plain(made, made.main, '--hub', 'drafts', ...dryRun), refusedAs(`${join(made.main, 'drafts')} is a folder, so the hub cannot be written there`))
    assert.deepEqual(plain(made, made.main, '--hub', 'GONE.md', ...dryRun), refusedAs(`${join(made.main, 'GONE.md')} is a link that leads nowhere, so the hub cannot be written there`))
  }
  assert.equal(existsSync(join(made.main, MAP)), false)
  assert.equal(read(made.main, EXCLUDE), EXCLUDED)
})

test("with no --hub, a folder named AGENTS.md is no instruction file, so the hub is CLAUDE.md as before, and a checkout whose hub in the map's folder would be a folder is refused before anything is written", () => {
  const root = tree(makeTree({ 'AGENTS.md/x.md': '# x\n' }))
  const made = fresh({ 'AGENTS.md': '# Shared\n' })
  mkdirSync(join(made.main, MAP, 'hub.md'), { recursive: true })

  assert.equal(plain({ env: {} }, root, '--dry-run').stdout.split('\n').at(-3), 'would create CLAUDE.md')
  assert.equal(plain({ env: {} }, root).code, 0)
  assert.ok(read(root, 'CLAUDE.md').includes(BLOCK))
  assert.deepEqual(plain(made, made.main, '--dry-run'), refusedAs(`${join(made.main, MAP, 'hub.md')} is a folder, so the hub cannot be written there`))
  assert.deepEqual(plain(made, made.main), refusedAs(`${join(made.main, MAP, 'hub.md')} is a folder, so the hub cannot be written there`))
  assert.deepEqual(readdirSync(join(made.main, MAP)), ['hub.md'])
})

test('a hub that git tracks under another letter case is refused where the write would land, and the tracked file is left as it was', BLIND_TO_CASE, () => {
  const made = fresh()

  assert.deepEqual(plain(made, made.main, '--hub', 'readme.md'), trackedAs(join(made.main, 'readme.md'), join(made.main, 'README.md')))
  assert.equal(read(made.main, 'README.md'), '# Solo\n')
  assert.equal(shownByGit(made), '')
})

test('a hub that is a link is asked of git where the link leads, and one that leads to a file git tracks, or into another checkout, is refused with nothing written', LINKS, () => {
  const made = fresh()
  const away = checkout({ 'theirs.md': '# Theirs\n' }, 'away')
  tree(away.base)
  writeFileSync(join(away.main, 'new.md'), '# Not yet theirs\n')
  symlinkSync('README.md', join(made.main, 'LINK.md'))
  symlinkSync(join(away.main, 'theirs.md'), join(made.main, 'AWAY.md'))
  symlinkSync(join(away.main, 'new.md'), join(made.main, 'NEW.md'))

  assert.deepEqual(plain(made, made.main, '--hub', 'LINK.md'), trackedAs(join(made.main, 'LINK.md'), join(made.main, 'README.md')))
  assert.deepEqual(plain(made, made.main, '--hub', 'AWAY.md'), trackedAs(join(made.main, 'AWAY.md'), join(away.main, 'theirs.md')))
  assert.deepEqual(plain(made, made.main, '--hub', 'NEW.md'), refusedAs(`${join(made.main, 'NEW.md')} lies in the checkout ${away.main}, where git would show it, so a plain map there could not be kept out of git; ${ONBOARD}`))
  assert.equal(read(made.main, 'README.md'), '# Solo\n')
  assert.equal(read(away.main, 'theirs.md'), '# Theirs\n')
  assert.equal(read(away.main, 'new.md'), '# Not yet theirs\n')
  assert.equal(existsSync(join(made.main, MAP)), false)
})

test('with no --hub, an AGENTS.md that is a link to a file a checkout below tracks is refused, and the tracked file is left as it was', LINKS, () => {
  const made = checkout({ 'AGENTS.md': '# web\n' }, 'web')
  tree(made.base)
  symlinkSync(join('web', 'AGENTS.md'), join(made.base, 'AGENTS.md'))

  assert.deepEqual(plain(made, made.base), trackedAs(join(made.base, 'AGENTS.md'), join(made.base, 'web', 'AGENTS.md')))
  assert.equal(read(made.main, 'AGENTS.md'), '# web\n')
  assert.equal(existsSync(join(made.base, 'estate.json')), false)
})

test('a hub that git tracks is refused though its folder is gone from the disk, and git is left with only the removal it had', () => {
  const made = fresh({ 'notes/MAP.md': '# Shared on purpose\n' })
  rmSync(join(made.main, 'notes'), { recursive: true })

  assert.deepEqual(plain(made, made.main, '--hub', 'notes/MAP.md'), tracked(join(made.main, 'notes', 'MAP.md')))
  assert.equal(git(made, made.main, 'status', '--short').stdout, ' D notes/MAP.md\n')
})

test('a hub under a file is refused before anything is written', () => {
  const made = fresh()

  assert.deepEqual(plain(made, made.main, '--hub', 'README.md/MAP.md'), refusedAs(`${join(made.main, 'README.md', 'MAP.md')} lies under a file, so the hub cannot be written there`))
  assert.equal(existsSync(join(made.main, MAP)), false)
})

test('a hub that git tracks under another letter case is refused though its folder is gone from the disk', BLIND_TO_CASE, () => {
  const made = fresh({ 'notes/MAP.md': '# Shared on purpose\n' })
  rmSync(join(made.main, 'notes'), { recursive: true })

  assert.deepEqual(plain(made, made.main, '--hub', 'NOTES/map.md'), tracked(join(made.main, 'NOTES', 'map.md')))
  assert.equal(existsSync(join(made.main, MAP)), false)
})

test('in a checkout, a hub that would lie in another checkout inside it is refused, since that git would show it', () => {
  const made = fresh()
  mkdirSync(join(made.main, 'vendor', 'kit'), { recursive: true })
  git(made, join(made.main, 'vendor', 'kit'), 'init', '-q', '-b', 'main')

  assert.deepEqual(plain(made, made.main, '--hub', 'vendor/kit/MAP.md'), refusedAs(`${join(made.main, 'vendor', 'kit', 'MAP.md')} lies in the checkout ${join(made.main, 'vendor', 'kit')}, where git would show it, so a plain map there could not be kept out of git; ${ONBOARD}`))
  assert.equal(existsSync(join(made.main, MAP)), false)
})

test('in a folder git does not hold, a hub that would lie in a checkout below it is refused though git does not track it, since git there would show it', () => {
  const made = checkout({ 'README.md': '# web\n' }, 'web')
  tree(made.base)

  assert.deepEqual(plain(made, made.base, '--hub', 'web/MAP.md'), refusedAs(`${join(made.base, 'web', 'MAP.md')} lies in the checkout ${made.main}, where git would show it, so a plain map there could not be kept out of git; ${ONBOARD}`))
  assert.equal(git(made, made.main, 'status', '--short').stdout, '')
})

test('the line the exclude file gains for a hub names that one file at the root of the checkout and no other, so git shows nothing and hides nothing else', () => {
  for (const hub of ['[hub].md', '!hub.md', '#hub.md', 'h[u]b.md', 'MAP.md']) {
    const made = fresh()
    writeFileSync(join(made.main, 'hub.md.txt'), 'x\n')
    mkdirSync(join(made.main, 'sub'))
    writeFileSync(join(made.main, 'sub', hub), 'x\n')
    writeFileSync(join(made.main, 'hub.md'), 'x\n')

    assert.equal(plain(made, made.main, '--hub', hub).code, 0, hub)
    assert.deepEqual(shownByGit(made).split('\n').filter(Boolean).sort(), ['hub.md', 'hub.md.txt', `sub/${hub}`].map(name => `?? ${name}`).sort(), hub)
  }
})

test('a hub whose name a disk of Windows cannot hold, by a sign, a part that ends in a space or a dot, the name of a device or a part over 255 bytes, is wrong usage on every system, and nothing is written', () => {
  const made = fresh()

  for (const odd of ['h*b.md', 'h?b.md', 'a<b.md', 'a>b.md', 'notes/a:b.md', 'a"b.md', 'a|b.md', 'hub.md ', 'hub.md.', 'notes /MAP.md', 'notes./MAP.md', 'a\tb.md', 'NUL', 'con.md', 'aux/hub.md', 'notes/Com1.txt', 'lpt9', `${'x'.repeat(253)}.md`]) {
    assert.deepEqual(plain(made, made.main, '--hub', odd), { code: 2, stdout: '', stderr: `context-central init: --hub "${odd}": ${ANY_DISK}\n` }, odd)
  }
  assert.deepEqual(plain(made, made.main, '--hub', 'a\nb.md'), { code: 2, stdout: '', stderr: `context-central init: --hub "a b.md": ${ANY_DISK}\n` })
  assert.equal(existsSync(join(made.main, MAP)), false)
  assert.equal(read(made.main, EXCLUDE), EXCLUDED)
})

test('a refusal names the place the write would land under the spelling of the folder it was given, though that folder is reached through a link', LINKS, () => {
  const made = fresh()
  mkdirSync(join(made.main, 'vendor', 'kit'), { recursive: true })
  git(made, join(made.main, 'vendor', 'kit'), 'init', '-q', '-b', 'main')
  symlinkSync(made.main, join(made.base, 'via'), 'dir')

  assert.deepEqual(plain(made, made.base, 'via', '--hub', 'vendor/kit/MAP.md'), refusedAs(`${join(made.base, 'via', 'vendor', 'kit', 'MAP.md')} lies in the checkout ${join(made.base, 'via', 'vendor', 'kit')}, where git would show it, so a plain map there could not be kept out of git; ${ONBOARD}`))
})

test('a second plain map with another --hub is refused, naming the hub the map has, and the same --hub is kept as it is', () => {
  const made = fresh()
  plain(made, made.main, '--hub', 'MAP.md')

  assert.deepEqual(plain(made, made.main, '--hub', 'OTHER.md'), refusedAs(`this folder's map has its hub at MAP.md already, and init --plain does not move it: --hub "OTHER.md" names another`))
  assert.equal(plain(made, made.main, '--hub', 'MAP.md').code, 0)
  assert.equal(existsSync(join(made.main, 'OTHER.md')), false)
  assert.equal((JSON.parse(read(made.main, `${MAP}/estate.json`)) as { hub: unknown }).hub, 'MAP.md')
})

test('a hub git tracks is refused where core.ignorecase is not set, by the name it was given, and the tracked file is left as it was', () => {
  const made = fresh()
  caseUnset(made)
  renamed(made.main, 'README.md', 'readme.md')

  const result = plain(made, made.main, '--hub', 'README.md')

  assert.deepEqual(result, ONE_NAME_UNDER_BOTH_CASES ? trackedAs(join(made.main, 'README.md'), join(made.main, 'readme.md')) : tracked(join(made.main, 'README.md')))
  assert.equal(read(made.main, 'readme.md'), '# Solo\n')
  assert.equal(existsSync(join(made.main, MAP)), false)
})

test('on a disk that takes a name under both cases as one, a hub git tracks under another case is refused where core.ignorecase is not set, there or with its folder gone', BLIND_TO_CASE, () => {
  const made = fresh({ 'CLAUDE.local.md': '# Shared on purpose\n', 'notes/MAP.md': '# Shared on purpose\n' })
  caseUnset(made)
  renamed(made.main, 'CLAUDE.local.md', 'claude.local.md')
  rmSync(join(made.main, 'notes'), { recursive: true })

  assert.deepEqual(plain(made, made.main), trackedAs(join(made.main, 'CLAUDE.local.md'), join(made.main, 'claude.local.md')))
  assert.deepEqual(plain(made, made.main, '--hub', 'NOTES/map.md'), tracked(join(made.main, 'NOTES', 'map.md')))
  assert.equal(read(made.main, 'claude.local.md'), '# Shared on purpose\n')
  assert.equal(existsSync(join(made.main, MAP)), false)
})

test('on a disk that tells the cases apart, a hub under another case than a file git tracks is another file, and is written and kept out of git', TELLS_CASES_APART, () => {
  const made = fresh({ 'notes/MAP.md': '# Shared on purpose\n' })

  const result = plain(made, made.main, '--hub', 'NOTES/map.md')

  assert.equal(result.code, 0, result.stderr)
  assert.equal(read(made.main, 'notes/MAP.md'), '# Shared on purpose\n')
  assert.equal(shownByGit(made), '')
})

test('a hub git tracks is refused though GIT_LITERAL_PATHSPECS is set, and nothing is written', () => {
  const made = fresh({ 'CLAUDE.local.md': '# Shared on purpose\n' })

  for (const setting of ['GIT_LITERAL_PATHSPECS', 'GIT_GLOB_PATHSPECS', 'GIT_NOGLOB_PATHSPECS', 'GIT_ICASE_PATHSPECS']) {
    assert.deepEqual(plain({ env: { ...made.env, [setting]: '1' } }, made.main), tracked(join(made.main, 'CLAUDE.local.md')), setting)
  }
  assert.equal(existsSync(join(made.main, MAP)), false)
})

test('a hub that is a link git tracks is refused by its name, though the file it leads to is not tracked, in the checkout or out of it', LINKS, () => {
  const made = fresh()
  const shared = tree(makeTree({ 'one.md': '# Mine\n' }))
  writeFileSync(join(made.main, 'draft.md'), '# Draft\n')
  symlinkSync('draft.md', join(made.main, 'LINK.md'))
  symlinkSync(join(shared, 'one.md'), join(made.main, 'OUT.md'))
  git(made, made.main, 'add', 'LINK.md', 'OUT.md')
  git(made, made.main, 'commit', '-q', '-m', 'links')

  assert.deepEqual(plain(made, made.main, '--hub', 'LINK.md'), tracked(join(made.main, 'LINK.md')))
  assert.deepEqual(plain(made, made.main, '--hub', 'OUT.md'), tracked(join(made.main, 'OUT.md')))
  assert.equal(read(made.main, 'draft.md'), '# Draft\n')
  assert.equal(read(shared, 'one.md'), '# Mine\n')
  assert.equal(existsSync(join(made.main, MAP)), false)
})

test('a hub reached through a link git tracks is kept out of git by the line of the place it lands, and git shows nothing new', LINKS, () => {
  const made = fresh({ 'docs/a.md': '# Docs\n' })
  symlinkSync('docs', join(made.main, 'd'), 'dir')
  git(made, made.main, 'add', 'd')
  git(made, made.main, 'commit', '-q', '-m', 'a link')

  assert.equal(plain(made, made.main, '--hub', 'd/NEW.md').code, 0)
  assert.equal(read(made.main, EXCLUDE), `${EXCLUDED}\n${MAP}/\n/docs/NEW.md\n`)
  assert.ok(read(made.main, 'docs/NEW.md').includes(BLOCK))
  assert.equal(shownByGit(made), '')
})

test('on a disk that takes a name under both cases as one, a hub given under another case than its folder is kept out of git by the folder as the disk spells it', BLIND_TO_CASE, () => {
  const made = fresh({ 'docs/a.md': '# Docs\n' })
  caseUnset(made)

  assert.equal(plain(made, made.main, '--hub', 'DOCS/new.md').code, 0)
  assert.equal(read(made.main, EXCLUDE), `${EXCLUDED}\n${MAP}/\n/docs/new.md\n`)
  assert.equal(shownByGit(made), '')
})

test("a hub given under another case than the map's folder gains no line where the disk takes the two as one, and a line of its own where it tells them apart, and git shows nothing new", () => {
  const made = fresh()
  caseUnset(made)

  assert.equal(plain(made, made.main, '--hub', '.Context-Central/hub.md').code, 0)
  assert.equal(read(made.main, EXCLUDE), `${EXCLUDED}\n${MAP}/\n${ONE_NAME_UNDER_BOTH_CASES ? '' : '/.Context-Central/hub.md\n'}`)
  assert.equal(shownByGit(made), '')
})

test('a hub under a file init lays down for the map, or at or under the lock it takes, is refused before anything is written, in a dry run as well', () => {
  const made = fresh()
  const root = tree(makeTree({ 'notes.md': '# Notes\n' }))
  const inner: [hub: string, own: string | null][] = [
    [`${MAP}/estate.json/hub.md`, `${MAP}/estate.json`],
    [`${MAP}/ESTATE.json/hub.md`, `${MAP}/estate.json`],
    [`${MAP}/glossary.md/hub.md`, `${MAP}/glossary.md`],
    [`${MAP}/${LOCK}`, null],
    [`${MAP}/${LOCK}/hub.md`, `${MAP}/${LOCK}`],
  ]
  const folder: [hub: string, own: string | null][] = [['estate.json/hub.md', 'estate.json'], ['glossary.md/x/hub.md', 'glossary.md'], [LOCK, null], [`${LOCK}/hub.md`, LOCK]]

  for (const dryRun of [[], ['--dry-run']]) {
    for (const [hub, own] of inner) assert.deepEqual(plain(made, made.main, '--hub', hub, ...dryRun), own ? laidUnder(hub, own) : laidDown(hub), hub)
    for (const [hub, own] of folder) assert.deepEqual(plain({ env: {} }, root, '--hub', hub, ...dryRun), own ? laidUnder(hub, own) : laidDown(hub), hub)
  }
  assert.equal(existsSync(join(made.main, MAP)), false)
  assert.equal(read(made.main, EXCLUDE), EXCLUDED)
  assert.deepEqual(readdirSync(root), ['notes.md'])
})

test('a hub that is there and is no plain file, such as a named pipe, is refused before anything is written, in a dry run as well', notOnWindows('Windows has no named pipe in a folder'), () => {
  const made = fresh()
  spawned('mkfifo', [join(made.main, 'PIPE.md')])

  for (const dryRun of [[], ['--dry-run']]) {
    const result = run(['init', '--plain', '--hub', 'PIPE.md', ...dryRun], { cwd: made.main, env: made.env, timeout: 10000 })

    assert.deepEqual(result, refusedAs(`${join(made.main, 'PIPE.md')} is no plain file, so the hub cannot be written there`))
  }
  assert.equal(existsSync(join(made.main, MAP)), false)
})

test('a hub longer than this system lets a path be is refused before anything is written', notOnWindows('Windows lets a path be longer than the hub this test names'), () => {
  const root = tree(makeTree({}))
  const hub = Array.from({ length: 20 }, (_, at) => `${at}${'x'.repeat(240)}`).join('/')

  assert.deepEqual(plain({ env: {} }, root, '--hub', hub), refusedAs(`${join(root, hub)} is longer than this system lets a path be, so the hub cannot be written there`))
  assert.deepEqual(readdirSync(root), [])
})

test('a hub in a repository that has no work tree is refused, as is a plain map made inside one, in a dry run as well, and git can still read the repository', () => {
  const root = tree(makeTree({}))
  const env = { GIT_CONFIG_GLOBAL: join(root, 'gitconfig'), GIT_CONFIG_NOSYSTEM: '1' }
  writeFileSync(join(root, 'gitconfig'), '')
  git({ env }, root, 'init', '-q', '--bare', 'store.git')
  const config = read(root, 'store.git/config')

  for (const dryRun of [[], ['--dry-run']]) {
    assert.deepEqual(plain({ env }, root, '--hub', 'store.git/config', ...dryRun), gitsOwn(join(root, 'store.git', 'config'), 'the hub cannot be written there'))
    assert.deepEqual(plain({ env }, root, '--hub', 'store.git/refs/hub.md', ...dryRun), gitsOwn(join(root, 'store.git', 'refs', 'hub.md'), 'the hub cannot be written there'))
    assert.deepEqual(plain({ env }, join(root, 'store.git'), ...dryRun), gitsOwn(join(root, 'store.git'), 'a plain map cannot be made there'))
  }
  assert.equal(read(root, 'store.git/config'), config)
  assert.deepEqual(readdirSync(root).sort(), ['gitconfig', 'store.git'])
  assert.equal(git({ env }, join(root, 'store.git'), 'rev-parse', '--is-bare-repository').stdout, 'true\n')
})

test('a hub that is a link out of the folder to a file no checkout holds is written through the link, and in a checkout the link is kept out of git', LINKS, () => {
  const made = fresh()
  const shared = tree(makeTree({ 'one.md': '# Mine\n', 'two.md': '# Mine too\n' }))
  const root = tree(makeTree({}))
  symlinkSync(join(shared, 'one.md'), join(made.main, 'CLAUDE.local.md'))
  symlinkSync(join(shared, 'two.md'), join(root, 'CLAUDE.md'))

  assert.equal(plain(made, made.main).code, 0)
  assert.equal(plain({ env: {} }, root).code, 0)
  assert.ok(read(shared, 'one.md').startsWith('# Mine\n') && read(shared, 'one.md').includes(BLOCK))
  assert.ok(read(shared, 'two.md').startsWith('# Mine too\n') && read(shared, 'two.md').includes(BLOCK))
  assert.equal(read(made.main, EXCLUDE), `${EXCLUDED}\n${MAP}/\nCLAUDE.local.md\n`)
  assert.equal(shownByGit(made), '')
})

test('on a disk that takes a name under both cases as one, a hub that is a link out of the folder is kept out of git by the link as the disk spells it, though given under another case', { ...BLIND_TO_CASE, ...LINKS }, () => {
  const made = fresh()
  const shared = tree(makeTree({ 'one.md': '# Mine\n', 'kit/two.md': '# Mine too\n' }))
  caseUnset(made)
  symlinkSync(join(shared, 'one.md'), join(made.main, 'CLAUDE.local.md'))
  symlinkSync(join(shared, 'kit'), join(made.main, 'Kit'), 'dir')

  assert.equal(plain(made, made.main, '--hub', 'claude.local.md').code, 0)
  assert.equal(read(made.main, EXCLUDE), `${EXCLUDED}\n${MAP}/\nCLAUDE.local.md\n`)
  assert.equal(shownByGit(made), '?? Kit\n')
})

test('a hub that is a link into a folder out of the checkout is kept out of git by that link', LINKS, () => {
  const made = fresh()
  const shared = tree(makeTree({ 'kit/two.md': '# Mine too\n' }))
  symlinkSync(join(shared, 'kit'), join(made.main, 'kit'), 'dir')

  assert.equal(plain(made, made.main, '--hub', 'kit/two.md').code, 0)
  assert.equal(read(made.main, EXCLUDE), `${EXCLUDED}\n${MAP}/\n/kit\n`)
  assert.equal(shownByGit(made), '')
})

test('a hub that is a link to a file whose name holds a sign of a pattern is kept out of git by that one name, and git hides nothing else', notOnWindows('a disk of Windows cannot hold these names'), () => {
  for (const name of ['h*b.md', 'h?b.md', 'h\\b.md', 'hub.md ']) {
    const made = fresh()
    writeFileSync(join(made.main, name), '# Mine\n')
    writeFileSync(join(made.main, 'hab.md'), '# Not the hub\n')
    symlinkSync(name, join(made.main, 'LINK.md'))

    assert.equal(plain(made, made.main, '--hub', 'LINK.md').code, 0, name)
    assert.equal(shownByGit(made), '?? LINK.md\n?? hab.md\n', name)
  }
})

test('a hub that is a link to a file whose name holds a line break is refused, since no line of the exclude file can name it', notOnWindows('a disk of Windows cannot hold this name'), () => {
  const made = fresh()
  writeFileSync(join(made.main, 'a\nb.md'), '# Mine\n')
  symlinkSync('a\nb.md', join(made.main, 'LINK.md'))

  assert.deepEqual(plain(made, made.main, '--hub', 'LINK.md'), refusedAs(`${join(made.main, 'LINK.md')} would be written as ${join(made.main, 'a b.md')}, a name no line of git's exclude file can hold, so a plain map there could not be kept out of git; ${ONBOARD}`))
  assert.equal(existsSync(join(made.main, MAP)), false)
})

test('a second run on a map whose hub is a link out of the folder keeps everything, in a dry run as well', LINKS, () => {
  const made = fresh()
  const shared = tree(makeTree({ 'one.md': '# Mine\n' }))
  symlinkSync(join(shared, 'one.md'), join(made.main, 'CLAUDE.local.md'))
  plain(made, made.main)

  assert.deepEqual(plain(made, made.main, '--dry-run'), { code: 0, stdout: said(made.main, 'kept', INNER_FILES), stderr: '' })
  assert.deepEqual(plain(made, made.main), { code: 0, stdout: said(made.main, 'kept', INNER_FILES), stderr: '' })
})

test('a second run on a plain map whose hub was committed since keeps everything, as a map that is there is not asked of git again', () => {
  const made = fresh()
  plain(made, made.main)
  git(made, made.main, 'add', '-f', 'CLAUDE.local.md')
  git(made, made.main, 'commit', '-q', '-m', 'the hub')

  assert.deepEqual(plain(made, made.main), { code: 0, stdout: said(made.main, 'kept', INNER_FILES), stderr: '' })
})

const NO_ANSWER_FROM_GIT: [when: string, standIn: string | null][] = [
  ['with no git on the PATH', null],
  ['where git refuses to answer', '#!/bin/sh\necho "fatal: detected dubious ownership" >&2\nexit 128\n'],
  ['where git gives no answer in five seconds', '#!/bin/sh\nexec /bin/sleep 7\n'],
]

for (const [when, standIn] of NO_ANSWER_FROM_GIT) {
  test(`${when} a plain map cannot learn what git tracks, and goes on as it does for a file of the person's own`, standIn ? NEEDS_STAND_IN : {}, () => {
    const made = fresh({ 'CLAUDE.local.md': '# Shared on purpose\n' })
    const path = tree(standIn ? standIns({ git: standIn }) : makeTree({}))

    const result = plain({ env: { ...made.env, PATH: path } }, made.main)

    assert.equal(result.code, 0)
    assert.match(result.stdout, /^updated CLAUDE\.local\.md$/m)
  })
}

test('--plain takes no answers file, and init with neither is still wrong usage', () => {
  const root = tree(makeTree({ 'answers.json': { layout: 'root', config: { name: 'acme' } } }))

  assert.equal(run(['init', '--plain', '--from', 'answers.json'], { cwd: root }).code, 2)
  assert.equal(run(['init'], { cwd: root }).code, 2)
  assert.deepEqual(readdirSync(root), ['answers.json'])
})

test('a map that is already in the checkout and was not made plain is kept as it is, and the exclude file is left alone', () => {
  const made = fresh()
  writeFileSync(join(made.main, 'answers.json'), JSON.stringify({ layout: 'inner', config: { name: 'solo' } }))
  run(['init', '--from', 'answers.json'], { cwd: made.main, env: made.env })

  const result = plain(made, made.main)

  assert.deepEqual(result, { code: 0, stdout: said(made.main, 'kept', [`${MAP}/estate.json`, ...NODE_DIRS.map(dir => `${MAP}/${dir}/`), 'CLAUDE.md', `${MAP}/glossary.md`]), stderr: '' })
  assert.equal(read(made.main, EXCLUDE), EXCLUDED)
})
