import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { acme, checkout, disposable, git, leftByAWrite, makeTree, run, workTree } from './helpers.mts'
import type { Checkout, TreeFiles } from './helpers.mts'

const tree = disposable()

const MAP = '.context-central'
const NODE_DIRS = ['repos', 'areas', 'concepts', 'edges', 'decisions', 'docs', 'standards', 'log', 'work']
const EXCLUDE = '.git/info/exclude'
const EXCLUDED = '# what this checkout alone keeps out of git\n'
const BLOCK = '<!-- context-central:start -->'
const INNER_FILES = [`${MAP}/estate.json`, ...NODE_DIRS.map(dir => `${MAP}/${dir}/`), 'CLAUDE.local.md', `${MAP}/glossary.md`]
const SOLO = { contextCentral: 1, name: 'solo', hub: 'CLAUDE.local.md', repos: [{ name: 'solo', path: '.' }] }

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
  assert.deepEqual(JSON.parse(read(made.base, 'estate.json')) as unknown, { contextCentral: 1, name: made.base.split(/[\\/]/).at(-1), repos: ['api', 'web'] })
  assert.deepEqual(json(made, made.base, 'config', '--get', 'repos'), [{ path: 'api', name: 'api' }, { path: 'web', name: 'web' }])
})

test('in a folder that holds no checkout a plain map registers no repo', () => {
  const root = tree(makeTree({ 'notes.md': '# Notes\n' }))

  const result = plain({ env: {} }, root)

  assert.equal(result.code, 0)
  assert.deepEqual(JSON.parse(read(root, 'estate.json')) as unknown, { contextCentral: 1, name: root.split(/[\\/]/).at(-1), repos: [] })
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

test('with no git on the PATH a plain map cannot ask what git tracks, and goes on as it does for a file of the person\'s own', () => {
  const made = fresh({ 'CLAUDE.local.md': '# Shared on purpose\n' })

  const result = plain({ env: { ...made.env, PATH: tree(makeTree({})) } }, made.main)

  assert.equal(result.code, 0)
  assert.match(result.stdout, /^updated CLAUDE\.local\.md$/m)
})

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
