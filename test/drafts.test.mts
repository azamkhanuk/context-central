import assert from 'node:assert/strict'
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { ACME_CONFIG, ACME_FILES, NEEDS_STAND_IN, SOLO_CONFIG, SOLO_FILES, SOLO_STATE, checkout, disposable, git, makeTree, notOnWindows, run, solo, spawned, standIns, together, workTree } from './helpers.mts'
import type { Checkout } from './helpers.mts'

const tree = disposable()

const MAP = '.context-central'
const NODE_FOLDERS = 'repos, areas, concepts, edges, decisions, docs, standards, log, work'

function estate() {
  const made = solo()
  tree(made.base)
  return { ...made, inside: workTree(made, join(made.main, '.claude', 'worktrees', 'limit')) }
}

const draft = (made: Checkout, cwd: string, ...paths: string[]) => run(['draft', ...paths], { cwd, env: made.env })

test("in the main checkout draft prints the map's own file and writes nothing", () => {
  const made = estate()

  const result = draft(made, made.main, SOLO_STATE)

  assert.equal(result.stdout, `${join(made.main, MAP, SOLO_STATE)}\n`)
  assert.equal(existsSync(join(made.main, MAP, '.drafted.json')), false)
})

test("in a work tree draft prints a file under the work tree, and the map's file is copied there", () => {
  const made = estate()

  const result = draft(made, made.inside, SOLO_STATE)

  assert.equal(result.stdout, `${join(made.inside, MAP, SOLO_STATE)}\n`)
  assert.equal(readFileSync(join(made.inside, MAP, SOLO_STATE), 'utf8'), SOLO_FILES[`${MAP}/${SOLO_STATE}`])
})

test('draft of a file the map does not hold prints its place under the work tree and writes no file', () => {
  const made = estate()

  const result = draft(made, made.inside, 'work/PROJ-12/SPEC.md')

  assert.equal(result.stdout, `${join(made.inside, MAP, 'work', 'PROJ-12', 'SPEC.md')}\n`)
  assert.equal(existsSync(join(made.inside, MAP, 'work', 'PROJ-12', 'SPEC.md')), false)
})

test('draft takes an absolute path inside the map, and one inside the drafts folder', () => {
  const made = estate()
  const drafted = `${join(made.inside, MAP, SOLO_STATE)}\n`

  assert.equal(draft(made, made.inside, join(made.main, MAP, SOLO_STATE)).stdout, drafted)
  assert.equal(draft(made, made.inside, join(made.inside, MAP, SOLO_STATE)).stdout, drafted)
})

test('a file drafted a second time is left as the session wrote it', () => {
  const made = estate()
  draft(made, made.inside, SOLO_STATE)
  writeFileSync(join(made.inside, MAP, SOLO_STATE), '# PROJ-12, rewritten\n')

  draft(made, made.inside, SOLO_STATE)

  assert.equal(readFileSync(join(made.inside, MAP, SOLO_STATE), 'utf8'), '# PROJ-12, rewritten\n')
})

test('draft prints one file a line, in the order asked, for the settings, the glossary and a note', () => {
  const made = estate()

  const result = draft(made, made.inside, 'glossary.md', 'estate.json', 'concepts/gateway.md')

  assert.equal(result.stdout, ['glossary.md', 'estate.json', join('concepts', 'gateway.md')].map(rel => `${join(made.inside, MAP, rel)}\n`).join(''))
})

test('draft with no path is wrong usage', () => {
  const made = estate()

  const result = draft(made, made.inside)

  assert.equal(result.code, 2)
  assert.equal(result.stderr, 'context-central draft: expected a file of the map: draft <path>...\n')
})

