import assert from 'node:assert/strict'
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { acme, checkout, disposable, git, hook, makeTree, notOnWindows, run, solo, workTree } from './helpers.mts'
import type { Checkout, Json, TreeFiles } from './helpers.mts'

const tree = disposable()

const NAME = 'gateway-limits'
const TITLE = 'How the gateway limits a shop'
const FILES = ['brief.md', 'index.md', 'log.md', 'reading.md', 'set-aside.md']
const SHEET = `---
research: gateway-limits
title: How the gateway limits a shop
---
# How the gateway limits a shop

This folder is one research: what was found on the questions below, with every source kept beside it. It can be read with nothing else to hand.

- This file is the fact sheet. Each fact is one sentence with a number that is never used again, a mark, and every source that says it.
- The mark says how a fact is known: \`verified\` was read in the source itself, and \`inferred\` was reasoned from what its \`From\` line names.
- A fact marked \`disputed\` has sources that disagree, and both are shown.
- A fact that no longer holds leaves this sheet for [the log](log.md), under its number. The fact in its place says which number it supersedes, when and why.
- [The brief](brief.md) holds the questions and where the run looked. [The log](log.md) holds one entry a round. [The set-aside list](set-aside.md) holds what was judged beside the point. [The reading](reading.md) is one person's judgement of the facts. \`sources/\` holds each source in full, never edited.

## Questions

## Check again by

## Not reached

## Facts

## Sources
`
const BRIEF = `# How the gateway limits a shop: the brief

What this research was asked and where it looked. A question asks what is so, never what is wanted.

## Questions

## Sources to cover

## Depth

## Out of scope

## Start line
`
const LOG = `# How the gateway limits a shop: the log

One entry a round, in the order the rounds were run. A fact that no longer holds is kept here word for word, under its number, in the entry of the round that superseded it.
`
const SET_ASIDE = `# How the gateway limits a shop: the set-aside list

What was judged beside the point, each with its source and one line of reason. A line moved under Bring in is fetched by the next round, and no round uses what is under Set aside.

## Set aside

## Bring in
`
const READING = `# How the gateway limits a shop: the reading

One person's judgement of the facts on [the fact sheet](index.md), which it names by their numbers. Each run adds a part under its date.
`

const NOWHERE_ELSE = 'name another folder with "researchDir" in estate.json'
const ROOT_MAP = {
  'estate.json': { contextCentral: 1, name: 'solo', repos: [{ name: 'solo', path: '.' }] },
  'CLAUDE.md': '# Solo\n',
  'src/app.js': 'export {}\n',
}

const SOURCE = '01-2026-01-14-chat-retries-full-text.md'
const SOURCE_TEXT = '# Retries, as the thread has it\n\nThree times.\n'
const sizeOf = (text: string) => Buffer.byteLength(text)
const TWO_LETTER_CASES = (() => {
  const probe = makeTree({ 'a.md': '' })
  const one = existsSync(join(probe, 'A.md'))
  rmSync(probe, { recursive: true, force: true })
  return one ? { skip: 'this disk holds one name under both letter cases' } : {}
})()

type Named = { researchDir: string, notNodes?: string[] }

const A_NAME = 'a research name is letters, digits, dots, dashes and underscores, opens with a letter or a digit and does not end in a dot, for example gateway-limits'
const USAGE = 'expected one of: new <name> [--title <title>] [--item <item>] [--json], open <name> [--json]'
const DATES = 'dates: today is 2026-01-15, 30 days on is 2026-02-14, 7 days on is 2026-01-22'
const FULL_SHEET = `---
research: gateway-limits
title: How the gateway limits a shop
item: PROJ-12
---
# How the gateway limits a shop

## Check again by

2026-02-13, since the limits are being changed. It was first set for 2026-01-20.

## Facts

- **F7** \`verified\` The gateway retries a failed call three times.
  - Source: [03-2026-01-14-chat-retries-full-text.md](sources/03-2026-01-14-chat-retries-full-text.md)
  - Supersedes F3, 2026-01-14: the count was raised from two.
- **F8** \`inferred\` An export retries the same way, since it calls the gateway.
  - From: F7
- **F9** \`verified\` \`disputed\` The limit is 100 calls a minute by one source and 60 by the other.
  - Source: [04-2026-01-14-mail-limits-full-text.md](sources/04-2026-01-14-mail-limits-full-text.md): 100
  - Source: https://example.com/limits: 60
`
const FULL_LOG = `# How the gateway limits a shop: the log

## Round 1, 2026-01-13

- Answered: Q1 by F3
- Stopped: every question was answered

## Round 2, 2026-01-14

- Answered: Q1 by F7 and F8
- Stopped: a round added no fact and no lead

### Superseded

- **F3** \`verified\` The gateway retries a failed call twice.
  - Source: https://example.com/pr/88
`

const BY_MODE = process.getuid?.() === 0 ? { skip: 'root reads a folder whatever its mode' } : notOnWindows('a folder on Windows is not closed to reading by its mode')

const research = (cwd: string, ...args: string[]) => run(['research', ...args], { cwd })
const open = (cwd: string, ...args: string[]) => run(['research', 'open', ...args], { cwd, env: { TZ: 'UTC' } })
const opened = (cwd: string, label: string) => open(cwd, NAME).stdout.split('\n').find(line => line.startsWith(`${label}:`))
const withFull = (more: TreeFiles = {}, settings: { [key: string]: Json } = {}) =>
  tree(acme({ 'research/gateway-limits/index.md': FULL_SHEET, 'research/gateway-limits/log.md': FULL_LOG, 'research/gateway-limits/sources/03-2026-01-14-chat-retries-full-text.md': '# Retries\n', 'research/gateway-limits/sources/04-2026-01-14-mail-limits-full-text.md': '# Limits\n', ...more }, settings))
const withSheet = (...below: string[]) => tree(acme({ 'research/gateway-limits/index.md': ['---', 'research: gateway-limits', '---', '# Limits', '', ...below, ''].join('\n') }))
const inGit = (made: Checkout, cwd: string, ...args: string[]) => run(args, { cwd, env: made.env })
const made = (one: Checkout) => (tree(one.base), one)
const settingsRefused = (settings: { [key: string]: Json }) => run(['config'], { cwd: tree(acme({}, settings)) })
const read = (root: string, ...rel: string[]) => readFileSync(join(root, ...rel), 'utf8')

test('a new research is a folder of five files with a folder for its sources, and the command prints the place of its fact sheet', () => {
  const root = tree(acme())

  const result = research(root, 'new', NAME, '--title', TITLE)

  assert.deepEqual(result, { code: 0, stdout: 'research/gateway-limits/index.md\n', stderr: '' })
  assert.deepEqual(readdirSync(join(root, 'research', NAME)).sort(), [...FILES, 'sources'])
  assert.deepEqual(readdirSync(join(root, 'research', NAME, 'sources')), [])
})

test('the fact sheet of a new research says how to read the folder and has its five parts, each with nothing under it', () => {
  const root = tree(acme())

  research(root, 'new', NAME, '--title', TITLE)

  assert.equal(read(root, 'research', NAME, 'index.md'), SHEET)
})

test('the brief, the log, the set-aside list and the reading of a new research carry its title and the parts each is written under', () => {
  const root = tree(acme())

  research(root, 'new', NAME, '--title', TITLE)

  assert.equal(read(root, 'research', NAME, 'brief.md'), BRIEF)
  assert.equal(read(root, 'research', NAME, 'log.md'), LOG)
  assert.equal(read(root, 'research', NAME, 'set-aside.md'), SET_ASIDE)
  assert.equal(read(root, 'research', NAME, 'reading.md'), READING)
})

