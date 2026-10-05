import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { REPO } from './helpers.mts'

type Plugin = { name: unknown, author: unknown, license: unknown, repository: unknown, description: string, keywords: string[], version: string }
type Marketplace = { name: unknown, owner: unknown, plugins: { name: unknown, source: unknown }[] }

const manifest = <Manifest,>(name: string) => JSON.parse(readFileSync(join(REPO, '.claude-plugin', name), 'utf8')) as Manifest

test('the plugin manifest names the plugin, its author, licence and repository', () => {
  const plugin = manifest<Plugin>('plugin.json')

  assert.equal(plugin.name, 'context-central')
  assert.deepEqual(plugin.author, { name: 'Azam Khan' })
  assert.equal(plugin.license, 'MIT')
  assert.equal(plugin.repository, 'https://github.com/azamkhanuk/context-central')
})

test('the plugin description is one plain sentence', () => {
  const { description } = manifest<Plugin>('plugin.json')

  assert.match(description, /^[A-Z][^.!?\u2014]*\.$/)
})

test('the plugin manifest carries keywords to be found by', () => {
  const { keywords } = manifest<Plugin>('plugin.json')

  assert.ok(keywords.length > 0)
  for (const keyword of keywords) assert.match(keyword, /^[a-z][a-z0-9-]*$/)
})

test('the plugin manifest carries a version of three numbers, so people stay on a release until the next one', () => {
  assert.match(manifest<Plugin>('plugin.json').version, /^\d+\.\d+\.\d+$/)
})

test('the newest section of the changelog is the version the manifest carries, with its date', () => {
  const [, version, date] = /^## (\S+) - (\S+)$/m.exec(readFileSync(join(REPO, 'CHANGELOG.md'), 'utf8')) ?? []

  assert.equal(version, manifest<Plugin>('plugin.json').version)
  assert.match(date, /^\d{4}-\d{2}-\d{2}$/)
})

test('the repository is its own marketplace, with one plugin at its root', () => {
  const marketplace = manifest<Marketplace>('marketplace.json')

  assert.equal(marketplace.name, 'context-central')
  assert.deepEqual(marketplace.owner, { name: 'Azam Khan' })
  assert.equal(marketplace.plugins.length, 1)
  assert.equal(marketplace.plugins[0].source, './')
})

test('the marketplace entry and the plugin manifest agree on the name', () => {
  assert.equal(manifest<Marketplace>('marketplace.json').plugins[0].name, manifest<Plugin>('plugin.json').name)
})

test('the marketplace entry carries no version of its own, so the manifest holds the only one', () => {
  assert.equal('version' in manifest<Marketplace>('marketplace.json').plugins[0], false)
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
