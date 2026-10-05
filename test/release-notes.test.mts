import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { REPO, disposable, makeTree, spawned } from './helpers.mts'

const SCRIPT = join(REPO, 'scripts', 'release-notes.mts')

const tree = disposable()

const CHANGELOG = '# Changelog\n\nNewest first.\n\n## 0.2.0 - 2026-02-01\n\nSecond.\n\n- One thing.\n- Another.\n\n## 0.1.0 - 2026-01-15\n\nThe first release.\n'
const repository = version => tree(makeTree({ '.claude-plugin/plugin.json': { name: 'acme-tools', version }, 'CHANGELOG.md': CHANGELOG }))
const release = (root, ...flags) => spawned(process.execPath, [SCRIPT, ...flags], { cwd: root })

test('the notes of a release are the changelog section of the version the manifest carries, and no other', () => {
  const root = repository('0.2.0')

  assert.deepEqual(release(root), { code: 0, stdout: 'Second.\n\n- One thing.\n- Another.\n', stderr: '' })
})

test('the oldest section ends where the changelog ends', () => {
  const root = repository('0.1.0')

  assert.deepEqual(release(root), { code: 0, stdout: 'The first release.\n', stderr: '' })
})

test('the tag and the title of a release come from the name and the version in the manifest', () => {
  const root = repository('0.2.0')

  assert.deepEqual(release(root, '--tag'), { code: 0, stdout: 'acme-tools--v0.2.0\n', stderr: '' })
  assert.deepEqual(release(root, '--title'), { code: 0, stdout: 'acme-tools 0.2.0\n', stderr: '' })
})

test('a version with no section in the changelog is refused, and the start of another version does not count as it', () => {
  const missing = repository('0.3.0')
  const shorter = repository('0.2')

  assert.deepEqual(release(missing), { code: 1, stdout: '', stderr: 'no section for 0.3.0 in CHANGELOG.md\n' })
  assert.deepEqual(release(shorter), { code: 1, stdout: '', stderr: 'no section for 0.2 in CHANGELOG.md\n' })
})