test('no file of a new research names a step, a skill or the plugin', () => {
  const root = tree(acme())

  research(root, 'new', NAME, '--title', TITLE, '--item', 'PROJ-12')

  const naming = FILES.filter(file => /context-central|\b(prep|design|implement|checkpoint|onboard|skill|step)\b|\/[a-z-]+:[a-z]/i.test(read(root, 'research', NAME, file)))
  assert.deepEqual(naming, [])
})

test('a research made for a work item names the item on its fact sheet, as the item is spelt', () => {
  const root = tree(acme())

  const result = research(root, 'new', NAME, '--title', TITLE, '--item', 'proj-12')

  assert.equal(result.code, 0)
  assert.ok(read(root, 'research', NAME, 'index.md').startsWith('---\nresearch: gateway-limits\ntitle: How the gateway limits a shop\nitem: PROJ-12\n---\n# How the gateway limits a shop\n'))
})

test('a research given no title is titled by its name', () => {
  const root = tree(acme())

  research(root, 'new', NAME)

  assert.ok(read(root, 'research', NAME, 'index.md').startsWith('---\nresearch: gateway-limits\ntitle: gateway-limits\n---\n# gateway-limits\n'))
  assert.ok(read(root, 'research', NAME, 'brief.md').startsWith('# gateway-limits: the brief\n'))
})

test('a research with no name, or a name that is not letters, digits, dots, dashes and underscores, is wrong usage and makes nothing', () => {
  const root = tree(acme())

  for (const odd of [[], ['../escape'], ['gateway limits'], ['.hidden'], ['_draft'], ['a/b'], ['one', 'two'], ['foo.'], ['v1..'], ['.']]) {
    const result = research(root, 'new', ...odd)

    assert.equal(result.code, 2, odd.join(' '))
    assert.equal(result.stdout, '', odd.join(' '))
    assert.equal(existsSync(join(root, 'research')), false, odd.join(' '))
  }
  assert.equal(research(root, 'new').stderr, `context-central research: ${USAGE}\n`)
  assert.equal(research(root, 'new', '../escape').stderr, `context-central research: ${A_NAME}\n`)
  assert.equal(research(root, 'new', 'foo.').stderr, `context-central research: ${A_NAME}\n`)
  assert.equal(research(root, 'new', 'v1.2_final-b').stdout, 'research/v1.2_final-b/index.md\n')
})

test('an action that research does not have is wrong usage', () => {
  const root = tree(acme())

  for (const odd of [[], ['remove', NAME]]) {
    assert.deepEqual(research(root, ...odd), { code: 2, stdout: '', stderr: `context-central research: ${USAGE}\n` }, odd.join(' '))
  }
})

test('in a folder no map covers a research is not made, and the command says that no map was found', () => {
  const outside = tree(makeTree({ 'readme.txt': 'x\n' }))

  const result = research(outside, 'new', NAME)

  assert.equal(result.code, 1)
  assert.ok(result.stderr.startsWith(`context-central research: no context map found from ${outside}.`))
  assert.deepEqual(readdirSync(outside), ['readme.txt'])
})

test('a map kept inside a checkout whose one repo is the checkout itself takes a research, and so does a root map at the root of a repository', () => {
  const inner = made(solo())
  const root = made(checkout(ROOT_MAP))

  assert.deepEqual(inGit(inner, inner.main, 'research', 'new', NAME), { code: 0, stdout: 'research/gateway-limits/index.md\n', stderr: '' })
  assert.deepEqual(readdirSync(join(inner.main, '.context-central', 'research', NAME)).sort(), [...FILES, 'sources'])
  assert.equal(inGit(root, root.main, 'research', 'new', NAME).stdout.split('\n')[0], 'research/gateway-limits/index.md')
  assert.deepEqual(readdirSync(join(root.main, 'research', NAME)).sort(), [...FILES, 'sources'])
})

test('a plain map that init made takes a research, and git still shows nothing new', () => {
  const one = made(checkout({ 'README.md': '# Solo\n' }))
  inGit(one, one.main, 'init', '--plain')

  const result = inGit(one, one.main, 'research', 'new', NAME)

  assert.deepEqual(result, { code: 0, stdout: 'research/gateway-limits/index.md\n', stderr: '' })
  assert.deepEqual(readdirSync(join(one.main, '.context-central', 'research', NAME)).sort(), [...FILES, 'sources'])
  assert.equal(git(one, one.main, 'status', '--porcelain', '--untracked-files=all').stdout, '')
})

test('a map that lists its own kinds of folder takes a research with nothing changed by hand', () => {
  const root = tree(acme({}, { nodeDirs: ['repos', 'concepts', 'work'] }))

  const result = research(root, 'new', NAME)

  assert.deepEqual(result, { code: 0, stdout: 'research/gateway-limits/index.md\n', stderr: '' })
  assert.equal(run(['resolve', NAME], { cwd: root }).stdout.split('\n')[0], 'Context for research gateway-limits:')
  assert.equal(run(['config', '--get', 'nodeDirs'], { cwd: root }).stdout, '[\n  "repos",\n  "concepts",\n  "work"\n]\n')
})

test('an estate that keeps something else under research names another folder for its researches', () => {
  const root = tree(acme({ 'research/market.md': '# Market research\n' }, { researchDir: 'findings/' }))

  const result = research(root, 'new', NAME)

  assert.deepEqual(result, { code: 0, stdout: 'findings/gateway-limits/index.md\n', stderr: '' })
  assert.deepEqual(readdirSync(join(root, 'findings', NAME)).sort(), [...FILES, 'sources'])
  assert.deepEqual(readdirSync(join(root, 'research')), ['market.md'])
  assert.equal(run(['config', '--get', 'researchDir'], { cwd: root }).stdout, 'findings\n')
})

test('the folder for researches is research on a map that names none', () => {
  const root = tree(acme())

  assert.equal(run(['config', '--get', 'researchDir'], { cwd: root }).stdout, 'research\n')
})

test('a folder for researches that is not text is refused when the settings are read', () => {
  for (const odd of [5, '', ['research']]) {
    const result = settingsRefused({ researchDir: odd })

    assert.equal(result.code, 1, JSON.stringify(odd))
    assert.ok(result.stderr.endsWith('estate.json: "researchDir" must be text\n'), JSON.stringify(odd))
  }
})

test('a folder for researches that is absolute, holds two dots or a backslash, or would leave the map is refused when the settings are read', () => {
  for (const odd of ['/tmp/research', 'C:/research', '../research', 'notes/../../research', 'notes\\research', './research', '/', 'notes//research']) {
    const result = settingsRefused({ researchDir: odd })

    assert.equal(result.code, 1, odd)
    assert.ok(result.stderr.endsWith(`estate.json: "researchDir" is "${odd}"; it names a folder counted from the map's folder, with forward slashes and no ".."\n`), odd)
  }
})

test('the work folder and the log are not taken as the folder for researches, whatever the case of their letters, and nor is a folder inside either', () => {
  const kept: [string, { [key: string]: Json }][] = [['work', {}], ['log', {}], ['Work', {}], ['LOG/', {}], ['work/research', {}], ['Work/Research', {}], ['log/research', {}], ['items/', { workDir: 'items' }], ['Items/found', { workDir: 'items/' }]]

  for (const [odd, settings] of kept) {
    const result = settingsRefused({ ...settings, researchDir: odd })

    assert.equal(result.code, 1, odd)
    assert.ok(result.stderr.endsWith(`estate.json: "researchDir" is "${odd}"; research's folder is not the work folder or the log, nor a folder inside one of them\n`), odd)
  }
  assert.equal(run(['config', '--get', 'researchDir'], { cwd: tree(acme({}, { researchDir: 'workshop/logbook' })) }).stdout, 'workshop/logbook\n')
})