test('draft refuses a path that is no file of the map, and then drafts none of those asked with it', () => {
  const made = estate()

  for (const odd of ['src/app.js', 'work/../../CLAUDE.md', join(made.main, 'CLAUDE.md'), 'bin/context-central', 'work/PROJ-12', 'work/', 'work/../estate.json', 'work/.hidden/x.md', 'repos/.x.md']) {
    const result = draft(made, made.inside, SOLO_STATE, odd)

    assert.equal(result.code, 2, odd)
    assert.equal(result.stderr, `context-central draft: ${odd} is not a file of the map: expected estate.json, glossary.md or a path under one of: ${NODE_FOLDERS}\n`, odd)
    assert.equal(result.stdout, '', odd)
    assert.equal(existsSync(join(made.inside, MAP)), false, odd)
  }
})

test("from a work tree of a repo in a root layout, draft prints the map's own file, which is outside the repository", () => {
  const made = checkout({ 'README.md': '# api checkout\n' }, 'api', { 'estate.json': ACME_CONFIG, 'CLAUDE.md': ACME_FILES['CLAUDE.md'], [SOLO_STATE]: ACME_FILES[SOLO_STATE] })
  tree(made.base)
  const inside = workTree(made, join(made.main, '.claude', 'worktrees', 'limit'))

  const result = draft(made, inside, SOLO_STATE)

  assert.equal(result.stdout, `${join(made.base, SOLO_STATE)}\n`)
  assert.equal(existsSync(join(inside, 'work')), false)
})

const take = (made: Checkout, cwd: string, ...args: string[]) => run(['take', ...args], { cwd, env: made.env })
const SPEC = 'work/PROJ-12/SPEC.md'

function write(root: string, rel: string, text: string) {
  mkdirSync(dirname(join(root, MAP, rel)), { recursive: true })
  writeFileSync(join(root, MAP, rel), text)
}

const read = (root: string, rel: string) => readFileSync(join(root, MAP, rel), 'utf8')
const kept = (rel: string, why: string) => `context-central take: kept ${rel}: ${why}\n`
const IN_THE_MAP = '.in-the-map'
const compare = (made: ReturnType<typeof estate>, rel: string) => `compare it with ${join(made.inside, MAP, IN_THE_MAP, rel)}, a copy of the map's file as it now is, then run context-central take --over ${rel}`

test('take puts a new draft into the map and removes it from the work tree', () => {
  const made = estate()
  write(made.inside, SPEC, '# Spec\n')

  const result = take(made, made.inside)

  assert.equal(result.stdout, `took ${SPEC}\n`)
  assert.equal(result.code, 0)
  assert.equal(read(made.main, SPEC), '# Spec\n')
  assert.equal(existsSync(join(made.inside, MAP)), false)
})

test("take puts a draft made from the map's file in its place", () => {
  const made = estate()
  draft(made, made.inside, SOLO_STATE)
  write(made.inside, SOLO_STATE, '# PROJ-12, built\n')

  const result = take(made, made.inside)

  assert.equal(result.stdout, `took ${SOLO_STATE}\n`)
  assert.equal(read(made.main, SOLO_STATE), '# PROJ-12, built\n')
  assert.equal(existsSync(join(made.inside, MAP)), false)
})

test("take keeps a draft when the map's file changed after it was drafted, and exits 1", () => {
  const made = estate()
  draft(made, made.inside, SOLO_STATE)
  write(made.main, SOLO_STATE, '# PROJ-12, as another session left it\n')
  write(made.inside, SOLO_STATE, '# PROJ-12, built\n')

  const result = take(made, made.inside)

  assert.equal(result.code, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, kept(SOLO_STATE, `the map's file changed after this was drafted; ${compare(made, SOLO_STATE)}`))
  assert.equal(read(made.main, SOLO_STATE), '# PROJ-12, as another session left it\n')
  assert.equal(read(made.inside, SOLO_STATE), '# PROJ-12, built\n')
})

test("take --over puts a kept draft over the map's file", () => {
  const made = estate()
  draft(made, made.inside, SOLO_STATE)
  write(made.main, SOLO_STATE, '# PROJ-12, as another session left it\n')
  write(made.inside, SOLO_STATE, '# PROJ-12, with both\n')
  take(made, made.inside)

  const result = take(made, made.inside, '--over', SOLO_STATE)

  assert.equal(result.stdout, `took ${SOLO_STATE}\n`)
  assert.equal(result.code, 0)
  assert.equal(read(made.main, SOLO_STATE), '# PROJ-12, with both\n')
})

