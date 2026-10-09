import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { ACME_CONFIG, acme, disposable, makeTree, run } from './helpers.mts'
import type { Json } from './helpers.mts'

const tree = disposable()

type Where = { mapDir: unknown, covered: unknown, estateRoot: unknown }

test('settings are read from anywhere inside the estate', () => {
  const root = tree(acme())

  assert.equal(run(['config', '--get', 'name'], { cwd: root }).stdout, 'acme\n')
  assert.equal(run(['config', '--get', 'name'], { cwd: join(root, 'web', 'src') }).stdout, 'acme\n')
})

test('unset settings fall back to documented defaults', () => {
  const root = tree(acme())

  assert.equal(run(['config', '--get', 'budgets.hubLines'], { cwd: root }).stdout, '200\n')
  assert.equal(run(['config', '--get', 'hub'], { cwd: root }).stdout, 'CLAUDE.md\n')
})

test('a list setting prints as JSON', () => {
  const root = tree(acme())

  assert.deepEqual(JSON.parse(run(['config', '--get', 'tracker.keyPatterns'], { cwd: root }).stdout) as unknown, ['PROJ-\\d+'])
})

test('asking for a setting that does not exist fails', () => {
  const root = tree(acme())

  const result = run(['config', '--get', 'tracker.nope'], { cwd: root })

  assert.equal(result.code, 1)
  assert.match(result.stderr, /tracker\.nope/)
})

test('an estate.json written by something else is not taken for a map', () => {
  const root = tree(makeTree({ 'estate.json': { name: 'someone-elses-file' } }))

  const result = run(['config'], { cwd: root })

  assert.equal(result.code, 1)
  assert.match(result.stderr, /no context map found/)
})

test('the map can live in a folder inside a repository', () => {
  const root = tree(makeTree({ '.context-central/estate.json': { contextCentral: 1, name: 'solo' }, 'src/app.js': '' }))

  assert.equal(run(['config', '--get', 'name'], { cwd: join(root, 'src') }).stdout, 'solo\n')
  assert.equal((JSON.parse(run(['where', '--json'], { cwd: join(root, 'src') }).stdout) as Where).mapDir, join(root, '.context-central'))
})

test('from inside the map folder of a map kept in a repository, the estate root is still the repository', () => {
  const root = tree(makeTree({ '.context-central/estate.json': { contextCentral: 1, name: 'solo' }, '.context-central/work/PROJ-1/STATE.md': '# PROJ-1\n' }))
  const where = (dir: string) => JSON.parse(run(['where', '--json'], { cwd: join(root, dir) }).stdout) as Where
  const inRepository = { name: 'solo', estateRoot: root, mapDir: join(root, '.context-central'), layout: 'inner', covered: 'inside', glossary: join(root, '.context-central', 'glossary.md'), glossaryRepo: null }

  assert.deepEqual(where('.context-central'), inRepository)
  assert.deepEqual(where('.context-central/work/PROJ-1'), inRepository)
})

test('a config for a newer plugin is refused with its path', () => {
  const root = tree(makeTree({ 'estate.json': { contextCentral: 2, name: 'future' } }))

  const result = run(['config'], { cwd: root })

  assert.equal(result.code, 1)
  assert.match(result.stderr, /estate\.json/)
  assert.match(result.stderr, /contextCentral/)
})

test('a ticket pattern that is not a regular expression is refused', () => {
  const root = tree(acme({}, { tracker: { type: 'jira', keyPatterns: ['PROJ-(\\d+'] } }))

  const result = run(['config'], { cwd: root })

  assert.equal(result.code, 1)
  assert.match(result.stderr, /keyPatterns/)
})