test('a folder of the deep tier is not taken as the folder for researches, nor one below it, since nothing under it is read as a note', () => {
  const deep: [string, string, { [key: string]: Json }][] = [['sources', 'sources', {}], ['Sources', 'sources', {}], ['research/sources', 'sources', {}], ['notes/sources/research', 'sources', {}], ['raw/research', 'raw', { deepDirs: ['sources', 'raw'] }]]

  for (const [odd, folder, settings] of deep) {
    const result = settingsRefused({ ...settings, researchDir: odd })

    assert.equal(result.code, 1, odd)
    assert.ok(result.stderr.endsWith(`estate.json: "researchDir" is "${odd}"; the map keeps a folder named ${folder} for the deep tier, so nothing under it is read as a note\n`), odd)
  }
  assert.equal(run(['config', '--get', 'researchDir'], { cwd: tree(acme({}, { researchDir: 'raw/research' })) }).stdout, 'raw/research\n')
})

test('a folder the map never lists is not taken as the folder for researches: one whose name opens with a dot, or node_modules, or one below either', () => {
  for (const odd of ['.research', 'notes/.hidden', 'notes/.hidden/research', 'node_modules', 'notes/node_modules/research']) {
    const result = settingsRefused({ researchDir: odd })

    assert.equal(result.code, 1, odd)
    assert.ok(result.stderr.endsWith(`estate.json: "researchDir" is "${odd}"; the map never lists a folder whose name opens with a dot, nor node_modules\n`), odd)
  }
})

test("a template for the reading that would leave the estate, or is not text, is refused when the settings are read", () => {
  for (const odd of ['../reading.md', '/tmp/reading.md', 'templates\\reading.md']) {
    const result = settingsRefused({ readingTemplate: odd })

    assert.equal(result.code, 1, odd)
    assert.ok(result.stderr.endsWith(`estate.json: "readingTemplate" holds "${odd}"; a path there is counted from the estate root, with forward slashes and no ".."\n`), odd)
  }
  assert.ok(settingsRefused({ readingTemplate: 5 }).stderr.endsWith('estate.json: "readingTemplate" must be text\n'))
})

test("where the estate names a template for the reading, a new research's reading is that file as it is written", () => {
  const root = tree(acme({ 'templates/reading.md': '# What we make of it\n\n## For the board\n' }, { readingTemplate: 'templates/reading.md' }))

  research(root, 'new', NAME, '--title', TITLE)

  assert.equal(read(root, 'research', NAME, 'reading.md'), '# What we make of it\n\n## For the board\n')
  assert.equal(read(root, 'research', NAME, 'brief.md'), BRIEF)
})

test("a template for the reading that is not there, or is a folder, stops a new research with nothing written", () => {
  const neither: TreeFiles[] = [{}, { 'templates/reading.md/x.md': '# x\n' }]

  for (const files of neither) {
    const root = tree(acme(files, { readingTemplate: 'templates/reading.md' }))

    const result = research(root, 'new', NAME)

    assert.deepEqual(result, { code: 1, stdout: '', stderr: "context-central research: the reading's template templates/reading.md cannot be read\n" })
    assert.equal(existsSync(join(root, 'research')), false)
  }
})

test('a research that is there already is refused, as a folder, as a file and under another letter case, and nothing is written over', () => {
  const root = tree(acme({ 'research/as-a-file': 'kept\n', 'research/By-Hand/notes.md': '# Kept\n' }))
  research(root, 'new', NAME, '--title', TITLE)
  writeFileSync(join(root, 'research', NAME, 'index.md'), '# Rewritten by hand\n')

  for (const [asked, held] of [[NAME, NAME], ['Gateway-Limits', NAME], ['as-a-file', 'as-a-file'], ['by-hand', 'By-Hand']]) {
    const result = research(root, 'new', asked)

    assert.deepEqual(result, { code: 1, stdout: '', stderr: `context-central research: research/${asked} is there already\n` }, asked)
    assert.deepEqual(readdirSync(join(root, 'research')).sort(), ['By-Hand', 'as-a-file', NAME], held)
  }
  assert.equal(read(root, 'research', NAME, 'index.md'), '# Rewritten by hand\n')
  assert.deepEqual(readdirSync(join(root, 'research', 'By-Hand')), ['notes.md'])
})

test('a research whose name is held by a link is refused, where the link leads somewhere and where it leads nowhere', notOnWindows('a link needs a right most Windows accounts lack'), () => {
  const root = tree(acme({ 'elsewhere/kept.md': '# Kept\n' }))
  mkdirSync(join(root, 'research'))
  symlinkSync(join(root, 'elsewhere'), join(root, 'research', 'linked'))
  symlinkSync(join(root, 'nowhere'), join(root, 'research', 'dangling'))

  for (const name of ['linked', 'dangling']) {
    assert.deepEqual(research(root, 'new', name), { code: 1, stdout: '', stderr: `context-central research: research/${name} is there already\n` }, name)
  }
  assert.deepEqual(readdirSync(join(root, 'elsewhere')).sort(), ['kept.md', 'readme.md'])
})

test('a research for a work item that is not there is refused with nothing written', () => {
  const root = tree(acme())

  const result = research(root, 'new', NAME, '--item', 'PROJ-99')

  assert.deepEqual(result, { code: 1, stdout: '', stderr: 'context-central research: no work item "PROJ-99"\n' })
  assert.equal(existsSync(join(root, 'research')), false)
})

test("no research is made where research's folder is a file, and the command says how to name another", () => {
  const root = tree(acme({ research: 'not a folder\n' }))

  const result = research(root, 'new', NAME)

  assert.deepEqual(result, { code: 1, stdout: '', stderr: `context-central research: research is a file, not a folder, so no research is made there: ${NOWHERE_ELSE}\n` })
  assert.equal(read(root, 'research'), 'not a folder\n')
})

test("no research is made where research's folder holds a .git of its own, as a folder or as a file", () => {
  const either: TreeFiles[] = [{ 'research/.git/HEAD': 'ref: refs/heads/main\n' }, { 'research/.git': 'gitdir: ../elsewhere/.git\n' }]

  for (const files of either) {
    const root = tree(acme(files))

    const result = research(root, 'new', NAME)

    assert.deepEqual(result, { code: 1, stdout: '', stderr: `context-central research: research holds a .git of its own, so no research is made there: ${NOWHERE_ELSE}\n` })
    assert.deepEqual(readdirSync(join(root, 'research')), ['.git'])
  }
})

test("no research is made where research's folder is a registered repo's folder below the map, or lies inside one", () => {
  for (const researchDir of ['web', 'web/research', 'api/docs/research']) {
    const root = tree(acme({}, { researchDir }))
    const repo = researchDir.split('/')[0]

    const result = research(root, 'new', NAME)

    assert.deepEqual(result, { code: 1, stdout: '', stderr: `context-central research: ${researchDir} is inside the repo ${repo}, so no research is made there: ${NOWHERE_ELSE}\n` }, researchDir)
    assert.equal(existsSync(join(root, researchDir, NAME)), false, researchDir)
  }
})

