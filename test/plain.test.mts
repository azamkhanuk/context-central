import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { NEEDS_STAND_IN, acme, checkout, disposable, git, leftByAWrite, makeTree, notOnWindows, run, standIns, workTree } from './helpers.mts'
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
const ONBOARD = 'set the map up with /context-central:onboard'
const refusedAs = (line: string) => ({ code: 1, stdout: '', stderr: `context-central init: ${line}\n` })
const tracked = (path: string) => refusedAs(`${path} is tracked by git, so a plain map there could not be kept out of git; ${ONBOARD}`)
const trackedAs = (path: string, landing: string) => refusedAs(`${path} would be written as ${landing}, which git tracks, so a plain map there could not be kept out of git; ${ONBOARD}`)
const laidDown = (hub: string) => refusedAs(`"${hub}" names a file or a folder that init lays down for the map itself, so it cannot be the hub`)
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

test('a hub that is a link is asked of git where the link leads, and one that leads to a file git tracks, or out of the folder, is refused with nothing written', LINKS, () => {
  const made = fresh()
  const away = tree(makeTree({ 'theirs.md': '# Theirs\n' }))
  symlinkSync('README.md', join(made.main, 'LINK.md'))
  symlinkSync(join(away, 'theirs.md'), join(made.main, 'AWAY.md'))

  assert.deepEqual(plain(made, made.main, '--hub', 'LINK.md'), trackedAs(join(made.main, 'LINK.md'), join(made.main, 'README.md')))
  assert.deepEqual(plain(made, made.main, '--hub', 'AWAY.md'), refusedAs(`${join(made.main, 'AWAY.md')} leads to ${join(away, 'theirs.md')}, outside ${made.main}, so the hub cannot be written there`))
  assert.equal(read(made.main, 'README.md'), '# Solo\n')
  assert.equal(read(away, 'theirs.md'), '# Theirs\n')
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
  for (const hub of ['[hub].md', '!hub.md', '#hub.md', 'hub.md ', 'h*b.md', 'h?b.md', 'MAP.md']) {
    const made = fresh()
    writeFileSync(join(made.main, 'hub.md.txt'), 'x\n')
    mkdirSync(join(made.main, 'sub'))
    writeFileSync(join(made.main, 'sub', hub), 'x\n')
    writeFileSync(join(made.main, 'hub.md'), 'x\n')

    assert.equal(plain(made, made.main, '--hub', hub).code, 0, hub)
    assert.deepEqual(shownByGit(made).split('\n').filter(Boolean).sort(), ['hub.md', 'hub.md.txt', `sub/${hub}`].map(name => `?? ${name.endsWith(' ') ? `"${name}"` : name}`).sort(), hub)
  }
})

test('a second plain map with another --hub is refused, naming the hub the map has, and the same --hub is kept as it is', () => {
  const made = fresh()
  plain(made, made.main, '--hub', 'MAP.md')

  assert.deepEqual(plain(made, made.main, '--hub', 'OTHER.md'), refusedAs(`this folder's map has its hub at MAP.md already, and init --plain does not move it: --hub "OTHER.md" names another`))
  assert.equal(plain(made, made.main, '--hub', 'MAP.md').code, 0)
  assert.equal(existsSync(join(made.main, 'OTHER.md')), false)
  assert.equal((JSON.parse(read(made.main, `${MAP}/estate.json`)) as { hub: unknown }).hub, 'MAP.md')
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
