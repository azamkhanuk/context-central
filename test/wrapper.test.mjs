import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { delimiter, dirname, join } from 'node:path'
import { test } from 'node:test'
import { acme, disposable, makeTree, run } from './helpers.mjs'

const tree = disposable()

const STUB_CLI = 'console.log(JSON.stringify({ cli: __filename, args: process.argv.slice(2) }))\n'
const PATH = [dirname(process.execPath), process.env.PATH].join(delimiter)

function machine() {
  const root = tree(
    makeTree({
      'launcher/context-central': run(['wrapper']).stdout,
      'installed/context-central/bin/context-central': STUB_CLI,
      'elsewhere/bin/context-central': STUB_CLI,
    }),
  )
  return root
}

function install(root, configDir) {
  const installed = {
    version: 2,
    plugins: {
      'other-plugin@some-market': [{ scope: 'user', installPath: join(root, 'installed/other-plugin'), version: '1.0.0' }],
      'context-central@context-central': [{ scope: 'user', installPath: join(root, 'installed/context-central'), version: 'abc123' }],
    },
  }
  mkdirSync(join(configDir, 'plugins'), { recursive: true })
  writeFileSync(join(configDir, 'plugins', 'installed_plugins.json'), `${JSON.stringify(installed, null, 2)}\n`)
}

function launch(root, args, env) {
  const result = spawnSync('sh', [join(root, 'launcher/context-central'), ...args], { encoding: 'utf8', env: { PATH, HOME: join(root, 'home'), ...env } })
  return { code: result.status, stdout: result.stdout, stderr: result.stderr }
}

test('the launcher is a POSIX shell script, printed without needing a map', () => {
  const result = run(['wrapper'], { cwd: tree(makeTree({ 'readme.txt': 'x\n' })) })

  assert.equal(result.code, 0)
  assert.match(result.stdout, /^#!\/bin\/sh\n/)
})

test('--write saves the launcher in the map, executable', () => {
  const root = tree(acme())

  const result = run(['wrapper', '--write'], { cwd: join(root, 'work') })

  assert.equal(result.stdout, 'created bin/context-central\n')
  const launcher = readFileSync(join(root, 'bin/context-central'), 'utf8')
  assert.match(launcher, /^#!\/bin\/sh\n/)
  assert.ok(launcher.endsWith('\nexec node "$cli" "$@"\n'))
  assert.equal(statSync(join(root, 'bin/context-central')).mode & 0o777, 0o755)
})

test('--write never overwrites a launcher that is already there', () => {
  const root = tree(acme({ 'bin/context-central': '#!/bin/sh\necho mine\n' }))

  const result = run(['wrapper', '--write'], { cwd: root })

  assert.equal(result.stdout, 'kept bin/context-central\n')
  assert.equal(readFileSync(join(root, 'bin/context-central'), 'utf8'), '#!/bin/sh\necho mine\n')
})

test('--write needs a map', () => {
  const result = run(['wrapper', '--write'], { cwd: tree(makeTree({ 'readme.txt': 'x\n' })) })

  assert.equal(result.code, 1)
  assert.match(result.stderr, /no context map found/)
})

test('the launcher runs the installed plugin and passes every argument through', () => {
  const root = machine()
  install(root, join(root, 'config'))

  const result = launch(root, ['resolve', 'two words', '', '*', "it's", '--max', '3'], { CLAUDE_CONFIG_DIR: join(root, 'config') })

  assert.equal(result.code, 0)
  assert.deepEqual(JSON.parse(result.stdout), {
    cli: join(root, 'installed/context-central/bin/context-central'),
    args: ['resolve', 'two words', '', '*', "it's", '--max', '3'],
  })
})

test('the launcher looks in ~/.claude when no config dir is set', () => {
  const root = machine()
  install(root, join(root, 'home/.claude'))

  const result = launch(root, ['index'], {})

  assert.deepEqual(JSON.parse(result.stdout), { cli: join(root, 'installed/context-central/bin/context-central'), args: ['index'] })
})

test('CONTEXT_CENTRAL_CLI wins over the installed plugin', () => {
  const root = machine()
  install(root, join(root, 'config'))

  const result = launch(root, ['index'], { CLAUDE_CONFIG_DIR: join(root, 'config'), CONTEXT_CENTRAL_CLI: join(root, 'elsewhere/bin/context-central') })

  assert.deepEqual(JSON.parse(result.stdout), { cli: join(root, 'elsewhere/bin/context-central'), args: ['index'] })
})

test('the exit code of the CLI is the exit code of the launcher', () => {
  const root = machine()
  writeFileSync(join(root, 'elsewhere/bin/context-central'), 'process.exitCode = 2\n')

  const result = launch(root, ['nonsense'], { CONTEXT_CENTRAL_CLI: join(root, 'elsewhere/bin/context-central') })

  assert.equal(result.code, 2)
})

test('with nothing installed the launcher says how to install and exits 1', () => {
  const root = machine()

  const result = launch(root, ['index'], {})

  assert.equal(result.code, 1)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /claude plugin install context-central@context-central/)
})

test('an installed plugin whose files are gone counts as nothing installed', () => {
  const root = machine()
  install(root, join(root, 'config'))
  rmSync(join(root, 'installed'), { recursive: true })

  const result = launch(root, ['index'], { CLAUDE_CONFIG_DIR: join(root, 'config') })

  assert.equal(result.code, 1)
  assert.match(result.stderr, /the plugin was not found/)
})

test('an installed list that cannot be read counts as nothing installed', () => {
  const root = machine()
  mkdirSync(join(root, 'config/plugins'), { recursive: true })
  writeFileSync(join(root, 'config/plugins/installed_plugins.json'), 'not json\n')

  const result = launch(root, ['index'], { CLAUDE_CONFIG_DIR: join(root, 'config') })

  assert.equal(result.code, 1)
  assert.match(result.stderr, /the plugin was not found/)
})

test('without node on the PATH the launcher says so and exits 1', () => {
  const root = machine()
  const result = spawnSync('/bin/sh', [join(root, 'launcher/context-central'), 'index'], {
    encoding: 'utf8',
    env: { PATH: join(root, 'launcher'), HOME: join(root, 'home'), CONTEXT_CENTRAL_CLI: join(root, 'elsewhere/bin/context-central') },
  })

  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'context-central: node was not found on the PATH. Install Node 20 or later.\n')
})

test('an installed list without this plugin counts as nothing installed', () => {
  const root = machine()
  mkdirSync(join(root, 'config/plugins'), { recursive: true })
  writeFileSync(join(root, 'config/plugins/installed_plugins.json'), '{ "version": 2, "plugins": { "other-plugin@some-market": [{ "installPath": "/nowhere" }] } }\n')

  const result = launch(root, ['index'], { CLAUDE_CONFIG_DIR: join(root, 'config') })

  assert.equal(result.code, 1)
  assert.match(result.stderr, /the plugin was not found/)
})