test("no research is made where research's folder is under a notNodes entry or a leftAlone entry", () => {
  const under: [Named, string][] = [
    [{ researchDir: 'research', notNodes: ['research'] }, 'research is under a notNodes entry'],
    [{ researchDir: 'private/research', notNodes: ['private/'] }, 'private/research is under a notNodes entry'],
    [{ researchDir: 'scratch/research' }, 'scratch/research is under a leftAlone entry'],
    [{ researchDir: 'scratch' }, 'scratch is under a leftAlone entry'],
  ]

  for (const [settings, said] of under) {
    const root = tree(acme({}, settings))

    const result = research(root, 'new', NAME)

    assert.deepEqual(result, { code: 1, stdout: '', stderr: `context-central research: ${said}, so no research is made there: ${NOWHERE_ELSE}\n` }, said)
    assert.equal(existsSync(join(root, settings.researchDir, NAME)), false, said)
  }
})

test('where git tracks the settings of the map, a new research says in a second line whether git keeps its folder or ignores it', () => {
  const kept = made(checkout(ROOT_MAP))
  const ignored = made(checkout({ ...ROOT_MAP, '.gitignore': '/research/\n' }))

  assert.equal(inGit(kept, kept.main, 'research', 'new', NAME).stdout, 'research/gateway-limits/index.md\ngit: this map is kept in git, and research/gateway-limits/ goes into it with every source it saves\n')
  assert.equal(inGit(ignored, ignored.main, 'research', 'new', NAME).stdout, 'research/gateway-limits/index.md\ngit: this map is kept in git, which ignores research/gateway-limits/, so this research stays on this machine\n')
})

test('with --json a new research gives the place of its fact sheet and whether git keeps it, ignores it or does not hold the map', () => {
  const kept = made(checkout(ROOT_MAP))
  const ignored = made(checkout({ ...ROOT_MAP, '.gitignore': '/research/\n' }))
  const untracked = made(solo())
  const noGit = tree(acme())
  const answer = (result: { stdout: string }) => JSON.parse(result.stdout) as unknown

  assert.equal(inGit(kept, kept.main, 'research', 'new', NAME, '--json').stdout, '{\n  "sheet": "research/gateway-limits/index.md",\n  "git": "kept"\n}\n')
  assert.deepEqual(answer(inGit(ignored, ignored.main, 'research', 'new', NAME, '--json')), { sheet: 'research/gateway-limits/index.md', git: 'ignored' })
  assert.deepEqual(answer(inGit(untracked, untracked.main, 'research', 'new', NAME, '--json')), { sheet: 'research/gateway-limits/index.md', git: null })
  assert.deepEqual(answer(research(noGit, 'new', NAME, '--json')), { sheet: 'research/gateway-limits/index.md', git: null })
  assert.deepEqual(answer(run(['research', 'new', 'second', '--json'], { cwd: kept.main, env: { ...kept.env, PATH: '' } })), { sheet: 'research/second/index.md', git: null })
})

test('resolve answers the name of a research with its fact sheet, its pages, its brief, its log, its reading and its set-aside list, and counts its saved sources', () => {
  const root = tree(acme())
  research(root, 'new', NAME, '--title', TITLE)
  writeFileSync(join(root, 'research', NAME, 'facts-retries.md'), '# Retries\n')
  writeFileSync(join(root, 'research', NAME, 'sources', SOURCE), SOURCE_TEXT)

  const result = run(['resolve', NAME], { cwd: root })

  assert.deepEqual(result, {
    code: 0,
    stderr: '',
    stdout: [
      'Context for research gateway-limits:',
      '- research/gateway-limits/index.md (1.1 KB) fact sheet: the facts that stand, each with its sources',
      `- research/gateway-limits/facts-retries.md (${sizeOf('# Retries\n')} B) facts of the research, a page by subject`,
      `- research/gateway-limits/brief.md (${sizeOf(BRIEF)} B) brief: the questions and where the run looked`,
      `- research/gateway-limits/log.md (${sizeOf(LOG)} B) log: one entry a round, and the facts that were superseded`,
      `- research/gateway-limits/reading.md (${sizeOf(READING)} B) reading: one person's judgement of the facts`,
      `- research/gateway-limits/set-aside.md (${sizeOf(SET_ASIDE)} B) set-aside list: what was judged beside the point`,
      `Deep tier: 1 file (${sizeOf(SOURCE_TEXT)} B) under research/gateway-limits/sources, not listed one by one.`,
      '',
    ].join('\n'),
  })
})

test('resolve gives a research as absolute paths with --absolute, and by research with --json', () => {
  const root = tree(acme())
  research(root, 'new', NAME, '--title', TITLE)

  const absolute = run(['resolve', NAME, '--absolute'], { cwd: root }).stdout.split('\n')
  const json = JSON.parse(run(['resolve', NAME, '--json'], { cwd: root }).stdout) as { by: unknown, key: unknown, item: unknown, name: unknown, label: unknown, pointers: { rel: unknown }[], more: unknown, deep: unknown }

  assert.equal(absolute[1], `- ${join(root, 'research/gateway-limits/index.md')} (1.1 KB) fact sheet: the facts that stand, each with its sources`)
  assert.deepEqual({ ...json, pointers: json.pointers.map(pointer => pointer.rel) }, {
    by: 'research',
    key: 'research:gateway-limits',
    item: null,
    name: 'gateway-limits',
    label: 'research gateway-limits',
    pointers: ['index.md', 'brief.md', 'log.md', 'reading.md', 'set-aside.md'].map(file => `research/gateway-limits/${file}`),
    more: 0,
    notes: null,
    deep: null,
    evidence: null,
  })
})

test('a work item of the same name as a research answers first, whether or not its name reads as a ticket', () => {
  const root = tree(acme({ 'work/portal-split/STATE.md': '---\nitem: portal-split\nstatus: active\n---\n# portal-split: Split the portal\n' }))
  research(root, 'new', 'PROJ-12')
  research(root, 'new', 'portal-split')

  assert.equal(run(['resolve', 'PROJ-12'], { cwd: root }).stdout.split('\n')[0], 'Context for work item PROJ-12:')
  assert.equal(run(['resolve', 'proj-12'], { cwd: root }).stdout.split('\n')[0], 'Context for work item PROJ-12:')
  assert.equal(run(['resolve', 'portal-split'], { cwd: root }).stdout.split('\n')[0], 'Context for work item portal-split:')
  assert.equal(run(['resolve', 'Portal-Split'], { cwd: root }).stdout.split('\n')[0], 'Context for work item portal-split:')
})

test("a research whose name holds the key of a work item's ticket, or is an item's title, still answers to its own name", () => {
  const root = tree(acme())

  for (const name of ['PROJ-12-limits', 'limits-PROJ-12', 'rate-limit-the-gateway']) {
    research(root, 'new', name)

    assert.equal(run(['resolve', name], { cwd: root }).stdout.split('\n')[0], `Context for research ${name}:`, name)
  }
  assert.equal(run(['resolve', 'PROJ-12', 'limits'], { cwd: root }).stdout.split('\n')[0], 'Context for work item PROJ-12:')
})

test('a research answers to its name in another letter case, and only when its name is the whole of what was asked', () => {
  const root = tree(acme())
  research(root, 'new', NAME, '--title', TITLE)

  assert.equal(run(['resolve', 'Gateway-Limits'], { cwd: root }).stdout.split('\n')[0], 'Context for research gateway-limits:')
  assert.equal(run(['resolve', 'the', NAME, 'research'], { cwd: root }).stdout, 'No confident match for "the gateway-limits research".\n')
  assert.equal(run(['resolve', 'limits', 'shop'], { cwd: root }).stdout, 'No confident match for "limits shop".\n')
})

