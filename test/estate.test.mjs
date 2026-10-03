import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { acme, disposable, makeTree, run } from './helpers.mjs'

const tree = disposable()

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

  assert.deepEqual(JSON.parse(run(['config', '--get', 'tracker.keyPatterns'], { cwd: root }).stdout), ['PROJ-\\d+'])
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
  assert.equal(JSON.parse(run(['where', '--json'], { cwd: join(root, 'src') }).stdout).mapDir, join(root, '.context-central'))
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
]) {
  test(`hooks ${verdict ? 'answer' : 'stay silent'} in ${folder}`, () => {
    const root = tree(acme())

    const where = JSON.parse(run(['where', '--json'], { cwd: join(root, folder) }).stdout)

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