for (const [folder, verdict] of [
  ['.', 'root'],
  ['web/src', 'repo:web'],
  ['concepts', 'node'],
  ['scratch', null],
  ['elsewhere', null],
] satisfies [string, string | null][]) {
  test(`hooks ${verdict ? 'answer' : 'stay silent'} in ${folder}`, () => {
    const root = tree(acme())

    const where = JSON.parse(run(['where', '--json'], { cwd: join(root, folder) }).stdout) as Where

    assert.equal(where.covered, verdict)
    assert.equal(where.estateRoot, root)
  })
}

test('an unknown command is a usage error', () => {
  const result = run(['nonsense'])

  assert.equal(result.code, 2)
  assert.match(result.stderr, /unknown command "nonsense"/)
})

test('help lists the commands', () => {
  const result = run(['help'])

  assert.equal(result.code, 0)
  assert.match(result.stdout, /config\s+\S/)
})

test('a command asked for --help answers with its own line of the help and does nothing else', () => {
  const root = tree(acme())

  const result = run(['note', '--help'], { cwd: root })

  assert.equal(result.stderr, '')
  assert.equal(result.code, 0)
  assert.match(result.stdout, /^Usage: context-central <command> \[options\]\n\n  note +Log a line: note <text>\. [^\n]+\n$/)
  assert.equal(existsSync(join(root, 'log')), false)
})

test('-h is --help, and needs no map', () => {
  const root = tree(makeTree({}))

  const result = run(['resolve', '-h'], { cwd: root })

  assert.equal(result.stderr, '')
  assert.equal(result.code, 0)
  assert.match(result.stdout, /^Usage: context-central <command> \[options\]\n\n  resolve +\S[^\n]+\n$/)
})

test('an unknown flag is a usage error, not a crash', () => {
  const root = tree(acme())

  const result = run(['work', 'list', '--bogus'], { cwd: root })

  assert.equal(result.code, 2)
  assert.match(result.stderr, /^context-central work: .*--bogus/)
  assert.doesNotMatch(result.stderr, /\n\s+at /)
})

test('a command that prints JSON exits cleanly', () => {
  const root = tree(acme())

  assert.equal(run(['work', 'list', '--json'], { cwd: root }).code, 0)
  assert.equal(run(['where', '--json'], { cwd: root }).code, 0)
})

test('a hub setting that is not text is refused', () => {
  const root = tree(acme({}, { hub: 5 }))

  const result = run(['config'], { cwd: root })

  assert.equal(result.code, 1)
  assert.match(result.stderr, /"hub" must be text/)
})

test('the resume notice and the prompt length limit have defaults', () => {
  const root = tree(acme())

  assert.equal(run(['config', '--get', 'budgets.resumeNoticeTokens'], { cwd: root }).stdout, '100000\n')
  assert.equal(run(['config', '--get', 'budgets.hookTextChars'], { cwd: root }).stdout, '600\n')
})

test('legacy hooks default to none and must be a list of non-empty strings', () => {
  const root = tree(acme())
  const wrong = tree(acme({}, { legacyHooks: ['old-resolver.mjs', 5] }))

  assert.equal(run(['config', '--get', 'legacyHooks'], { cwd: root }).stdout, '[]\n')
  assert.equal(run(['config'], { cwd: wrong }).code, 1)
  assert.match(run(['config'], { cwd: wrong }).stderr, /"legacyHooks" must be a list of non-empty strings/)
})

test('an empty entry in a list setting is refused', () => {
  const root = tree(acme({}, { legacyHooks: [''] }))

  const result = run(['config'], { cwd: root })

  assert.equal(result.code, 1)
  assert.match(result.stderr, /"legacyHooks" must be a list of non-empty strings/)
})

test('whether evidence is committed answers false on a map that does not say, and true where it says so', () => {
  const unset = tree(acme())
  const set = tree(acme({}, { evidence: { commit: true } }))

  assert.equal(run(['config', '--get', 'evidence.commit'], { cwd: unset }).stdout, 'false\n')
  assert.equal(run(['config', '--get', 'evidence.commit'], { cwd: set }).stdout, 'true\n')
})