function keptOne() {
  const made = estate()
  draft(made, made.inside, SOLO_STATE)
  write(made.main, SOLO_STATE, '# PROJ-12, as another session left it\n')
  write(made.inside, SOLO_STATE, '# PROJ-12, built\n')
  return made
}

test("take leaves a copy of the map's file as it now is for a draft it kept", () => {
  const made = keptOne()

  take(made, made.inside)

  assert.equal(read(made.inside, `${IN_THE_MAP}/${SOLO_STATE}`), '# PROJ-12, as another session left it\n')
})

test('the copy left for a kept draft goes once that draft is taken', () => {
  const made = keptOne()
  take(made, made.inside)

  take(made, made.inside, '--over', SOLO_STATE)

  assert.equal(existsSync(join(made.inside, MAP)), false)
})

test('the copy left for a kept draft goes at the next take where that draft is no longer there', () => {
  const made = keptOne()
  take(made, made.inside)
  rmSync(join(made.inside, MAP, SOLO_STATE))

  take(made, made.inside)

  assert.equal(existsSync(join(made.inside, MAP)), false)
})

test('take leaves the folder it was run from, where that is the folder of the copies left for kept drafts', () => {
  const made = keptOne()
  take(made, made.inside)

  const result = take(made, join(made.inside, MAP, IN_THE_MAP), '--over', SOLO_STATE)

  assert.equal(result.stdout, `took ${SOLO_STATE}\n`)
  assert.equal(existsSync(join(made.inside, MAP, IN_THE_MAP)), true)
})

test("take names the map's own file to compare with where no copy of it can be made in the work tree", notOnWindows('a folder on Windows is not closed to writing by its mode'), () => {
  const made = keptOne()
  chmodSync(join(made.inside, MAP), 0o555)

  const result = take(made, made.inside)
  chmodSync(join(made.inside, MAP), 0o755)

  assert.equal(result.stderr, kept(SOLO_STATE, `the map's file changed after this was drafted; compare it with ${join(made.main, MAP, SOLO_STATE)}, then run context-central take --over ${SOLO_STATE}`))
})

test('take keeps a file written at the drafts place when the map holds that file and no draft was made from it', () => {
  const made = estate()
  write(made.inside, SOLO_STATE, '# PROJ-12, written blind\n')

  const result = take(made, made.inside)

  assert.equal(result.code, 1)
  assert.equal(result.stderr, kept(SOLO_STATE, `the map holds this file and the draft was not made from it; ${compare(made, SOLO_STATE)}`))
  assert.equal(read(made.main, SOLO_STATE), SOLO_FILES[`${MAP}/${SOLO_STATE}`])
})

test("a draft that is the same as the map's file is dropped and nothing is said of it", () => {
  const made = estate()
  draft(made, made.inside, SOLO_STATE)

  const result = take(made, made.inside)

  assert.equal(result.stdout, 'Nothing waits to be taken.\n')
  assert.equal(result.code, 0)
  assert.equal(existsSync(join(made.inside, MAP)), false)
})

test('take keeps a file that is no file of the map, and takes the drafts beside it', () => {
  const made = estate()
  write(made.inside, 'notes.txt', 'loose\n')
  write(made.inside, SPEC, '# Spec\n')

  const result = take(made, made.inside)

  assert.equal(result.code, 1)
  assert.equal(result.stdout, `took ${SPEC}\n`)
  assert.equal(result.stderr, kept('notes.txt', 'not a file of the map'))
  assert.equal(existsSync(join(made.main, MAP, 'notes.txt')), false)
  assert.equal(read(made.inside, 'notes.txt'), 'loose\n')
})

