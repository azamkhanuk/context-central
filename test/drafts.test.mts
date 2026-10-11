import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { ACME_CONFIG, ACME_FILES, SOLO_FILES, SOLO_STATE, checkout, disposable, run, solo, workTree } from './helpers.mts'
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

  for (const odd of ['src/app.js', 'work/../../CLAUDE.md', join(made.main, 'CLAUDE.md'), 'bin/context-central']) {
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