test('the size limit for one evidence file is a megabyte unless set', () => {
  const root = tree(acme())

  assert.equal(run(['config', '--get', 'budgets.evidenceBytes'], { cwd: root }).stdout, '1048576\n')
})

test('an answer on committing evidence that is not true or false is refused', () => {
  const word = tree(acme({}, { evidence: { commit: 'yes' } }))
  const bare = tree(acme({}, { evidence: true }))
  const empty = tree(acme({}, { evidence: { commit: null } }))
  const nothing = tree(acme({}, { evidence: null }))

  for (const root of [word, bare, empty, nothing]) {
    const result = run(['config'], { cwd: root })

    assert.equal(result.code, 1)
    assert.equal(result.stderr, `context-central config: ${join(root, 'estate.json')}: "evidence.commit" must be true or false\n`)
  }
})

test('a byte-order mark at the start of the config is ignored', () => {
  const root = tree(makeTree({ 'estate.json': `\uFEFF${JSON.stringify(ACME_CONFIG)}\n` }))

  const result = run(['config', '--get', 'name'], { cwd: root })

  assert.deepEqual(result, { code: 0, stdout: 'acme\n', stderr: '' })
})

const glossaryOf = (root: string) => {
  const { glossary, glossaryRepo } = JSON.parse(run(['where', '--json'], { cwd: root }).stdout) as { glossary: unknown, glossaryRepo: unknown }
  return [glossary, glossaryRepo]
}

test("where says where the glossary is: the map's own unless the estate names another, counted from the estate root", () => {
  const own = tree(acme())
  const named = tree(acme({}, { glossary: 'docs/terms.md' }))

  assert.equal(run(['where'], { cwd: own }).stdout.split('\n')[2], `glossary: ${join(own, 'glossary.md')}`)
  assert.deepEqual(glossaryOf(named), [join(named, 'docs', 'terms.md'), null])
})

test('a glossary inside a registered repo is said to be inside it', () => {
  const root = tree(acme({}, { glossary: 'web/docs/glossary.md' }))

  assert.equal(run(['where'], { cwd: root }).stdout.split('\n')[2], `glossary: ${join(root, 'web', 'docs', 'glossary.md')}, inside repo web`)
  assert.deepEqual(glossaryOf(root), [join(root, 'web', 'docs', 'glossary.md'), 'web'])
})

test("in a map kept inside a repository, the map's own glossary is not inside the repo, and another file of that repository is", () => {
  const solo = (glossary?: string) => tree(makeTree({ '.context-central/estate.json': { contextCentral: 1, name: 'solo', repos: [{ name: 'solo', path: '.' }], ...(glossary ? { glossary } : {}) } }))

  assert.equal(glossaryOf(solo())[1], null)
  assert.equal(glossaryOf(solo('.context-central/docs/terms.md'))[1], null)
  assert.equal(glossaryOf(solo('CONTEXT.md'))[1], 'solo')
})

test("where the estate root is itself a registered repo, a glossary in the map's own folder is not inside it", () => {
  const whole: { [key: string]: Json } = { repos: [{ name: 'web' }, { name: 'estate', path: '.' }] }

  assert.equal(glossaryOf(tree(acme({}, whole)))[1], null)
  assert.equal(glossaryOf(tree(acme({}, { ...whole, glossary: 'terms.md' })))[1], null)
  assert.equal(glossaryOf(tree(acme({}, { ...whole, glossary: 'web/terms.md' })))[1], 'web')
})

test('a glossary path that would leave the estate is refused', () => {
  for (const outside of ['/etc/terms.md', '../terms.md', 'docs/../../terms.md', 'C:/notes/terms.md', 'docs\\terms.md']) {
    const result = run(['where'], { cwd: tree(acme({}, { glossary: outside })) })

    assert.equal(result.code, 1, outside)
    assert.ok(result.stderr.endsWith(`estate.json: "glossary" holds "${outside}"; a path there is counted from the estate root, with forward slashes and no ".."\n`), result.stderr)
  }
})