test('where two researches differ only in the case of their letters, the one written as asked answers', TWO_LETTER_CASES, () => {
  const root = tree(acme())
  research(root, 'new', NAME)
  mkdirSync(join(root, 'research', 'Gateway-Limits'))
  writeFileSync(join(root, 'research', 'Gateway-Limits', 'index.md'), '---\nresearch: Gateway-Limits\n---\n# By hand\n')

  assert.equal(run(['resolve', 'Gateway-Limits'], { cwd: root }).stdout.split('\n')[0], 'Context for research Gateway-Limits:')
  assert.equal(run(['resolve', NAME], { cwd: root }).stdout.split('\n')[0], 'Context for research gateway-limits:')
})

test("a folder of the estate's own under research's name is no research: resolve does not answer to it, and a research of its name is refused", () => {
  const root = tree(acme({
    'research/market/index.md': '# Market research\n\nNo head, so no research.\n',
    'research/market/notes.md': '# Notes\n',
    'research/pricing/index.md': '---\ntitle: Pricing\n---\n# Pricing\n',
    'research/index.md': '---\nresearch: loose\n---\n# A sheet in no folder\n',
  }))

  for (const name of ['market', 'pricing', 'loose', 'research']) assert.equal(run(['resolve', name], { cwd: root }).stdout, `No confident match for "${name}".\n`, name)
  assert.equal(research(root, 'new', 'market').stderr, 'context-central research: research/market is there already\n')
  assert.equal(read(root, 'research/market/index.md'), '# Market research\n\nNo head, so no research.\n')
})

test("a research in a folder that is not the plugin's to use does not answer to its name", () => {
  const files = { 'web/research/gateway-limits/index.md': SHEET, 'scratch/research/gateway-limits/index.md': SHEET }

  for (const researchDir of ['web/research', 'scratch/research']) {
    const root = tree(acme(files, { researchDir }))

    assert.equal(run(['resolve', NAME], { cwd: root }).stdout, 'No confident match for "gateway-limits".\n', researchDir)
  }
})

test('the hook at a prompt says nothing of a research, by its name or by the words of its title', () => {
  const root = tree(acme())
  research(root, 'new', NAME, '--title', TITLE)
  const state = tree(makeTree({}))

  for (const prompt of [NAME, 'how the gateway limits a shop', `open ${NAME}`]) {
    assert.deepEqual(hook('user-prompt-submit', { session_id: 's1', cwd: root, prompt }, { env: { CONTEXT_CENTRAL_STATE_DIR: state } }), { code: 0, stdout: '', stderr: '' }, prompt)
  }
  assert.equal(run(['resolve', NAME], { cwd: root }).stdout.split('\n')[0], 'Context for research gateway-limits:')
})

test("in a git work tree a file of a research is drafted under the work tree, as a copy of the map's file, and a source the map does not hold yet is taken into it", () => {
  const one = made(solo())
  inGit(one, one.main, 'research', 'new', NAME, '--title', TITLE)
  const inside = workTree(one, join(one.main, '.claude', 'worktrees', 'limit'))
  const drafts = join(inside, '.context-central', 'research', NAME)

  const sheet = inGit(one, inside, 'draft', 'research/gateway-limits/index.md')
  const source = inGit(one, inside, 'draft', `research/gateway-limits/sources/${SOURCE}`)

  assert.deepEqual(sheet, { code: 0, stdout: `${join(drafts, 'index.md')}\n`, stderr: '' })
  assert.equal(read(drafts, 'index.md'), SHEET)
  assert.deepEqual(source, { code: 0, stdout: `${join(drafts, 'sources', SOURCE)}\n`, stderr: '' })
  assert.equal(existsSync(join(drafts, 'sources', SOURCE)), false)
  writeFileSync(join(drafts, 'sources', SOURCE), SOURCE_TEXT)
  assert.deepEqual(inGit(one, inside, 'take'), { code: 0, stdout: `took research/gateway-limits/sources/${SOURCE}\n`, stderr: '' })
  assert.equal(read(one.main, '.context-central', 'research', NAME, 'sources', SOURCE), SOURCE_TEXT)
})

test("draft names research's folder among the folders of the map, under the name the estate gives it, and prints a file of a research that is not made yet", () => {
  const plain = tree(acme())
  const renamed = tree(acme({}, { researchDir: 'findings' }))
  const folders = 'repos, areas, concepts, edges, decisions, docs, standards, log, work'

  assert.deepEqual(run(['draft', 'research/later/index.md'], { cwd: plain }), { code: 0, stdout: `${join(plain, 'research', 'later', 'index.md')}\n`, stderr: '' })
  assert.deepEqual(run(['draft', 'findings/later/index.md'], { cwd: renamed }), { code: 0, stdout: `${join(renamed, 'findings', 'later', 'index.md')}\n`, stderr: '' })
  assert.deepEqual(run(['draft', 'elsewhere/x.md'], { cwd: plain }), { code: 2, stdout: '', stderr: `context-central draft: elsewhere/x.md is not a file of the map: expected estate.json, glossary.md or a path under one of: ${folders}, research\n` })
  assert.deepEqual(run(['draft', 'research/later/index.md'], { cwd: renamed }), { code: 2, stdout: '', stderr: `context-central draft: research/later/index.md is not a file of the map: expected estate.json, glossary.md or a path under one of: ${folders}, findings\n` })
})

test("draft refuses a file under research's folder where that folder is another repo's, a file, or left alone", () => {
  const folders = 'repos, areas, concepts, edges, decisions, docs, standards, log, work'
  const taken: [Named, TreeFiles][] = [
    [{ researchDir: 'web/research' }, {}],
    [{ researchDir: 'scratch/research' }, {}],
    [{ researchDir: 'research', notNodes: ['research'] }, {}],
    [{ researchDir: 'findings' }, { findings: 'a file\n' }],
  ]

  for (const [settings, files] of taken) {
    const root = tree(acme(files, settings))
    const asked = `${settings.researchDir}/gateway-limits/index.md`

    assert.deepEqual(run(['draft', asked], { cwd: root }), { code: 2, stdout: '', stderr: `context-central draft: ${asked} is not a file of the map: expected estate.json, glossary.md or a path under one of: ${folders}\n` }, asked)
  }
})

test("a note is not started in research's folder, which is no kind of note even where the estate lists it among its kinds of folder", () => {
  const plain = tree(acme())
  const listed = tree(acme({}, { nodeDirs: ['repos', 'concepts', 'research', 'work'] }))

  assert.deepEqual(run(['note', '--new', 'research/gateway-limits'], { cwd: plain }), { code: 2, stdout: '', stderr: 'context-central note: expected --new <kind>/<name>, where the kind is one of: repos, areas, concepts, edges, decisions, docs, standards\n' })
  assert.deepEqual(run(['note', '--new', 'research/gateway-limits'], { cwd: listed }), { code: 2, stdout: '', stderr: 'context-central note: expected --new <kind>/<name>, where the kind is one of: repos, concepts\n' })
  assert.equal(existsSync(join(listed, 'research')), false)
})

test("in the root layout a research is the map's own, so one that is not committed keeps no run of a check from proving its commit", () => {
  const one = made(checkout({ ...ROOT_MAP, 'estate.json': { contextCentral: 1, name: 'solo', repos: [{ name: 'solo', path: '.', checks: ['./check.sh'] }] }, 'work/PROJ-12/STATE.md': '---\nitem: PROJ-12\nstatus: active\n---\n# PROJ-12\n' }))
  const dirty = () => read(one.main, 'work/PROJ-12/proof.jsonl').trimEnd().split('\n').map(line => (JSON.parse(line) as { dirty: unknown }).dirty)

  inGit(one, one.main, 'research', 'new', NAME)
  inGit(one, one.main, 'proof', 'PROJ-12', '--check', './check.sh', '--exit', '0')
  writeFileSync(join(one.main, 'src', 'app.js'), 'export default 1\n')
  inGit(one, one.main, 'proof', 'PROJ-12', '--check', './check.sh', '--exit', '0')

  assert.match(git(one, one.main, 'status', '--porcelain').stdout, /^\?\? research\/$/m)
  assert.deepEqual(dirty(), [false, true])
})

