import assert from 'node:assert/strict'
import { test } from 'node:test'
import { disposable, makeTree, notOnWindows, pluginWith, runIn, standIns } from './helpers.mts'
import type { Json } from './helpers.mts'

const tree = disposable()

const ON_PATH = notOnWindows('the stand-in on the PATH is a file with no extension, which Windows does not take for a tool')
const DESK = `export default {
  program: 'acmedesk',
  kinds: {
    tickets: {
      references: entry => (entry.keys ?? []).map(key => '(?<id>' + key + '-\\\\d+)'),
      read: asked => ({ args: ['show', asked.id] }),
    },
    documents: {
      references: () => [],
    },
  },
}
`
const NOTHING_ON_PATH = { PATH: tree(makeTree({})) }

const estate = (settings: { [key: string]: Json }) => tree(makeTree({ 'estate.json': { contextCentral: 1, name: 'acme', ...settings }, 'CLAUDE.md': '# Acme\n' }))
const withDesk = () => tree(pluginWith({ acmedesk: DESK }))
const deskOnPath = () => ({ PATH: tree(standIns({ acmedesk: '#!/bin/sh\n' })) })

test('a preset is found by its file name, and listed with what it holds and the program it starts', () => {
  const result = runIn(withDesk(), ['connections', '--presets'], { cwd: estate({}) })

  assert.equal(result.stdout, 'acmedesk | holds tickets, documents | starts acmedesk | reads tickets\n')
  assert.equal(result.code, 0)
})

test('a plugin that carries no preset says so and still lists connections', () => {
  const plugin = tree(pluginWith({}))
  const root = estate({ connections: { tracker: { holds: 'tickets', server: 'issues' } } })

  assert.equal(runIn(plugin, ['connections', '--presets'], { cwd: root }).stdout, 'No preset is carried.\n')
  assert.equal(runIn(plugin, ['connections'], { cwd: root }).stdout, 'tracker | tickets | by a session, through the server issues\n')
})

test('the presets are listed with no map at all', () => {
  const result = runIn(withDesk(), ['connections', '--presets'], { cwd: tree(makeTree({ 'readme.md': '# no map here\n' })) })

  assert.equal(result.code, 0)
  assert.match(result.stdout, /^acmedesk \| /)
})

test('a connection whose preset can read is reached by fetch where its program is on the PATH', ON_PATH, () => {
  const root = estate({ connections: { tracker: { holds: 'tickets', preset: 'acmedesk', keys: ['PROJ'] } } })

  const result = runIn(withDesk(), ['connections'], { cwd: root, env: deskOnPath() })

  assert.equal(result.stdout, 'tracker | tickets | by fetch: context-central fetch ticket <reference> --item <item>\n')
})

test('where the program is not on the PATH the line says so, beside the other way recorded', () => {
  const root = estate({ connections: { tracker: { holds: 'tickets', preset: 'acmedesk', server: 'issues' }, spare: { holds: 'tickets', preset: 'acmedesk' } } })

  const result = runIn(withDesk(), ['connections'], { cwd: root, env: NOTHING_ON_PATH })

  assert.equal(result.stdout, 'tracker | tickets | by a session, through the server issues (not by fetch here: acmedesk is not on PATH)\nspare | tickets | by hand (not by fetch here: acmedesk is not on PATH)\n')
})

test('a kind the preset holds and cannot read is never reached by fetch', ON_PATH, () => {
  const root = estate({ connections: { wiki: { holds: 'documents', preset: 'acmedesk' } } })

  assert.equal(runIn(withDesk(), ['connections'], { cwd: root, env: deskOnPath() }).stdout, 'wiki | documents | by hand\n')
})

test('as JSON a connection says whether fetch reads it here and which program is missing', ON_PATH, () => {
  const root = estate({ connections: { tracker: { holds: 'tickets', preset: 'acmedesk' } } })
  const entry = { holds: 'tickets', preset: 'acmedesk' }

  assert.deepEqual(JSON.parse(runIn(withDesk(), ['connections', '--json'], { cwd: root, env: deskOnPath() }).stdout) as unknown, [
    { name: 'tracker', holds: 'tickets', by: 'fetch', fetch: 'context-central fetch ticket <reference> --item <item>', missing: null, entry },
  ])
  assert.deepEqual(JSON.parse(runIn(withDesk(), ['connections', '--json'], { cwd: root, env: NOTHING_ON_PATH }).stdout) as unknown, [
    { name: 'tracker', holds: 'tickets', by: 'hand', fetch: null, missing: 'acmedesk', entry },
  ])
})

test('the tracker and the code host of an old map each take the preset their type names', () => {
  const root = estate({ tracker: { type: 'acmedesk', keyPatterns: ['PROJ-\\d+'] }, codeHost: { type: 'acmedesk' } })

  assert.deepEqual(JSON.parse(runIn(withDesk(), ['config', '--get', 'connections'], { cwd: root }).stdout) as unknown, {
    acmedesk: { holds: 'tickets', references: ['PROJ-\\d+'], preset: 'acmedesk' },
    'acmedesk-pull-requests': { holds: 'pull-requests', preset: 'acmedesk' },
  })
})
