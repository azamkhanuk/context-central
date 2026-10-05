import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { ACME_CONFIG, ACME_SHOT, disposable, makeTree, run } from './helpers.mts'

const tree = disposable()

const { contextCentral, ...ACME_ANSWERS } = ACME_CONFIG
const CONFIG = { ...ACME_ANSWERS, writeRules: ['Never push without asking.', 'Tracker comments need approval.'] }
const NODE_DIRS = ['repos', 'areas', 'concepts', 'edges', 'decisions', 'docs', 'log', 'work']

const answers = (overrides = {}, files = {}) => tree(makeTree({ 'answers.json': { layout: 'root', git: false, config: CONFIG, ...overrides }, ...files }))
const init = (root: string, ...flags: string[]) => run(['init', '--from', 'answers.json', ...flags], { cwd: root })
const read = (root: string, rel: string) => readFileSync(join(root, rel), 'utf8')
const lines = (text: string) => text.trimEnd().split('\n')

function ignored(root: string, rel: string) {
  const env = { PATH: process.env.PATH, HOME: root, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' }
  return spawnSync('git', ['-C', root, 'check-ignore', '-q', rel], { env }).status === 0
}

test('a map at the estate root gets its config, node folders, hub and glossary', () => {
  const root = answers()

  const result = init(root)

  assert.equal(result.code, 0)
  assert.deepEqual(lines(result.stdout), [
    'created estate.json',
    ...NODE_DIRS.map(dir => `created ${dir}/`),
    'created CLAUDE.md',
    'created glossary.md',
  ])
  assert.deepEqual(JSON.parse(read(root, 'estate.json')) as unknown, { contextCentral: 1, ...CONFIG })
  assert.match(read(root, 'estate.json'), /^\{\n {2}"contextCentral": 1,\n/)
  for (const dir of NODE_DIRS) assert.ok(existsSync(join(root, dir)))
})

test('the map it writes is one the plugin then finds', () => {
  const root = answers()
  init(root)

  const result = run(['config', '--get', 'title'], { cwd: join(root, 'work') })

  assert.equal(result.stdout, 'Acme estate\n')
})

test('a new hub routes to each repo by role and carries the write rules, in under 60 lines', () => {
  const root = answers()
  init(root)

  const hub = read(root, 'CLAUDE.md')

  assert.match(hub, /^# Acme estate\n/)
  assert.match(hub, /^\| `web` \| front end \|$/m)
  assert.match(hub, /^\| `api` \| back end \|$/m)
  assert.match(hub, /^- Never push without asking\.$/m)
  assert.match(hub, /^- Tracker comments need approval\.$/m)
  assert.match(hub, /`work\/<item>\/STATE\.md`/)
  assert.match(hub, /`glossary\.md`/)
  assert.ok(lines(hub).length < 60)
})

test('an existing hub keeps its text and gains one map block', () => {
  const root = answers({}, { 'CLAUDE.md': '# Our rules\n\nAlways run the tests.\n' })

  const first = init(root)
  const second = init(root)

  const hub = read(root, 'CLAUDE.md')
  assert.match(first.stdout, /^updated CLAUDE\.md$/m)
  assert.match(second.stdout, /^kept CLAUDE\.md$/m)
  assert.match(hub, /^# Our rules\n\nAlways run the tests\.\n\n<!-- context-central:start -->\n/)
  assert.match(hub, /\n<!-- context-central:end -->\n$/)
  assert.equal(hub.split('<!-- context-central:start -->').length, 2)
  assert.match(hub, /context-central resolve/)
})

const RESOLVE_LINE =
  "`context-central resolve <item or words>` lists the notes behind a task. A work item's name or title always answers. Other words answer when they single out one item or note; otherwise it says there is no confident match."

test('a new hub says what resolve answers to', () => {
  const root = answers()
  init(root)

  assert.ok(lines(read(root, 'CLAUDE.md')).includes(RESOLVE_LINE))
})

test('the map block added to an existing hub says what resolve answers to', () => {
  const root = answers({}, { 'CLAUDE.md': '# Our rules\n' })
  init(root)

  assert.ok(lines(read(root, 'CLAUDE.md')).some(line => line.endsWith(` ${RESOLVE_LINE}`)))
})

test('a hub that already holds the map block is kept as it is', () => {
  const hub = '# Our rules\n\n<!-- context-central:start -->\n## Context map\n\n`context-central resolve <item or words>` lists the notes behind a task.\n<!-- context-central:end -->\n'
  const root = answers({}, { 'CLAUDE.md': hub })

  const result = init(root)

  assert.match(result.stdout, /^kept CLAUDE\.md$/m)
  assert.equal(read(root, 'CLAUDE.md'), hub)
})

test('the glossary starts with a heading and the entry format', () => {
  const root = answers()
  init(root)

  const glossary = read(root, 'glossary.md')

  assert.match(glossary, /^# Glossary\n/)
  assert.match(glossary, /\*\*Term\*\*/)
  assert.match(glossary, /_Avoid_:/)
})

test('a map inside a repo lives under .context-central', () => {
  const root = answers({ layout: 'inner', git: true }, { '.gitignore': 'node_modules\n' })

  const result = init(root)

  assert.deepEqual(lines(result.stdout), [
    'created .context-central/estate.json',
    ...NODE_DIRS.map(dir => `created .context-central/${dir}/`),
    'created CLAUDE.md',
    'created .context-central/glossary.md',
    'created .context-central/.gitignore',
  ])
  assert.equal(run(['where', '--json'], { cwd: root }).stdout.includes('"layout": "inner"'), true)
  assert.equal(read(root, '.gitignore'), 'node_modules\n')
  assert.equal(existsSync(join(root, '.gitattributes')), false)
})

test("a map inside a repo adds its block to the repo's own instruction file, which is what a session there loads", () => {
  const root = answers({ layout: 'inner' }, { 'CLAUDE.md': '# Our rules\n\nAlways run the tests.\n' })

  const first = init(root)
  const second = init(root)

  const hub = read(root, 'CLAUDE.md')
  assert.match(first.stdout, /^updated CLAUDE\.md$/m)
  assert.match(second.stdout, /^kept CLAUDE\.md$/m)
  assert.match(hub, /^# Our rules\n\nAlways run the tests\.\n\n<!-- context-central:start -->\n/)
  assert.match(hub, /\n<!-- context-central:end -->\n$/)
  assert.equal(hub.split('<!-- context-central:start -->').length, 2)
  assert.equal(existsSync(join(root, '.context-central/CLAUDE.md')), false)
  const budget = JSON.parse(run(['budget', '--json'], { cwd: root, env: { HOME: root } }).stdout) as { files: { path: string }[] }
  assert.deepEqual(
    budget.files.map(file => file.path),
    [join(root, 'CLAUDE.md')],
  )
})

test('a map inside a repo is described in the hub by paths from the repo root', () => {
  const fresh = answers({ layout: 'inner' })
  const lived = answers({ layout: 'inner' }, { 'CLAUDE.md': '# Our rules\n' })
  init(fresh)
  init(lived)

  const created = read(fresh, 'CLAUDE.md')
  const updated = read(lived, 'CLAUDE.md')

  assert.match(created, /^- `\.context-central\/repos\/`: /m)
  assert.match(created, /^- `\.context-central\/work\/<item>\/STATE\.md`: /m)
  assert.match(created, /^- `\.context-central\/glossary\.md`: /m)
  assert.match(created, /A repo gets a note under `\.context-central\/repos\/`/)
  assert.match(updated, /recorded in `\.context-central\/work\/<item>\/STATE\.md` and the estate's terms in `\.context-central\/glossary\.md`/)
})

test('both hub blocks say where files that are not text go', () => {
  const fresh = answers()
  const lived = answers({}, { 'CLAUDE.md': '# Our rules\n' })
  const inner = answers({ layout: 'inner' }, { 'CLAUDE.md': '# Our rules\n' })
  for (const root of [fresh, lived, inner]) init(root)

  assert.match(read(fresh, 'CLAUDE.md'), /^- `work\/<item>\/STATE\.md`: where a piece of work stands and what is next\. Files that are not text sit in `evidence\/` beside it\.$/m)
  assert.match(read(lived, 'CLAUDE.md'), / Evidence that is not text sits in `work\/<item>\/evidence\/`\. /)
  assert.match(read(inner, 'CLAUDE.md'), / Evidence that is not text sits in `\.context-central\/work\/<item>\/evidence\/`\. /)
})

test('configured node folders and hub name are honoured', () => {
  const root = answers({ config: { ...CONFIG, nodeDirs: ['repos', 'work'], hub: 'AGENTS.md' } })

  const result = init(root)

  assert.deepEqual(lines(result.stdout), ['created estate.json', 'created repos/', 'created work/', 'created AGENTS.md', 'created glossary.md'])
})

test('a map kept in git ignores everything at the root except the map itself', () => {
  const root = answers({ git: true }, { 'web/README.md': '# web checkout\n' })
  spawnSync('git', ['-C', root, 'init', '-q'])

  const result = init(root)

  assert.deepEqual(lines(result.stdout).slice(-2), ['created .gitignore', 'created .gitattributes'])
  assert.equal(read(root, '.gitattributes'), 'log/*.md merge=union\n')
  for (const kept of ['web', 'web/README.md', 'answers.json', 'scratch']) assert.equal(ignored(root, kept), true, kept)
  const tracked = ['estate.json', 'CLAUDE.md', 'glossary.md', '.gitignore', '.gitattributes', 'package.json', '.claude/settings.json', 'bin/context-central']
  for (const rel of [...tracked, ...NODE_DIRS.map(dir => `${dir}/note.md`)]) assert.equal(ignored(root, rel), false, rel)
})

const BESIDE = ['work/PROJ-12/STATE.md', 'work/PROJ-12/notes/2026-01-14-evidence.md', 'work/PROJ-12/sources/01-ticket.md']
const ITEM = Object.fromEntries([ACME_SHOT, ...BESIDE].map(rel => [rel, 'x']))

test('a root map kept in git with evidence not committed ignores each item\'s evidence and nothing beside it', () => {
  const root = answers({ git: true }, ITEM)
  spawnSync('git', ['-C', root, 'init', '-q'])

  init(root)

  assert.equal(ignored(root, ACME_SHOT), true)
  for (const rel of BESIDE) assert.equal(ignored(root, rel), false, rel)
})

test('a root map kept in git with evidence committed ignores none of it', () => {
  const root = answers({ git: true, config: { ...CONFIG, evidence: { commit: true } } }, ITEM)
  spawnSync('git', ['-C', root, 'init', '-q'])

  init(root)

  for (const rel of [ACME_SHOT, ...BESIDE]) assert.equal(ignored(root, rel), false, rel)
})

const inMap = (rel: string) => `.context-central/${rel}`
const INNER_ITEM = Object.fromEntries(Object.entries(ITEM).map(([rel, content]) => [inMap(rel), content]))

test('an inner map kept in git with evidence not committed gets an ignore file inside the map folder', () => {
  const root = answers({ layout: 'inner', git: true }, { ...INNER_ITEM, '.gitignore': 'node_modules\n', 'work/PROJ-12/evidence/fixture.png': 'x' })
  spawnSync('git', ['-C', root, 'init', '-q'])

  const result = init(root)

  assert.equal(lines(result.stdout).at(-1), 'created .context-central/.gitignore')
  assert.equal(read(root, '.context-central/.gitignore'), '/work/*/evidence/\n')
  assert.equal(read(root, '.gitignore'), 'node_modules\n')
  assert.equal(ignored(root, inMap(ACME_SHOT)), true)
  for (const rel of [...BESIDE.map(inMap), 'work/PROJ-12/evidence/fixture.png']) assert.equal(ignored(root, rel), false, rel)
})

test('an inner map gets no ignore file when evidence is committed or the map is not kept in git', () => {
  const committed = answers({ layout: 'inner', git: true, config: { ...CONFIG, evidence: { commit: true } } })
  const outOfGit = answers({ layout: 'inner', git: false })

  for (const root of [committed, outOfGit]) {
    init(root)

    assert.equal(existsSync(join(root, '.context-central/.gitignore')), false)
  }
})

test('an ignore file already inside the map folder is kept as it is', () => {
  const root = answers({ layout: 'inner', git: true }, { '.context-central/.gitignore': 'drafts/\n' })

  const result = init(root)

  assert.equal(lines(result.stdout).at(-1), 'kept .context-central/.gitignore')
  assert.equal(read(root, '.context-central/.gitignore'), 'drafts/\n')
})

test('a dry run for an inner map says it would create the ignore file and writes none', () => {
  const root = answers({ layout: 'inner', git: true })

  const result = init(root, '--dry-run')

  assert.equal(lines(result.stdout).at(-1), 'would create .context-central/.gitignore')
  assert.equal(existsSync(join(root, '.context-central')), false)
})

test('the ignore rule uses the work folder named in the settings', () => {
  const config = { ...CONFIG, workDir: 'items', nodeDirs: ['repos', 'items'] }
  const root = answers({ git: true, config }, { 'items/PROJ-12/evidence/shot.png': 'x', 'items/PROJ-12/STATE.md': 'x', 'work/PROJ-12/evidence/shot.png': 'x' })
  const inner = answers({ layout: 'inner', git: true, config })
  spawnSync('git', ['-C', root, 'init', '-q'])

  init(root)
  init(inner)

  assert.equal(lines(read(root, '.gitignore')).at(-1), '/items/*/evidence/')
  assert.equal(ignored(root, 'items/PROJ-12/evidence/shot.png'), true)
  assert.equal(ignored(root, 'items/PROJ-12/STATE.md'), false)
  assert.equal(read(inner, '.context-central/.gitignore'), '/items/*/evidence/\n')
})

test('git files already there are kept as they are', () => {
  const root = answers({ git: true }, { '.gitignore': 'node_modules\n', '.gitattributes': '* text=auto\n' })

  const result = init(root)

  assert.deepEqual(lines(result.stdout).slice(-2), ['kept .gitignore', 'kept .gitattributes'])
  assert.equal(read(root, '.gitignore'), 'node_modules\n')
  assert.equal(read(root, '.gitattributes'), '* text=auto\n')
})

test('a dry run says what it would do and writes nothing', () => {
  const root = answers({ git: true }, { 'CLAUDE.md': '# Our rules\n', 'work/PROJ-12/STATE.md': '# PROJ-12\n' })

  const result = init(root, '--dry-run')

  assert.deepEqual(lines(result.stdout), [
    'would create estate.json',
    ...NODE_DIRS.slice(0, -1).map(dir => `would create ${dir}/`),
    'kept work/',
    'would update CLAUDE.md',
    'would create glossary.md',
    'would create .gitignore',
    'would create .gitattributes',
  ])
  assert.deepEqual(readdirSync(root).sort(), ['CLAUDE.md', 'answers.json', 'work'])
  assert.equal(read(root, 'CLAUDE.md'), '# Our rules\n')
})

test('running it twice overwrites nothing', () => {
  const root = answers()
  init(root)
  const hub = read(root, 'CLAUDE.md')

  const result = init(root)

  assert.deepEqual(lines(result.stdout), ['kept estate.json', ...NODE_DIRS.map(dir => `kept ${dir}/`), 'kept CLAUDE.md', 'kept glossary.md'])
  assert.equal(read(root, 'CLAUDE.md'), hub)
})

test('an estate.json that belongs to another tool is not taken over', () => {
  const root = answers({}, { 'estate.json': { agent: 'someone else' } })

  const result = init(root)

  assert.equal(result.code, 1)
  assert.match(result.stderr, /estate\.json exists and is not a context-central config/)
  assert.deepEqual(JSON.parse(read(root, 'estate.json')) as unknown, { agent: 'someone else' })
})

test('a target folder can be named', () => {
  const root = answers()

  const result = run(['init', 'estate', '--from', 'answers.json'], { cwd: root })

  assert.equal(result.code, 0)
  assert.equal((JSON.parse(read(root, 'estate/estate.json')) as { name: unknown }).name, 'acme')
})

test('answers without a usable layout or config are refused', () => {
  const noName = answers({ config: { title: 'No name' } })
  const badLayout = answers({ layout: 'sideways' })

  assert.match(init(noName).stderr, /"config" needs a "name"/)
  assert.match(init(badLayout).stderr, /"layout" must be "root" or "inner"/)
  assert.equal(init(badLayout).code, 1)
  assert.equal(existsSync(join(badLayout, 'estate.json')), false)
})

test('answers that are not an object, or carry no config, are refused', () => {
  const notAnObject = tree(makeTree({ 'answers.json': 'null\n' }))
  const noConfig = tree(makeTree({ 'answers.json': { layout: 'root', git: false } }))

  assert.equal(init(notAnObject).code, 1)
  assert.equal(init(notAnObject).stderr, 'context-central init: answers file: expected an object with "layout" and "config"\n')
  assert.equal(init(noConfig).code, 1)
  assert.equal(init(noConfig).stderr, 'context-central init: answers file: "config" must be an object holding the estate.json content\n')
})

test('a config the plugin would refuse to read is refused before anything is written', () => {
  const nodeDirsNotAList = answers({ config: { ...CONFIG, nodeDirs: 'repos' } })
  const repoWithoutName = answers({ config: { ...CONFIG, repos: [{ role: 'front end' }] } })
  const badKeyPattern = answers({ config: { ...CONFIG, tracker: { keyPatterns: ['PROJ-('] } } })

  assert.equal(init(nodeDirsNotAList).stderr, 'context-central init: answers file: "config": "nodeDirs" must be a list\n')
  assert.equal(init(repoWithoutName).stderr, 'context-central init: answers file: "config": each entry in "repos" needs a "name"\n')
  assert.equal(init(badKeyPattern).stderr, 'context-central init: answers file: "config": tracker.keyPatterns: "PROJ-(" is not a valid regular expression\n')
  for (const root of [nodeDirsNotAList, repoWithoutName, badKeyPattern]) {
    assert.equal(init(root).code, 1)
    assert.deepEqual(readdirSync(root), ['answers.json'])
  }
})

test('a config already there that the plugin cannot read stops the run', () => {
  const root = answers({}, { 'estate.json': { contextCentral: 2, name: 'acme' } })

  const result = init(root)

  assert.equal(result.code, 1)
  assert.equal(result.stderr, 'context-central init: estate.json: "contextCentral" is 2; this version reads 1\n')
  assert.deepEqual(readdirSync(root).sort(), ['answers.json', 'estate.json'])
})

test('init without answers is wrong usage', () => {
  const root = answers()

  assert.equal(run(['init'], { cwd: root }).code, 2)
})

test('the settings to approve name the marketplace, the plugin and the one permission', () => {
  const plugin = tree(makeTree({ '.claude-plugin/plugin.json': { name: 'context-central', repository: 'https://github.com/acme/context-central' } }))

  const result = run(['init', '--print-settings'], { cwd: plugin, env: { CONTEXT_CENTRAL_PLUGIN_ROOT: plugin } })

  assert.equal(result.code, 0)
  assert.deepEqual(JSON.parse(result.stdout) as unknown, {
    extraKnownMarketplaces: { 'context-central': { source: { source: 'github', repo: 'acme/context-central' } } },
    enabledPlugins: { 'context-central@context-central': true },
    permissions: { allow: ['Bash(context-central *)'] },
  })
  assert.equal(existsSync(join(plugin, '.claude')), false)
})

test('a new map starts with no broken links and no orphans', () => {
  const root = answers()
  run(['init', '--from', 'answers.json'], { cwd: root })

  const result = run(['graph', '--strict'], { cwd: root })

  assert.equal(result.code, 0)
  assert.equal(result.stdout, '0 nodes, 0 links\n')
})

test('a byte-order mark at the start of the answers file is ignored', () => {
  const root = tree(makeTree({ 'answers.json': `\uFEFF${JSON.stringify({ layout: 'root', git: false, config: CONFIG })}\n` }))

  const result = init(root)

  assert.equal(result.stderr, '')
  assert.equal(result.code, 0)
  assert.deepEqual(JSON.parse(read(root, 'estate.json')) as unknown, { contextCentral: 1, ...CONFIG })
})

test('a config already there with a byte-order mark is read, and the rest of the map is written round it', () => {
  const root = answers({}, { 'estate.json': `\uFEFF${JSON.stringify({ contextCentral: 1, ...CONFIG })}\n` })

  const result = init(root)

  assert.equal(result.stderr, '')
  assert.deepEqual(lines(result.stdout).slice(0, 2), ['kept estate.json', 'created repos/'])
})