test('a research just made is opened as one with no fact, no source and no round, with the day and the two days on from it', () => {
  const root = tree(acme())
  research(root, 'new', NAME, '--title', TITLE)

  const result = open(root, NAME)

  assert.deepEqual(result, {
    code: 0,
    stderr: '',
    stdout: ['research gateway-limits: How the gateway limits a shop', 'facts: none; the next is F1', 'sources: none saved; the next is 01', 'rounds: none', 'check again by: no date on the sheet', 'sheet: 1.1 KB of 16 KB', DATES, ''].join('\n'),
  })
})

test('a research is opened with its item, its facts and the next number, its saved sources and the next, its last round and what stopped it, its date and the size of its sheet', () => {
  const root = withFull()

  const result = open(root, NAME)

  assert.deepEqual(result, {
    code: 0,
    stderr: '',
    stdout: [
      'research gateway-limits: How the gateway limits a shop',
      'item: PROJ-12',
      'facts: 3 stand, 1 superseded; the next is F10',
      'sources: 2 saved; the next is 05',
      'rounds: 2, the last on 2026-01-14, stopped: a round added no fact and no lead',
      'check again by: 2026-02-13, 29 days off',
      `sheet: ${sizeOf(FULL_SHEET)} B of 16 KB`,
      DATES,
      '',
    ].join('\n'),
  })
})

test('with --json a research is opened as one object with the same nine things', () => {
  const root = withFull()

  const result = open(root, NAME, '--json')

  assert.equal(result.code, 0)
  assert.deepEqual(JSON.parse(result.stdout), {
    name: 'gateway-limits',
    title: 'How the gateway limits a shop',
    item: 'PROJ-12',
    facts: { stand: 3, superseded: 1, next: 'F10' },
    sources: { saved: 2, next: '05' },
    rounds: { last: 2, day: '2026-01-14', stopped: 'a round added no fact and no lead' },
    checkAgain: { day: '2026-02-13', daysOff: 29 },
    sheet: { bytes: sizeOf(FULL_SHEET), limit: 16000, pages: 0 },
    dates: { today: '2026-01-15', stable: { days: 30, day: '2026-02-14' }, moving: { days: 7, day: '2026-01-22' } },
  })
  assert.deepEqual(JSON.parse(open(tree(acme({ 'research/gateway-limits/index.md': '---\nresearch: gateway-limits\n---\n# Limits\n' })), NAME, '--json').stdout), {
    name: 'gateway-limits',
    title: 'Limits',
    item: null,
    facts: { stand: 0, superseded: 0, next: 'F1' },
    sources: { saved: 0, next: '01' },
    rounds: { last: 0, day: null, stopped: null },
    checkAgain: null,
    sheet: { bytes: 42, limit: 16000, pages: 0 },
    dates: { today: '2026-01-15', stable: { days: 30, day: '2026-02-14' }, moving: { days: 7, day: '2026-01-22' } },
  })
})

test('a run that was cut off is known by a last round with no line for what stopped it', () => {
  const cutOff = withFull({ 'research/gateway-limits/log.md': `${FULL_LOG}\n## Round 3, 2026-01-15\n\n- Answered: Q2 by F9\n- Open: Q3\n` })
  const onlyOne = tree(acme({ 'research/gateway-limits/index.md': FULL_SHEET, 'research/gateway-limits/log.md': '# The log\n\n## Round 1, 2026-01-15\n\n- Open: Q1\n' }))

  const nested = tree(acme({ 'research/gateway-limits/index.md': FULL_SHEET, 'research/gateway-limits/log.md': '# The log\n\n## Round 1, 2026-01-15\n\n- Gaps: the mail of the two shops\n  - Stopped: said of the search, under the gap it met\n' }))

  assert.equal(opened(cutOff, 'rounds'), 'rounds: 3, the last on 2026-01-15, not stopped')
  assert.equal(opened(onlyOne, 'rounds'), 'rounds: 1, the last on 2026-01-15, not stopped')
  assert.equal(opened(nested, 'rounds'), 'rounds: 1, the last on 2026-01-15, not stopped')
})

test('a round is an entry of the log that opens with its number and its date, and one shown in a fenced block or written another way is none', () => {
  const log = ['# The log', '', '## Round 4, 2026-01-12', '', '- Stopped: at the cap of its depth', '', '```', '## Round 9, 2026-01-14', '- Stopped: shown as an example', '```', '', '## Round five, 2026-01-14', '## Round 6', '### Round 7, 2026-01-14', '  - Stopped: nested under nothing', ''].join('\n')
  const root = withFull({ 'research/gateway-limits/log.md': log })

  assert.equal(opened(root, 'rounds'), 'rounds: 4, the last on 2026-01-12, stopped: at the cap of its depth')
  assert.equal(opened(root, 'facts'), 'facts: 3 stand, none superseded; the next is F10')
})

test('the date to check again by is said as days off, as today, or as passed so many days ago', () => {
  const said = (...below: string[]) => opened(withSheet('## Check again by', '', ...below), 'check again by')

  assert.equal(said('2026-01-08'), 'check again by: 2026-01-08, passed 7 days ago')
  assert.equal(said('2026-01-14'), 'check again by: 2026-01-14, passed 1 day ago')
  assert.equal(said('2026-01-15'), 'check again by: 2026-01-15, today')
  assert.equal(said('2026-01-16'), 'check again by: 2026-01-16, 1 day off')
  assert.equal(said('By 2027-01-15, a year on.', '', '2026-01-16'), 'check again by: 2027-01-15, 365 days off')
})

test('a sheet with no date under its heading for it, or with one that is no day of the calendar, has no date', () => {
  const none = 'check again by: no date on the sheet'

  assert.equal(opened(withSheet('## Check again by', '', '## Not reached', '', '2026-02-13'), 'check again by'), none)
  assert.equal(opened(withSheet('## Questions', '', '- Asked on 2026-01-10.'), 'check again by'), none)
  assert.equal(opened(tree(acme({ 'research/gateway-limits/index.md': '---\nresearch: gateway-limits\nmade: 2026-01-10\n---\n# Limits\n' })), 'check again by'), none)
  assert.equal(opened(withSheet('## Check again by', '', '2026-02-30'), 'check again by'), none)
  assert.equal(opened(withSheet('## Check again by', '', '2026-13-01'), 'check again by'), none)
  assert.equal(opened(withSheet('```', '## Check again by', '', '2026-02-13', '```'), 'check again by'), none)
})

test('a sheet past the size for one is said to be past it, with its pages counted where it has some', () => {
  const pages = { 'research/gateway-limits/facts-retries.md': '# Retries\n\n- **F12** `verified` A retry waits one second.\n  - Source: https://example.com/pr/90\n', 'research/gateway-limits/facts-limits.md': '# Limits\n' }
  const sized = (bytes: number, more: TreeFiles = {}) => opened(withFull(more, { budgets: { researchSheetBytes: bytes } }), 'sheet')
  const size = sizeOf(FULL_SHEET)

  assert.equal(sized(size - 1), `sheet: ${size} B, past ${size - 1} B: its facts go to pages by subject`)
  assert.equal(sized(size), `sheet: ${size} B of ${size} B`)
  assert.equal(sized(size - 1, pages), `sheet: ${size} B, past ${size - 1} B: its facts go to its 2 pages by subject`)
  assert.equal(sized(size, pages), `sheet: ${size} B of ${size} B, and 2 pages by subject`)
  assert.equal(opened(withFull(pages), 'facts'), 'facts: 4 stand, 1 superseded; the next is F13')
})