test('take keeps a draft that a file stands in the way of', () => {
  const made = solo({ [`${MAP}/work/PROJ-13`]: 'a file where a folder would go\n' })
  tree(made.base)
  const inside = workTree(made, join(made.main, '.claude', 'worktrees', 'limit'))
  write(inside, 'work/PROJ-13/SPEC.md', '# Spec\n')

  const result = take(made, inside)

  assert.equal(result.code, 1)
  assert.equal(result.stderr, kept('work/PROJ-13/SPEC.md', 'work/PROJ-13 is a file, not a folder, so nothing can be written under it'))
})

test('take passes over a name that starts with a dot', () => {
  const made = estate()
  write(made.inside, '.DS_Store', 'x')
  write(made.inside, 'work/.cache/note.md', '# hidden\n')

  const result = take(made, made.inside)

  assert.equal(result.stdout, 'Nothing waits to be taken.\n')
  assert.equal(existsSync(join(made.main, MAP, '.DS_Store')), false)
  assert.equal(existsSync(join(made.main, MAP, 'work', '.cache')), false)
})

test('take says so where no draft waits, and a second take finds nothing', () => {
  const made = estate()
  write(made.inside, SPEC, '# Spec\n')

  assert.equal(take(made, made.inside).stdout, `took ${SPEC}\n`)
  assert.equal(take(made, made.inside).stdout, 'Nothing waits to be taken.\n')
})

test('in the main checkout take says that a file of the map is written in place', () => {
  const made = estate()

  const result = take(made, made.main)

  assert.equal(result.stdout, 'Nothing to take: here a file of the map is written in place.\n')
  assert.equal(result.code, 0)
})

test('take --over for a path no draft answers to is refused, and nothing is taken', () => {
  const made = estate()
  write(made.inside, SPEC, '# Spec\n')

  const result = take(made, made.inside, '--over', SOLO_STATE)

  assert.equal(result.code, 1)
  assert.equal(result.stderr, `context-central take: no draft of ${SOLO_STATE} waits here\n`)
  assert.equal(existsSync(join(made.main, MAP, SPEC)), false)
})

test('drafted settings are taken into the map once they read as settings', () => {
  const made = estate()
  draft(made, made.inside, 'estate.json')
  write(made.inside, 'estate.json', JSON.stringify({ ...SOLO_CONFIG, title: 'Solo estate' }))

  const result = take(made, made.inside)

  assert.equal(result.stdout, 'took estate.json\n')
  assert.equal(run(['config', '--get', 'title'], { cwd: made.main, env: made.env }).stdout, 'Solo estate\n')
})

