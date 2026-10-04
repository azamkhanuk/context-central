import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { REPO } from './helpers.mjs'

const manifest = name => JSON.parse(readFileSync(join(REPO, '.claude-plugin', name), 'utf8'))

test('the plugin manifest names the plugin, its author, licence and repository', () => {
  const plugin = manifest('plugin.json')

  assert.equal(plugin.name, 'context-central')
  assert.deepEqual(plugin.author, { name: 'Azam Khan' })
  assert.equal(plugin.license, 'MIT')
  assert.equal(plugin.repository, 'https://github.com/azamkhanuk/context-central')
})

test('the plugin description is one plain sentence', () => {
  const { description } = manifest('plugin.json')

  assert.match(description, /^[A-Z][^.!?\u2014]*\.$/)
})

test('the plugin manifest carries keywords to be found by', () => {
  const { keywords } = manifest('plugin.json')

  assert.ok(keywords.length > 0)
  for (const keyword of keywords) assert.match(keyword, /^[a-z][a-z0-9-]*$/)
})

test('the plugin manifest pins no version, so every commit is an update', () => {
  assert.equal('version' in manifest('plugin.json'), false)
})

test('the repository is its own marketplace, with one plugin at its root', () => {
  const marketplace = manifest('marketplace.json')

  assert.equal(marketplace.name, 'context-central')
  assert.deepEqual(marketplace.owner, { name: 'Azam Khan' })
  assert.equal(marketplace.plugins.length, 1)
  assert.equal(marketplace.plugins[0].source, './')
})

test('the marketplace entry and the plugin manifest agree on the name', () => {
  assert.equal(manifest('marketplace.json').plugins[0].name, manifest('plugin.json').name)
})

test('the marketplace entry pins no version either', () => {
  assert.equal('version' in manifest('marketplace.json').plugins[0], false)
})

test('no lockfile is tracked, so installing the plugin runs no package install', () => {
  const tracked = spawnSync('git', ['-C', REPO, 'ls-files', '--', 'package-lock.json', 'npm-shrinkwrap.json', 'bun.lock'], { encoding: 'utf8' })

  assert.equal(tracked.status, 0)
  assert.equal(tracked.stdout, '')
})

test('git checks out no tracked file with Windows line endings', () => {
  const listed = spawnSync('git', ['-C', REPO, 'ls-files', '--eol'], { encoding: 'utf8' })

  assert.equal(listed.status, 0)
  assert.deepEqual(
    listed.stdout.split('\n').filter(line => /\bw\/(crlf|mixed)\b/.test(line)),
    [],
  )
})