test('the next number of a fact is one more than the highest on the sheet, on its pages and in the log', () => {
  const root = tree(acme({
    'research/gateway-limits/index.md': '---\nresearch: gateway-limits\n---\n# Limits\n\n- **F2** `inferred` One.\n  - From: F1\n  - Supersedes F14, 2026-01-14: read again.\n',
    'research/gateway-limits/facts-retries.md': '# Retries\n\n- **F9** `inferred` Two.\n  - From: F2\n',
    'research/gateway-limits/log.md': '# The log\n\n- **F14** `inferred` Three.\n  - From: F2\n',
  }))

  assert.equal(opened(root, 'facts'), 'facts: 2 stand, 1 superseded; the next is F15')
  assert.equal(opened(withSheet('- **F7** `inferred` One alone.', '  - From: the brief'), 'facts'), 'facts: 1 stands, none superseded; the next is F8')
})

test('the next number of a source is one more than the highest that opens a name with two or three digits, so the hundredth source is 100', () => {
  const next = (...names: string[]) => opened(tree(acme({ 'research/gateway-limits/index.md': FULL_SHEET, ...Object.fromEntries(names.map(name => [`research/gateway-limits/sources/${name}`, '# Saved\n'])) })), 'sources')

  assert.equal(next('99-2026-01-14-chat-retries-full-text.md'), 'sources: 1 saved; the next is 100')
  assert.equal(next('100-2026-01-14-chat-retries-full-text.md', '02-2026-01-14-mail-full-text.md'), 'sources: 2 saved; the next is 101')
  assert.equal(next('2026-01-09-notes.md', '7-chat.md', '1000-chat.md', '03chat.md'), 'sources: 4 saved; the next is 01')
  assert.equal(next('08-2026-01-14-chat-full-text.md', '12-2026-01-14-export.csv'), 'sources: 1 saved; the next is 13')
})

test('a research whose sources reach 999 is not opened, since no number is left for the next', () => {
  const root = tree(acme({ 'research/gateway-limits/index.md': FULL_SHEET, 'research/gateway-limits/sources/999-2026-01-14-chat-full-text.md': '# Saved\n' }))

  assert.deepEqual(open(root, NAME), { code: 1, stdout: '', stderr: 'context-central research: research/gateway-limits/sources holds 999 numbered sources, and no number is left\n' })
})

test("the two days on are counted from the estate's own numbers where it sets them, and across the end of a year", () => {
  const root = withFull({}, { budgets: { researchStableDays: 14, researchMovingDays: 3 } })
  const plain = withFull()
  const at = (cwd: string, now: string) => run(['research', 'open', NAME], { cwd, env: { TZ: 'UTC', CONTEXT_CENTRAL_NOW: now } }).stdout.trimEnd().split('\n').at(-1)

  assert.equal(at(root, '2026-01-15T12:00:00Z'), 'dates: today is 2026-01-15, 14 days on is 2026-01-29, 3 days on is 2026-01-18')
  assert.equal(at(plain, '2026-12-28T23:30:00Z'), 'dates: today is 2026-12-28, 30 days on is 2027-01-27, 7 days on is 2027-01-04')
  assert.equal(run(['config', '--get', 'budgets.researchSheetBytes'], { cwd: plain }).stdout, '16000\n')
  assert.equal(run(['config', '--get', 'budgets.researchStableDays'], { cwd: plain }).stdout, '30\n')
  assert.equal(run(['config', '--get', 'budgets.researchMovingDays'], { cwd: plain }).stdout, '7\n')
})

test('a research that is not there is not opened, and the line names the researches the map holds, or says it holds none', () => {
  const two = withFull({ 'research/retries/index.md': '---\nresearch: retries\n---\n# Retries\n', 'research/market/index.md': '# No head\n' })
  const none = tree(acme({ 'research/market/index.md': '# No head\n' }))

  assert.deepEqual(open(two, 'nope'), { code: 1, stdout: '', stderr: 'context-central research: no research "nope" in this map. Its researches: gateway-limits, retries.\n' })
  assert.deepEqual(open(none, 'market'), { code: 1, stdout: '', stderr: 'context-central research: no research "market" in this map. It holds none.\n' })
  assert.deepEqual(open(tree(acme()), 'nope'), { code: 1, stdout: '', stderr: 'context-central research: no research "nope" in this map. It holds none.\n' })
})

test("a research is not opened where research's folder is not the plugin's to use, and the line gives the reason", () => {
  const root = tree(acme({ 'scratch/research/gateway-limits/index.md': FULL_SHEET }, { researchDir: 'scratch/research' }))

  assert.deepEqual(open(root, NAME), { code: 1, stdout: '', stderr: `context-central research: scratch/research is under a leftAlone entry, so it holds no research: ${NOWHERE_ELSE}\n` })
})

test('a research is opened by its name in another letter case, and with no name or a flag that goes with another action it is wrong usage', () => {
  const root = withFull()

  assert.equal(open(root, 'Gateway-Limits').stdout.split('\n')[0], 'research gateway-limits: How the gateway limits a shop')
  assert.deepEqual(open(root), { code: 2, stdout: '', stderr: `context-central research: ${USAGE}\n` })
  assert.deepEqual(open(root, NAME, 'more'), { code: 2, stdout: '', stderr: `context-central research: ${USAGE}\n` })
  assert.deepEqual(open(root, NAME, '--title', 'x'), { code: 2, stdout: '', stderr: 'context-central research: --title does not go with open\n' })
  assert.deepEqual(open(root, NAME, '--item', 'PROJ-12'), { code: 2, stdout: '', stderr: 'context-central research: --item does not go with open\n' })
  assert.match(open(tree(makeTree({ 'readme.txt': 'x\n' })), NAME).stderr, /^context-central research: no context map found/)
})

test("a research named as the key of a work item's ticket gives way to that item, where the item has another name, on a map with no connection and on one whose tickets a connection reads", () => {
  const state = (ticket: string) => `---\nitem: rate-limit\ntitle: Rate limit the gateway\nstatus: active\nticket: "${ticket}"\n---\n# rate-limit: Rate limit the gateway\n`
  const plain = tree(makeTree({ 'estate.json': { contextCentral: 1, name: 'solo', connections: {} }, 'CLAUDE.md': '# Solo\n', 'work/rate-limit/STATE.md': state('PROJ-12') }))
  const read = tree(acme({ 'work/rate-limit/STATE.md': state('https://tracker.acme.example/browse/PROJ-77') }))

  for (const [root, key] of [[plain, 'PROJ-12'], [read, 'PROJ-77']]) {
    assert.equal(run(['resolve', key], { cwd: root }).stdout.split('\n')[0], 'Context for work item rate-limit:', `${key} before`)
    research(root, 'new', key)
    research(root, 'new', `${key}-limits`)

    assert.equal(run(['resolve', key], { cwd: root }).stdout.split('\n')[0], 'Context for work item rate-limit:', key)
    assert.equal(run(['resolve', key.toLowerCase()], { cwd: root }).stdout.split('\n')[0], 'Context for work item rate-limit:', key.toLowerCase())
    assert.equal(run(['resolve', `${key}-limits`], { cwd: root }).stdout.split('\n')[0], `Context for research ${key}-limits:`, `${key}-limits`)
    assert.equal(open(root, key).stdout.split('\n')[0], `research ${key}: ${key}`)
  }
})

