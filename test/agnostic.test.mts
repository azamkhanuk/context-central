import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { REPO, disposable, makeTree, pluginWith, runIn, run } from './helpers.mts'

const tree = disposable()

const PRESETS_FOLDER = ['lib', 'presets'].join('/')
const OWN_MARKETPLACE_ADDRESS = ['lib/templates.mts', 'lib/commands/init.mts']

function filesUnder(folder: string): string[] {
  return readdirSync(join(REPO, folder), { withFileTypes: true }).flatMap(entry => {
    const rel = `${folder}/${entry.name}`
    if (entry.isDirectory()) return rel === PRESETS_FOLDER ? [] : filesUnder(rel)
    return [rel]
  })
}

function presets() {
  return run(['connections', '--presets'], { cwd: REPO })
    .stdout.trimEnd()
    .split('\n')
    .map(line => line.split(' | '))
    .map(([name, , starts]) => ({ name, program: starts.replace(/^starts /, '') }))
}

const named = (word: string, text: string) => new RegExp(`(?<![A-Za-z0-9])${word}(?![A-Za-z0-9])`, 'i').test(text)

test("no code outside the presets folder names a vendor or the program one starts, but for the plugin's own marketplace address", () => {
  const words = presets().flatMap(({ name, program }) => [name, ...name.split('-'), program])
  const found = ['bin', 'hooks', 'lib']
    .flatMap(filesUnder)
    .flatMap(file => words.filter(word => named(word, readFileSync(join(REPO, file), 'utf8'))).map(word => `${file}: ${word}`))

  assert.ok(words.length >= 3)
  assert.deepEqual(found.filter(hit => !OWN_MARKETPLACE_ADDRESS.some(file => hit === `${file}: github`)), [])
})

test('every preset is a file in the presets folder, named for it', () => {
  const files = readdirSync(join(REPO, 'lib', 'presets')).map(file => file.replace(/\.mts$/, '')).sort()

  assert.deepEqual(presets().map(preset => preset.name), files)
})

test('with every preset taken away the plugin still lists, resolves, checks and detects', () => {
  const plugin = tree(pluginWith({}))
  const root = tree(makeTree({
    'estate.json': { contextCentral: 1, name: 'acme', connections: { desk: { holds: 'tickets', references: ['DESK-\\d+'], server: 'issues' } } },
    'CLAUDE.md': '# Acme\n',
    'work/DESK-41/STATE.md': '# DESK-41: Fix the login redirect\n',
  }))
  const env = { PATH: tree(makeTree({})), HOME: tree(makeTree({ '.keep': '' })) }
  const output = (...args: string[]) => runIn(plugin, args, { cwd: root, env })

  assert.equal(output('connections').stdout, 'desk | tickets | by a session, through the server issues\n')
  assert.equal(output('resolve', 'look at DESK-41').stdout.split('\n')[0], 'Context for work item DESK-41:')
  assert.equal(output('resolve', 'look at DESK-99').stdout, 'DESK-99 reads as a ticket of connection desk. No work item answers to it.\n')
  assert.equal(output('doctor').stdout.split('\n').find(line => line.includes('connections')), 'ok   connections')
  assert.deepEqual((JSON.parse(output('detect', '--json').stdout) as { tools: unknown }).tools, { git: false })
  assert.equal(output('fetch', 'ticket', 'DESK-41', '--check').stderr, 'context-central fetch: connection desk is not read by fetch: it has no preset that reads tickets. A session reads it through the server issues.\n')
})

test('a map made before connections, read by a plugin with no preset, has no connection it did not write down', () => {
  const plugin = tree(pluginWith({}))
  const root = tree(makeTree({ 'estate.json': { contextCentral: 1, name: 'acme' }, 'CLAUDE.md': '# Acme\n' }))

  assert.equal(runIn(plugin, ['fetch', 'pr', '88', '--check'], { cwd: root }).stderr, 'context-central fetch: no connection holds pull-requests\n')
})
