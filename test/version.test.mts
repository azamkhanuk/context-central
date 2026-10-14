import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { REPO, acme, disposable, makeTree, run } from './helpers.mts'
import type { TreeFiles } from './helpers.mts'

const tree = disposable()

const MANIFEST = join('.claude-plugin', 'plugin.json')
const ON = `(Node ${process.versions.node}, ${process.platform} ${process.arch})`

const versionOf = (files: TreeFiles) => {
  const plugin = tree(makeTree(files))
  return { plugin, result: run(['--version'], { env: { CONTEXT_CENTRAL_PLUGIN_ROOT: plugin } }) }
}

test('--version prints the release the manifest carries, the Node it runs on and the system, in one line', () => {
  const { result } = versionOf({ '.claude-plugin/plugin.json': { name: 'context-central', version: '9.9.9' } })

  assert.deepEqual(result, { code: 0, stdout: `context-central 9.9.9 ${ON}\n`, stderr: '' })
})

test('with no plugin root named, --version reads the manifest of the plugin the command belongs to', () => {
  const { version } = JSON.parse(readFileSync(join(REPO, MANIFEST), 'utf8')) as { version: string }

  assert.equal(run(['--version']).stdout, `context-central ${version} ${ON}\n`)
})

test('help ends with a line for --version, and the help of one command does not have it', () => {
  const root = tree(acme())

  assert.match(run(['help']).stdout, /\n  --version +\S[^\n]+\n$/)
  assert.doesNotMatch(run(['lint', '--help'], { cwd: root }).stdout, /--version/)
})

test('--version after a command is a flag of that command, which lint does not take', () => {
  const root = tree(acme())

  const result = run(['lint', '--version'], { cwd: root })

  assert.equal(result.code, 2)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /^context-central lint: Unknown option '--version'/)
})

for (const [what, files] of Object.entries<TreeFiles>({
  'that is missing': {},
  'that is not JSON': { '.claude-plugin/plugin.json': 'not json\n' },
  'that holds no version': { '.claude-plugin/plugin.json': { name: 'context-central' } },
  'whose version is not text': { '.claude-plugin/plugin.json': { name: 'context-central', version: 9 } },
})) {
  test(`--version with a manifest ${what} says in one line that it gives no version, and exits 1`, () => {
    const { plugin, result } = versionOf(files)

    assert.deepEqual(result, { code: 1, stdout: '', stderr: `context-central: ${join(plugin, MANIFEST)} gives no version\n` })
  })
}