test('a research named as a ticket that no work item has answers to its name, and so does one named as a work item that has no entry file', () => {
  const root = tree(acme({ 'work/PROJ-40/notes/loose.md': '# Loose\n' }))
  research(root, 'new', 'PROJ-13')
  research(root, 'new', 'PROJ-40')

  assert.equal(run(['resolve', 'PROJ-13'], { cwd: root }).stdout.split('\n')[0], 'Context for research PROJ-13:')
  assert.equal(run(['resolve', 'PROJ-40'], { cwd: root }).stdout.split('\n')[0], 'Context for research PROJ-40:')
})

test('a research named in digits alone answers to its name, and a number that names nothing still resolves to nothing', () => {
  const root = tree(acme())
  research(root, 'new', '123')

  assert.equal(run(['resolve', '123'], { cwd: root }).stdout.split('\n')[0], 'Context for research 123:')
  assert.equal(run(['resolve', '124'], { cwd: root }).stdout, 'No confident match for "124".\n')
  assert.deepEqual(hook('user-prompt-submit', { session_id: 's1', cwd: root, prompt: '123' }, { env: { CONTEXT_CENTRAL_STATE_DIR: tree(makeTree({})) } }), { code: 0, stdout: '', stderr: '' })
})

test("in the root layout the folders of the researches are the map's own and nothing else under research's folder is, so code a repository keeps there still counts as a change", () => {
  const one = made(checkout({ ...ROOT_MAP, 'estate.json': { contextCentral: 1, name: 'solo', repos: [{ name: 'solo', path: '.', checks: ['./check.sh'] }] }, 'research/model.py': 'x = 1\n', 'work/PROJ-12/STATE.md': '---\nitem: PROJ-12\nstatus: active\n---\n# PROJ-12\n' }))
  const dirty = () => read(one.main, 'work/PROJ-12/proof.jsonl').trimEnd().split('\n').map(line => (JSON.parse(line) as { dirty: unknown }).dirty)
  const prove = () => inGit(one, one.main, 'proof', 'PROJ-12', '--check', './check.sh', '--exit', '0')

  inGit(one, one.main, 'research', 'new', NAME)
  prove()
  writeFileSync(join(one.main, 'research', 'model.py'), 'x = 2\n')
  prove()
  git(one, one.main, 'checkout', '-q', '--', 'research/model.py')
  writeFileSync(join(one.main, 'research', 'scratch.txt'), 'kept beside the researches\n')
  prove()

  assert.deepEqual(dirty(), [false, true, true])
})

test('a research does not take a name the map reads as something else: a folder of the deep tier, the evidence folder or one the map never lists', () => {
  const root = tree(acme())
  const own = tree(acme({}, { deepDirs: ['sources', 'raw'] }))
  const kept = (name: string, names: string) => ({ code: 1, stdout: '', stderr: `context-central research: ${name} is a name the map keeps for something else, so no research takes it: ${names}\n` })

  for (const name of ['sources', 'Sources', 'evidence', 'EVIDENCE', 'node_modules']) {
    assert.deepEqual(research(root, 'new', name), kept(name, 'sources, evidence, node_modules'), name)
  }
  assert.deepEqual(research(own, 'new', 'raw'), kept('raw', 'sources, raw, evidence, node_modules'))
  assert.equal(research(root, 'new', 'raw').code, 0)
  assert.equal(research(root, 'new', 'sources-of-truth').code, 0)
  assert.deepEqual(readdirSync(join(root, 'research')).sort(), ['raw', 'sources-of-truth'])
  assert.equal(existsSync(join(own, 'research')), false)
})

test('a title that holds a line break is wrong usage, so no line of it is written into the head of the fact sheet', () => {
  const root = tree(acme())

  for (const title of ['Limits\nitem: PROJ-99', 'Limits\r\nitem: PROJ-99', 'Limits\ritem: PROJ-99', 'Limits item: PROJ-99', '\n']) {
    assert.deepEqual(research(root, 'new', NAME, '--title', title), { code: 2, stdout: '', stderr: 'context-central research: a title is one line\n' }, JSON.stringify(title))
  }
  assert.equal(existsSync(join(root, 'research')), false)
  assert.equal(research(root, 'new', NAME, '--title', 'Limits: what a shop gets, and why').code, 0)
  assert.ok(read(root, 'research', NAME, 'index.md').startsWith('---\nresearch: gateway-limits\ntitle: Limits: what a shop gets, and why\n---\n'))
})

test("a note is not started inside research's folder where that folder lies below a kind of note, and one beside it still is", () => {
  const root = tree(acme({}, { researchDir: 'docs/research' }))
  const refused = { code: 2, stdout: '', stderr: 'context-central note: docs/research is kept for researches, which research new makes: expected --new <kind>/<name>, where the kind is one of: repos, areas, concepts, edges, decisions, docs, standards\n' }

  assert.deepEqual(run(['note', '--new', 'docs/research/loose'], { cwd: root }), refused)
  assert.deepEqual(run(['note', '--new', 'docs/research/gateway-limits/extra'], { cwd: root }), refused)
  assert.equal(existsSync(join(root, 'docs')), false)
  assert.deepEqual(run(['note', '--new', 'docs/researcher/loose'], { cwd: root }), { code: 0, stdout: 'docs/researcher/loose.md\n', stderr: '' })
  assert.deepEqual(run(['note', '--new', 'docs/research'], { cwd: root }), { code: 0, stdout: 'docs/research.md\n', stderr: '' })
})

test("where research's folder cannot be reached, lint names it as it names any entry it cannot read, and graph, resolve, draft and research say what they say of a map with no research", BY_MODE, () => {
  const below = tree(acme({ 'notes/research/alpha/index.md': SHEET.replace('gateway-limits', 'alpha') }, { researchDir: 'notes/research' }))
  const itself = tree(acme({ 'research/alpha/index.md': SHEET.replace('gateway-limits', 'alpha') }))
  const closed: [string, string, string][] = [[below, 'notes', 'notes/research'], [itself, 'research', 'research']]

  for (const [root, folder, researchDir] of closed) {
    chmodSync(join(root, folder), 0o000)
    const said = {
      lint: run(['lint'], { cwd: root }),
      graph: run(['graph'], { cwd: root }),
      resolve: run(['resolve', 'PROJ-12'], { cwd: root }),
      draft: run(['draft', 'concepts/gateway.md'], { cwd: root }),
      open: open(root, 'alpha'),
      made: research(root, 'new', 'beta'),
    }
    chmodSync(join(root, folder), 0o755)

    assert.deepEqual(said.lint, { code: 1, stdout: `ERROR read: ${researchDir} cannot be read (EACCES), so the listings pass over it\n`, stderr: '' }, researchDir)
    assert.deepEqual(said.graph, { code: 0, stdout: '7 nodes, 5 links\nORPHAN repos/web.md\nUNREFERENCED work/PROJ-12/sources/01-2026-01-09-PROJ-12-full-text.md\n', stderr: '' }, researchDir)
    assert.equal(said.resolve.stdout.split('\n')[0], 'Context for work item PROJ-12:', researchDir)
    assert.deepEqual(said.draft, { code: 0, stdout: `${join(root, 'concepts', 'gateway.md')}\n`, stderr: '' }, researchDir)
    assert.deepEqual(said.open, { code: 1, stdout: '', stderr: 'context-central research: no research "alpha" in this map. It holds none.\n' }, researchDir)
    assert.deepEqual(said.made, { code: 1, stdout: '', stderr: `context-central research: ${researchDir}/beta could not be made (EACCES)\n` }, researchDir)
  }
})