test("take keeps drafted settings that do not read as settings, and the map's stay as they were", () => {
  const made = estate()
  draft(made, made.inside, 'estate.json')
  write(made.inside, 'estate.json', JSON.stringify({ contextCentral: 1 }))

  const unnamed = take(made, made.inside)
  write(made.inside, 'estate.json', '{ "contextCentral": 1,')
  const cut = take(made, made.inside)

  assert.equal(unnamed.code, 1)
  assert.equal(unnamed.stderr, kept('estate.json', '"name" must be a non-empty string'))
  assert.match(cut.stderr, /^context-central take: kept estate\.json: not valid JSON \(/)
  assert.equal(run(['config', '--get', 'name'], { cwd: made.main, env: made.env }).stdout, 'solo\n')
})

test('a whole copy of the map in the work tree is dropped by take, but for what is new in it', () => {
  const made = estate()
  cpSync(join(made.main, MAP), join(made.inside, MAP), { recursive: true })
  write(made.inside, SPEC, '# Spec\n')

  const result = take(made, made.inside)

  assert.equal(result.stdout, `took ${SPEC}\n`)
  assert.equal(result.stderr, '')
  assert.equal(existsSync(join(made.inside, MAP)), false)
})

test('a record of what was drafted that is not a JSON object reads as empty', () => {
  const made = estate()
  write(made.inside, SPEC, '# Spec\n')

  for (const record of ['null', '[1]', 'not json']) {
    write(made.inside, '.drafted.json', record)
    write(made.inside, SPEC, '# Spec\n')
    rmSync(join(made.main, MAP, SPEC), { force: true })

    assert.equal(take(made, made.inside).stdout, `took ${SPEC}\n`, record)
  }
})

test('draft says so when a file stands where the drafts folder would go', () => {
  const made = estate()
  writeFileSync(join(made.inside, MAP), 'not a folder\n')

  const result = draft(made, made.inside, SOLO_STATE)

  assert.equal(result.code, 1)
  assert.equal(result.stderr, `context-central draft: ${join(made.inside, MAP)} is a file, not a folder, so no draft can be made there\n`)
})

test('the work folder is a place for drafts where the settings keep it out of the node folders', () => {
  const made = solo({ [`${MAP}/estate.json`]: { ...SOLO_CONFIG, nodeDirs: ['repos'], workDir: 'items' }, [`${MAP}/items/PROJ-12/STATE.md`]: '# PROJ-12\n' })
  tree(made.base)
  const inside = workTree(made, join(made.main, '.claude', 'worktrees', 'limit'))

  assert.equal(draft(made, inside, 'items/PROJ-12/STATE.md').stdout, `${join(inside, MAP, 'items', 'PROJ-12', 'STATE.md')}\n`)
  assert.equal(draft(made, inside, 'concepts/gateway.md').stderr, 'context-central draft: concepts/gateway.md is not a file of the map: expected estate.json, glossary.md or a path under one of: repos, items\n')
})

test("a draft that was not edited is brought up to date when the map's file has changed, so it can be read", () => {
  const made = estate()
  draft(made, made.inside, SOLO_STATE)
  write(made.main, SOLO_STATE, '# PROJ-12, as another session left it\n')

  draft(made, made.inside, SOLO_STATE)
  write(made.inside, SOLO_STATE, '# PROJ-12, as another session left it, and built\n')

  assert.equal(take(made, made.inside).stdout, `took ${SOLO_STATE}\n`)
  assert.equal(read(made.main, SOLO_STATE), '# PROJ-12, as another session left it, and built\n')
})

test("take drops a draft that was never edited, though the map's file has changed since, and says nothing of it", () => {
  const made = estate()
  draft(made, made.inside, SOLO_STATE)
  write(made.main, SOLO_STATE, '# PROJ-12, as another session left it\n')

  const result = take(made, made.inside)

  assert.equal(result.stdout, 'Nothing waits to be taken.\n')
  assert.equal(result.code, 0)
  assert.equal(read(made.main, SOLO_STATE), '# PROJ-12, as another session left it\n')
  assert.equal(existsSync(join(made.inside, MAP)), false)
})

test('a path asked twice in one call is printed twice and drafted once', () => {
  const made = estate()

  const result = draft(made, made.inside, SOLO_STATE, SOLO_STATE)

  assert.equal(result.stdout, `${join(made.inside, MAP, SOLO_STATE)}\n`.repeat(2))
  assert.deepEqual(Object.keys(JSON.parse(read(made.inside, '.drafted.json')) as object), [SOLO_STATE])
})

test('take keeps a draft that is a file where the map holds a folder, and takes the rest', () => {
  const made = estate()
  write(made.inside, 'work/PROJ-12', 'a file where the map has a folder\n')
  write(made.inside, 'concepts/limits.md', '# Limits\n')

  const result = take(made, made.inside)

  assert.equal(result.code, 1)
  assert.equal(result.stdout, 'took concepts/limits.md\n')
  assert.equal(result.stderr, kept('work/PROJ-12', 'the map holds a folder at this path'))
})

test('take keeps a draft that cannot be written into the map, with what the system said, and takes the rest', notOnWindows('a folder on Windows is not closed to writing by its mode'), () => {
  const made = estate()
  draft(made, made.inside, SOLO_STATE)
  write(made.inside, SOLO_STATE, '# PROJ-12, built\n')
  write(made.inside, 'concepts/limits.md', '# Limits\n')
  chmodSync(join(made.main, MAP, SOLO_STATE), 0o444)
  chmodSync(join(made.main, MAP, 'work', 'PROJ-12'), 0o555)

  const result = take(made, made.inside)
  chmodSync(join(made.main, MAP, 'work', 'PROJ-12'), 0o755)

  assert.equal(result.code, 1)
  assert.equal(result.stdout, 'took concepts/limits.md\n')
  assert.match(result.stderr, /^context-central take: kept work\/PROJ-12\/STATE\.md: it could not be written into the map \(EACCES/)
  assert.equal(read(made.inside, SOLO_STATE), '# PROJ-12, built\n')
})

test('a record that names a draft which is not there does not keep the drafts folder', () => {
  const made = estate()
  write(made.inside, SPEC, '# Spec\n')
  write(made.inside, '.drafted.json', JSON.stringify({ 'work/gone.md': 'abc' }))

  take(made, made.inside)

  assert.equal(existsSync(join(made.inside, MAP)), false)
})

test('take leaves the folder it was run from, where that is inside the drafts folder', () => {
  const made = estate()
  write(made.inside, SPEC, '# Spec\n')

  const result = take(made, join(made.inside, MAP, 'work', 'PROJ-12'))

  assert.equal(result.stdout, `took ${SPEC}\n`)
  assert.equal(existsSync(join(made.inside, MAP, 'work', 'PROJ-12')), true)
})

test('draft leaves the folder it was run from when it removes the last draft there', () => {
  const made = estate()
  draft(made, made.inside, SOLO_STATE)
  rmSync(join(made.main, MAP, SOLO_STATE))

  draft(made, join(made.inside, MAP, 'work', 'PROJ-12'), SOLO_STATE)

  assert.equal(existsSync(join(made.inside, MAP, SOLO_STATE)), false)
  assert.equal(existsSync(join(made.inside, MAP, 'work', 'PROJ-12')), true)
})

function notesTracked() {
  const made = solo({ '.gitignore': `${MAP}/estate.json\n` })
  tree(made.base)
  return { ...made, inside: workTree(made, join(made.main, '.claude', 'worktrees', 'limit')) }
}

test("a file git tracks at the map's place in a work tree is no draft: take leaves it where it is", () => {
  const made = notesTracked()

  const result = take(made, made.inside)

  assert.equal(result.stdout, 'Nothing waits to be taken.\n')
  assert.equal(git(made, made.inside, 'status', '--short').stdout, '')
})

test('a note git does not track, written beside tracked ones in a work tree, is a draft and is taken', () => {
  const made = notesTracked()
  write(made.inside, 'concepts/limits.md', '# Limits\n')

  const result = take(made, made.inside)

  assert.equal(result.stdout, 'took concepts/limits.md\n')
  assert.equal(read(made.main, 'concepts/limits.md'), '# Limits\n')
  assert.equal(git(made, made.inside, 'status', '--short').stdout, '')
})

test('a file git tracks is no draft where the disk spells its name in another form of Unicode than git does', () => {
  const composed = 'caf\u00e9.md'
  const decomposed = 'cafe\u0301.md'
  const made = solo({ '.gitignore': `${MAP}/estate.json\n`, [`${MAP}/concepts/${composed}`]: '# Cafe\n' })
  tree(made.base)
  const inside = workTree(made, join(made.main, '.claude', 'worktrees', 'limit'))
  rmSync(join(inside, MAP, 'concepts', composed))
  write(inside, `concepts/${decomposed}`, '# Cafe\n')

  const result = take(made, inside)

  assert.equal(result.stdout, 'Nothing waits to be taken.\n')
  assert.equal(existsSync(join(inside, MAP, 'concepts', decomposed)), true)
})

test("draft gives a file git tracks in the work tree as the work tree's own, and copies nothing over it", () => {
  const made = notesTracked()
  write(made.main, 'glossary.md', '# Glossary, as the main checkout has it\n')

  const result = draft(made, made.inside, 'glossary.md')

  assert.equal(result.stdout, `${join(made.inside, MAP, 'glossary.md')}\n`)
  assert.equal(read(made.inside, 'glossary.md'), SOLO_FILES[`${MAP}/glossary.md`])
})

test('a map that keeps itself out of git with a tracked file of its own still has its drafts in a work tree', () => {
  const made = solo({ '.gitignore': 'node_modules/\n', [`${MAP}/.gitignore`]: '*\n!.gitignore\n' })
  tree(made.base)
  const inside = workTree(made, join(made.main, '.claude', 'worktrees', 'limit'))
  write(inside, SPEC, '# Spec\n')

  assert.equal(draft(made, inside, SOLO_STATE).stdout, `${join(inside, MAP, SOLO_STATE)}\n`)
  assert.equal(take(made, inside).stdout, `took ${SPEC}\n`)
})

const NO_ANSWER = (dir: string) => `git gave no answer in ${dir}, so a draft there cannot be told from a file git tracks; run git status there to see why\n`

test('with no git on the PATH take says that git gave no answer, and takes nothing', () => {
  const made = estate()
  write(made.inside, SPEC, '# Spec\n')

  const result = run(['take'], { cwd: made.inside, env: { ...made.env, PATH: tree(makeTree({})) } })

  assert.equal(result.code, 1)
  assert.equal(result.stderr, `context-central take: ${NO_ANSWER(made.inside)}`)
  assert.equal(existsSync(join(made.main, MAP, SPEC)), false)
  assert.equal(read(made.inside, SPEC), '# Spec\n')
})

test('with no git on the PATH draft says that git gave no answer, and prints no path', () => {
  const made = estate()

  const result = run(['draft', SOLO_STATE], { cwd: made.inside, env: { ...made.env, PATH: tree(makeTree({})) } })

  assert.equal(result.code, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, `context-central draft: ${NO_ANSWER(made.inside)}`)
})

test('where git refuses to answer, take says so and takes nothing', NEEDS_STAND_IN, () => {
  const made = estate()
  write(made.inside, SPEC, '# Spec\n')
  const refusing = tree(standIns({ git: '#!/bin/sh\necho "fatal: detected dubious ownership" >&2\nexit 128\n' }))

  const result = run(['take'], { cwd: made.inside, env: { ...made.env, PATH: refusing } })

  assert.equal(result.code, 1)
  assert.equal(result.stderr, `context-central take: ${NO_ANSWER(made.inside)}`)
})

test("more than a megabyte of tracked paths at the map's place does not stop draft", () => {
  const made = estate()
  const inIndex = (...args: string[]) => ['-C', made.inside, ...args]
  const empty = spawned('git', inIndex('hash-object', '-w', '--stdin'), { env: made.env, input: '' }).stdout.trim()
  const entries = Array.from({ length: 11000 }, (_, at) => `100644 ${empty}\t${MAP}/concepts/${'n'.repeat(96)}-${at}.md\n`)
  spawned('git', inIndex('update-index', '--add', '--index-info'), { env: made.env, input: entries.join('') })

  const result = draft(made, made.inside, 'glossary.md')

  assert.equal(result.stdout, `${join(made.inside, MAP, 'glossary.md')}\n`)
})

test('draft says so when the copy it would make cannot be written', notOnWindows('a file on Windows is not closed to writing by its mode in the same way'), () => {
  const made = estate()
  draft(made, made.inside, SOLO_STATE)
  chmodSync(join(made.inside, MAP, SOLO_STATE), 0o444)
  write(made.main, SOLO_STATE, '# PROJ-12, as another session left it\n')

  const result = draft(made, made.inside, SOLO_STATE)
  chmodSync(join(made.inside, MAP, SOLO_STATE), 0o644)

  assert.equal(result.code, 1)
  assert.equal(result.stderr, `context-central draft: ${SOLO_STATE} could not be drafted (EACCES)\n`)
})

test('an unedited draft of a file the map no longer holds is removed when it is drafted again', () => {
  const made = estate()
  draft(made, made.inside, SOLO_STATE)
  rmSync(join(made.main, MAP, SOLO_STATE))

  const result = draft(made, made.inside, SOLO_STATE)

  assert.equal(result.stdout, `${join(made.inside, MAP, SOLO_STATE)}\n`)
  assert.equal(existsSync(join(made.inside, MAP, SOLO_STATE)), false)
})

test("work done refuses while an edited draft of the item's state file waits, so the two do not cross", () => {
  const made = estate()
  draft(made, made.inside, SOLO_STATE)
  write(made.inside, SOLO_STATE, `${SOLO_FILES[`${MAP}/${SOLO_STATE}`]}\nBuilt.\n`)

  const result = run(['work', 'done', 'PROJ-12'], { cwd: made.inside, env: made.env })

  assert.equal(result.code, 1)
  assert.equal(result.stderr, `context-central work: ${SOLO_STATE} has a draft in this work tree that is not in the map yet; run context-central take, then this again\n`)
  assert.equal(read(made.main, SOLO_STATE), SOLO_FILES[`${MAP}/${SOLO_STATE}`])
})

test("with no git on the PATH work done still refuses while an edited draft of the item's state file waits", () => {
  const made = estate()
  draft(made, made.inside, SOLO_STATE)
  write(made.inside, SOLO_STATE, `${SOLO_FILES[`${MAP}/${SOLO_STATE}`]}\nBuilt.\n`)

  const result = run(['work', 'done', 'PROJ-12'], { cwd: made.inside, env: { ...made.env, PATH: tree(makeTree({})) } })

  assert.equal(result.code, 1)
  assert.equal(result.stderr, `context-central work: ${SOLO_STATE} has a draft in this work tree that is not in the map yet; run context-central take, then this again\n`)
  assert.equal(read(made.main, SOLO_STATE), SOLO_FILES[`${MAP}/${SOLO_STATE}`])
})

test('work done goes ahead where the draft of the state file was only read', () => {
  const made = estate()
  draft(made, made.inside, SOLO_STATE)

  const result = run(['work', 'done', 'PROJ-12'], { cwd: made.inside, env: made.env })

  assert.equal(result.stdout, 'PROJ-12: done\n')
  assert.match(read(made.main, SOLO_STATE), /^status: done$/m)
})

for (const round of [1, 2, 3, 4, 5]) {
  test(`two work trees that take an edited draft of one file at once end with one took and one kept, and nothing temporary in the map (round ${round})`, async () => {
    const made = estate()
    const trees = [made.inside, workTree(made, join(made.main, '.claude', 'worktrees', 'other'), 'work/other')]
    const texts = ['# PROJ-12, by the first\n', '# PROJ-12, by the second\n']
    for (const [at, inside] of trees.entries()) {
      draft(made, inside, SOLO_STATE)
      write(inside, SOLO_STATE, texts[at])
    }

    const results = await together(trees.map(cwd => ({ args: ['take'], options: { cwd, env: made.env } })))

    const first = results[0].code === 0 ? 0 : 1
    const second = 1 - first
    const toCompare = join(trees[second], MAP, IN_THE_MAP, SOLO_STATE)
    assert.deepEqual(results[first], { code: 0, stdout: `took ${SOLO_STATE}\n`, stderr: '' })
    assert.deepEqual(results[second], { code: 1, stdout: '', stderr: kept(SOLO_STATE, `the map's file changed after this was drafted; compare it with ${toCompare}, a copy of the map's file as it now is, then run context-central take --over ${SOLO_STATE}`) })
    assert.equal(read(made.main, SOLO_STATE), texts[first])
    assert.equal(read(trees[second], SOLO_STATE), texts[second])
    assert.equal(readFileSync(toCompare, 'utf8'), texts[first])
    assert.deepEqual(readdirSync(join(made.main, MAP), { recursive: true, encoding: 'utf8' }).filter(name => name.includes('.context-central.')), [])
  })
}
