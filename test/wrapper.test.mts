import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { delimiter, dirname, join } from 'node:path'
import { test } from 'node:test'
import { acme, disposable, makeTree, notOnWindows, onlyOnWindows, run } from './helpers.mts'
import type { Env } from './helpers.mts'

const tree = disposable()

const STUB_CLI = 'console.log(JSON.stringify({ cli: __filename, args: process.argv.slice(2) }))\n'
const PATH = [dirname(process.execPath), process.env.PATH].join(delimiter)

function machine() {
  const root = tree(
    makeTree({
      'launcher/context-central': run(['wrapper']).stdout,
      'installed/context-central/bin/context-central': STUB_CLI,
      'elsewhere/bin/context-central': STUB_CLI,
      'map/estate.json': { contextCentral: 1, name: 'acme' },
    }),
  )
  return root
}

function install(root: string, configDir: string, installPath = join(root, 'installed/context-central'), id = 'context-central@azamkhanuk') {
  const installed = {
    version: 2,
    plugins: {
      'other-plugin@some-market': [{ scope: 'user', installPath: join(root, 'installed/other-plugin'), version: '1.0.0' }],
      [id]: [{ scope: 'user', installPath, version: 'abc123' }],
    },
  }
  mkdirSync(join(configDir, 'plugins'), { recursive: true })
  writeFileSync(join(configDir, 'plugins', 'installed_plugins.json'), `${JSON.stringify(installed, null, 2)}\n`)
}

function launch(root: string, args: string[], env?: Env) {
  const result = spawnSync('sh', [join(root, 'launcher/context-central'), ...args], { encoding: 'utf8', env: { PATH, HOME: join(root, 'home'), ...env } })
  return { code: result.status, stdout: result.stdout, stderr: result.stderr }
}

test('the launcher is a POSIX shell script, printed without needing a map', () => {
  const result = run(['wrapper'], { cwd: tree(makeTree({ 'readme.txt': 'x\n' })) })

  assert.equal(result.code, 0)
  assert.match(result.stdout, /^#!\/bin\/sh\n/)
})

test('--write saves the launcher in the map', () => {
  const root = tree(acme())

  const result = run(['wrapper', '--write'], { cwd: join(root, 'work') })

  assert.equal(result.stdout, 'created bin/context-central\ncreated bin/context-central.cmd\ncreated bin/.gitattributes\n')
  const launcher = readFileSync(join(root, 'bin/context-central'), 'utf8')
  assert.match(launcher, /^#!\/bin\/sh\n/)
  assert.ok(launcher.endsWith('\nexec node "$cli" "$@"\n'))
})

test('the saved launcher can be run by its owner and read by everyone', notOnWindows('Windows keeps no file mode'), () => {
  const root = tree(acme())

  run(['wrapper', '--write'], { cwd: root })

  assert.equal(statSync(join(root, 'bin/context-central')).mode & 0o777, 0o755)
})

const DIFFERS = '(differs from the one this release writes: delete it and run this again to renew it)'

test('--write never overwrites a launcher that is already there, and says when it is not the one this release writes', () => {
  const root = tree(acme({ 'bin/context-central': '#!/bin/sh\necho mine\n' }))

  const result = run(['wrapper', '--write'], { cwd: root })

  assert.equal(result.stdout, `kept bin/context-central ${DIFFERS}\ncreated bin/context-central.cmd\ncreated bin/.gitattributes\n`)
  assert.equal(readFileSync(join(root, 'bin/context-central'), 'utf8'), '#!/bin/sh\necho mine\n')
})

test('--write a second time keeps all three files', () => {
  const root = tree(acme())
  run(['wrapper', '--write'], { cwd: root })
  const saved = () => ['bin/context-central', 'bin/context-central.cmd', 'bin/.gitattributes'].map(rel => readFileSync(join(root, rel), 'utf8'))
  const first = saved()

  const result = run(['wrapper', '--write'], { cwd: root })

  assert.equal(result.stdout, 'kept bin/context-central\nkept bin/context-central.cmd\nkept bin/.gitattributes\n')
  assert.deepEqual(saved(), first)
})

test('a cmd launcher or an attributes file already there is kept while the rest is created', () => {
  const root = tree(acme({ 'bin/context-central.cmd': '@echo mine\r\n', 'bin/.gitattributes': '* text\n' }))

  const result = run(['wrapper', '--write'], { cwd: root })

  assert.equal(result.stdout, `created bin/context-central\nkept bin/context-central.cmd ${DIFFERS}\nkept bin/.gitattributes\n`)
  assert.equal(readFileSync(join(root, 'bin/context-central.cmd'), 'utf8'), '@echo mine\r\n')
  assert.equal(readFileSync(join(root, 'bin/.gitattributes'), 'utf8'), '* text\n')
})

test('every line of the saved cmd launcher ends in a carriage return and a line feed', () => {
  const root = tree(acme())

  run(['wrapper', '--write'], { cwd: root })

  const launcher = readFileSync(join(root, 'bin/context-central.cmd'), 'utf8')
  assert.match(launcher, /^@echo off\r\n/)
  assert.ok(launcher.endsWith('\r\n'))
  assert.doesNotMatch(launcher, /[^\r]\n/)
})

test('the saved attributes file keeps the launcher at LF and the cmd launcher at CRLF', () => {
  const root = tree(acme())

  run(['wrapper', '--write'], { cwd: root })

  assert.equal(readFileSync(join(root, 'bin/.gitattributes'), 'utf8'), 'context-central text eol=lf\ncontext-central.cmd text eol=crlf\n')
})

test('launchers committed to git keep their line endings in a clone that converts them', () => {
  const root = tree(acme())
  const home = tree(makeTree({ gitconfig: '' }))
  const clone = join(tree(makeTree({})), 'clone')
  const env = { PATH: process.env.PATH, HOME: home, GIT_CONFIG_GLOBAL: join(home, 'gitconfig'), GIT_CONFIG_NOSYSTEM: '1' }
  const git = (...args: string[]) => {
    const result = spawnSync('git', args, { encoding: 'utf8', env })
    assert.equal(result.status, 0, result.stderr)
  }
  run(['wrapper', '--write'], { cwd: root })

  git('-C', root, 'init', '-q')
  git('-C', root, 'add', 'bin')
  git('-C', root, '-c', 'user.name=Test Person', '-c', 'user.email=test@acme.example', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'launchers')
  git('clone', '-q', '-c', 'core.autocrlf=true', root, clone)

  const launcher = readFileSync(join(clone, 'bin/context-central'), 'utf8')
  const cmdLauncher = readFileSync(join(clone, 'bin/context-central.cmd'), 'utf8')
  assert.match(launcher, /^#!\/bin\/sh\n/)
  assert.doesNotMatch(launcher, /\r/)
  assert.match(cmdLauncher, /^@echo off\r\n/)
  assert.doesNotMatch(cmdLauncher, /[^\r]\n/)
})

test('--write needs a map', () => {
  const result = run(['wrapper', '--write'], { cwd: tree(makeTree({ 'readme.txt': 'x\n' })) })

  assert.equal(result.code, 1)
  assert.match(result.stderr, /no context map found/)
})

test('the launcher runs the plugin the install record names', () => {
  const root = machine()
  install(root, join(root, 'config'))

  const result = launch(root, ['resolve', 'PROJ-12', '--max', '3'], { CLAUDE_CONFIG_DIR: join(root, 'config') })

  assert.equal(result.code, 0)
  assert.deepEqual(JSON.parse(result.stdout) as unknown, {
    cli: join(root, 'installed/context-central/bin/context-central'),
    args: ['resolve', 'PROJ-12', '--max', '3'],
  })
})

test('the launcher runs a copy installed from another marketplace, such as the repository itself', () => {
  const root = machine()
  install(root, join(root, 'config'), undefined, 'context-central@context-central')

  const result = launch(root, ['index'], { CLAUDE_CONFIG_DIR: join(root, 'config') })

  assert.equal(result.code, 0)
  assert.deepEqual(JSON.parse(result.stdout) as unknown, { cli: join(root, 'installed/context-central/bin/context-central'), args: ['index'] })
})

test("with the plugin installed under both ids, the launcher runs the copy from its author's marketplace, though the other is recorded first", () => {
  const root = machine()
  const plugins = {
    'context-central@context-central': [{ scope: 'user', installPath: join(root, 'elsewhere'), version: '0.13.0' }],
    'context-central@azamkhanuk': [{ scope: 'user', installPath: join(root, 'installed/context-central'), version: '0.14.0' }],
  }
  mkdirSync(join(root, 'config/plugins'), { recursive: true })
  writeFileSync(join(root, 'config/plugins/installed_plugins.json'), `${JSON.stringify({ version: 2, plugins }, null, 2)}\n`)

  const result = launch(root, ['index'], { CLAUDE_CONFIG_DIR: join(root, 'config') })

  assert.equal(result.code, 0)
  assert.deepEqual(JSON.parse(result.stdout) as unknown, { cli: join(root, 'installed/context-central/bin/context-central'), args: ['index'] })
})

const NODE_TO_SH = notOnWindows('Windows reads arguments again between Node and sh, so the Git Bash step of the checks shows this there')

test('the launcher passes every argument through unchanged', NODE_TO_SH, () => {
  const root = machine()
  install(root, join(root, 'config'))

  const result = launch(root, ['resolve', 'two words', '', '*', "it's", '--max', '3'], { CLAUDE_CONFIG_DIR: join(root, 'config') })

  assert.equal(result.code, 0)
  assert.deepEqual(JSON.parse(result.stdout) as unknown, {
    cli: join(root, 'installed/context-central/bin/context-central'),
    args: ['resolve', 'two words', '', '*', "it's", '--max', '3'],
  })
})

test('the launcher looks in ~/.claude when no config dir is set', () => {
  const root = machine()
  install(root, join(root, 'home/.claude'))

  const result = launch(root, ['index'], {})

  assert.deepEqual(JSON.parse(result.stdout) as unknown, { cli: join(root, 'installed/context-central/bin/context-central'), args: ['index'] })
})

test('CONTEXT_CENTRAL_CLI wins over the installed plugin', () => {
  const root = machine()
  install(root, join(root, 'config'))

  const result = launch(root, ['index'], { CLAUDE_CONFIG_DIR: join(root, 'config'), CONTEXT_CENTRAL_CLI: join(root, 'elsewhere/bin/context-central') })

  assert.deepEqual(JSON.parse(result.stdout) as unknown, { cli: join(root, 'elsewhere/bin/context-central'), args: ['index'] })
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
  assert.match(result.stderr, /claude plugin marketplace add azamkhanuk\/claude-plugins, then: claude plugin install context-central@azamkhanuk/)
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

test('without node on the PATH the launcher says so and exits 1', notOnWindows('Windows has no /bin/sh; the cmd launcher is tested for the same message there'), () => {
  const root = machine()
  const result = spawnSync('/bin/sh', [join(root, 'launcher/context-central'), 'index'], {
    encoding: 'utf8',
    env: { PATH: join(root, 'launcher'), HOME: join(root, 'home'), CONTEXT_CENTRAL_CLI: join(root, 'elsewhere/bin/context-central') },
  })

  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'context-central: node was not found on the PATH. Install Node 22.18 or later.\n')
})

test('an installed list without this plugin counts as nothing installed', () => {
  const root = machine()
  mkdirSync(join(root, 'config/plugins'), { recursive: true })
  writeFileSync(join(root, 'config/plugins/installed_plugins.json'), '{ "version": 2, "plugins": { "other-plugin@some-market": [{ "installPath": "/nowhere" }] } }\n')

  const result = launch(root, ['index'], { CLAUDE_CONFIG_DIR: join(root, 'config') })

  assert.equal(result.code, 1)
  assert.match(result.stderr, /the plugin was not found/)
})

type OtherHostInstall = { name?: unknown, marketplace?: unknown, cache_path?: unknown, enabled?: unknown }

const RECORD_HEAD = '// User settings belong in settings.json.\n// This file is managed automatically.\n'
const fromAuthor = (root: string, extra: OtherHostInstall = {}) => ({ name: 'context-central', marketplace: 'azamkhanuk', version: '0.22.0', cache_path: join(root, 'installed/context-central'), enabled: true, ...extra })

function installOnOtherHost(home: string, installedPlugins: unknown, head = RECORD_HEAD) {
  mkdirSync(home, { recursive: true })
  writeFileSync(join(home, 'config.json'), `${head}${JSON.stringify({ firstLaunchAt: '2026-01-15T12:00:00Z', installedPlugins }, null, 2)}\n`)
}

test('with no copy on record for Claude Code, the launcher runs the copy another host installed, though that host opens its record with comment lines', () => {
  const root = machine()
  installOnOtherHost(join(root, 'home/.copilot'), [{ name: 'other-plugin', marketplace: 'some-market', cache_path: join(root, 'installed/other-plugin'), enabled: true }, fromAuthor(root)])

  const result = launch(root, ['resolve', 'PROJ-12'], {})

  assert.equal(result.stderr, '')
  assert.deepEqual(JSON.parse(result.stdout) as unknown, { cli: join(root, 'installed/context-central/bin/context-central'), args: ['resolve', 'PROJ-12'] })
})

test("the launcher reads the other host's record in the folder that host's own variable names", () => {
  const root = machine()
  installOnOtherHost(join(root, 'kept elsewhere'), [fromAuthor(root)], '')

  const result = launch(root, ['index'], { COPILOT_HOME: join(root, 'kept elsewhere') })

  assert.deepEqual(JSON.parse(result.stdout) as unknown, { cli: join(root, 'installed/context-central/bin/context-central'), args: ['index'] })
})

test("a copy on record for Claude Code is run before the other host's", () => {
  const root = machine()
  install(root, join(root, 'home/.claude'))
  installOnOtherHost(join(root, 'home/.copilot'), [fromAuthor(root, { cache_path: join(root, 'elsewhere') })])

  const result = launch(root, ['index'], {})

  assert.deepEqual(JSON.parse(result.stdout) as unknown, { cli: join(root, 'installed/context-central/bin/context-central'), args: ['index'] })
})

test("of two copies the other host holds, the launcher runs the one from its author's marketplace, though the other is recorded first", () => {
  const root = machine()
  installOnOtherHost(join(root, 'home/.copilot'), [fromAuthor(root, { marketplace: 'context-central', cache_path: join(root, 'elsewhere') }), fromAuthor(root)])

  const result = launch(root, ['index'], {})

  assert.deepEqual(JSON.parse(result.stdout) as unknown, { cli: join(root, 'installed/context-central/bin/context-central'), args: ['index'] })
})

test("a copy on the other host's record that does not say whether it is on is taken, and so is one on a record that opens with a byte-order mark", () => {
  const root = machine()
  installOnOtherHost(join(root, 'home/.copilot'), [{ name: 'context-central', marketplace: 'azamkhanuk', cache_path: join(root, 'installed/context-central') }])
  const marked = machine()
  installOnOtherHost(join(marked, 'home/.copilot'), [fromAuthor(marked)], '\uFEFF')

  assert.deepEqual(JSON.parse(launch(root, ['index'], {}).stdout) as unknown, { cli: join(root, 'installed/context-central/bin/context-central'), args: ['index'] })
  assert.deepEqual(JSON.parse(launch(marked, ['index'], {}).stdout) as unknown, { cli: join(marked, 'installed/context-central/bin/context-central'), args: ['index'] })
})

test("another plugin of the same marketplace, recorded first on the other host's record, is not taken for this one", () => {
  const root = machine()
  installOnOtherHost(join(root, 'home/.copilot'), [{ name: 'other-plugin', marketplace: 'azamkhanuk', cache_path: join(root, 'installed/other-plugin'), enabled: true }, fromAuthor(root)])

  const result = launch(root, ['index'], {})

  assert.equal(result.stderr, '')
  assert.deepEqual(JSON.parse(result.stdout) as unknown, { cli: join(root, 'installed/context-central/bin/context-central'), args: ['index'] })
})

test("a copy recorded first on the other host's record with no folder, or with a folder that is not text, is passed over for the copy that has one", () => {
  for (const broken of [{ cache_path: undefined }, { cache_path: 7 }]) {
    const root = machine()
    installOnOtherHost(join(root, 'home/.copilot'), [fromAuthor(root, broken), fromAuthor(root)])

    const result = launch(root, ['index'], {})

    assert.equal(result.stderr, '')
    assert.deepEqual(JSON.parse(result.stdout) as unknown, { cli: join(root, 'installed/context-central/bin/context-central'), args: ['index'] })
  }
})

test('where the record for Claude Code names a folder that is gone, the copy the other host installed is run', () => {
  const root = machine()
  install(root, join(root, 'home/.claude'), join(root, 'gone'))
  installOnOtherHost(join(root, 'home/.copilot'), [fromAuthor(root)])

  const result = launch(root, ['index'], {})

  assert.equal(result.stderr, '')
  assert.deepEqual(JSON.parse(result.stdout) as unknown, { cli: join(root, 'installed/context-central/bin/context-central'), args: ['index'] })
})

test('a copy the other host has turned off is passed over, and one whose folder is gone counts as nothing installed', () => {
  const root = machine()
  installOnOtherHost(join(root, 'home/.copilot'), [fromAuthor(root, { enabled: false }), fromAuthor(root, { marketplace: 'context-central', cache_path: join(root, 'elsewhere') })])
  const gone = machine()
  installOnOtherHost(join(gone, 'home/.copilot'), [fromAuthor(gone, { cache_path: join(gone, 'never-there') })])

  assert.deepEqual(JSON.parse(launch(root, ['index'], {}).stdout) as unknown, { cli: join(root, 'elsewhere/bin/context-central'), args: ['index'] })
  assert.match(launch(gone, ['index'], {}).stderr, /the plugin was not found/)
})

test("a record of the other host's that is not JSON, lists nothing, or lists a copy with no folder counts as nothing installed", () => {
  const records = ['not json\n', '{}\n', '{ "installedPlugins": "context-central" }\n', '{ "installedPlugins": [null, 7, { "name": "context-central" }, { "name": "context-central", "cache_path": 7 }] }\n']

  for (const record of records) {
    const root = machine()
    mkdirSync(join(root, 'home/.copilot'), { recursive: true })
    writeFileSync(join(root, 'home/.copilot/config.json'), record)

    const result = launch(root, ['index'], {})

    assert.equal(result.code, 1, record)
    assert.match(result.stderr, /the plugin was not found/, record)
  }
})

test('with nothing installed on either host the launcher says in two lines how to install on each, or to name the bin script', () => {
  const root = machine()

  const result = launch(root, ['index'], {})

  assert.deepEqual(result, {
    code: 1,
    stdout: '',
    stderr:
      'context-central: the plugin was not found. Add its marketplace with claude plugin marketplace add azamkhanuk/claude-plugins, then: claude plugin install context-central@azamkhanuk\n' +
      'On Copilot the same two commands start with copilot. Or set CONTEXT_CENTRAL_CLI to the path of its bin/context-central file.\n',
  })
})

type Install = { scope: string, installPath: string, projectPath?: string }

function estateMachine(records: (root: string) => Install[]) {
  const root = tree(
    makeTree({
      'estate/map/bin/context-central': run(['wrapper']).stdout,
      'estate/map/estate.json': { contextCentral: 1, name: 'acme' },
      'own/bin/context-central': STUB_CLI,
      'inner/bin/context-central': STUB_CLI,
      'other/bin/context-central': STUB_CLI,
      'person/bin/context-central': STUB_CLI,
      'elsewhere/.keep': '',
    }),
  )
  mkdirSync(join(root, 'config/plugins'), { recursive: true })
  writeFileSync(join(root, 'config/plugins/installed_plugins.json'), `${JSON.stringify({ version: 2, plugins: { 'context-central@azamkhanuk': records(root) } })}\n`)
  return root
}

function started(root: string, launcher = join(root, 'estate/map/bin/context-central'), cwd = root) {
  const result = spawnSync('sh', [launcher, 'index'], { cwd, encoding: 'utf8', env: { PATH, HOME: join(root, 'home'), CLAUDE_CONFIG_DIR: join(root, 'config') } })
  return result.status === 0 ? (JSON.parse(result.stdout) as { cli: string }).cli : `exit ${result.status}: ${result.stderr.split('\n')[0]}`
}

const forOther = (root: string) => ({ scope: 'local', projectPath: join(root, 'elsewhere'), installPath: join(root, 'other') })
const forEstate = (root: string) => ({ scope: 'project', projectPath: join(root, 'estate'), installPath: join(root, 'own') })
const forMap = (root: string) => ({ scope: 'local', projectPath: join(root, 'estate/map'), installPath: join(root, 'inner') })
const forPerson = (root: string) => ({ scope: 'user', installPath: join(root, 'person') })
const NOT_FOUND_LINE = 'exit 1: context-central: the plugin was not found. Add its marketplace with claude plugin marketplace add azamkhanuk/claude-plugins, then: claude plugin install context-central@azamkhanuk'

test('a launcher starts the copy installed for the project it sits in, though another project is recorded first', () => {
  const root = estateMachine(root => [forOther(root), forEstate(root), forPerson(root)])

  assert.equal(started(root), join(root, 'own/bin/context-central'))
})

test('of two projects a launcher sits in, the nearer one is taken', () => {
  const root = estateMachine(root => [forEstate(root), forMap(root)])

  assert.equal(started(root), join(root, 'inner/bin/context-central'))
})

test('with no copy for its own project, a launcher starts the one installed for the person', () => {
  const root = estateMachine(root => [forOther(root), forPerson(root)])

  assert.equal(started(root), join(root, 'person/bin/context-central'))
})

test("a launcher never starts another project's copy: with no other, the plugin is not found", () => {
  const root = estateMachine(root => [forOther(root)])

  assert.equal(started(root), NOT_FOUND_LINE)
})

test('a record of a project folder that is no longer there is passed over, and the rest still count', () => {
  const gone = (root: string) => ({ scope: 'local', projectPath: join(root, 'removed'), installPath: join(root, 'other') })

  assert.match(started(estateMachine(root => [gone(root), forEstate(root)])), /own[\\/]bin[\\/]context-central$/)
  assert.match(started(estateMachine(root => [gone(root), forPerson(root)])), /person[\\/]bin[\\/]context-central$/)
})

test('a launcher goes by where its own file is, not by the folder it is run from', () => {
  const root = estateMachine(root => [forOther(root), forEstate(root)])

  assert.equal(started(root, join(root, 'estate/map/bin/context-central'), join(root, 'elsewhere')), join(root, 'own/bin/context-central'))
  assert.equal(started(root, 'context-central', join(root, 'estate/map/bin')), join(root, 'own/bin/context-central'))
})

test('a launcher reached through a link is followed to its own file', notOnWindows('making a link needs a right that a Windows account may not have'), () => {
  const root = estateMachine(root => [forOther(root), forEstate(root)])
  mkdirSync(join(root, 'elsewhere/bin'))
  symlinkSync(join(root, 'estate/map/bin/context-central'), join(root, 'elsewhere/bin/context-central'))

  assert.equal(started(root, join(root, 'elsewhere/bin/context-central')), join(root, 'own/bin/context-central'))
})

const CMD = onlyOnWindows('only Windows has cmd and PowerShell to run the cmd launcher')
const SYSTEM32 = join(process.env.SystemRoot ?? '', 'System32')
const NOT_FOUND =
  'context-central: the plugin was not found. Add its marketplace with claude plugin marketplace add azamkhanuk/claude-plugins, then: claude plugin install context-central@azamkhanuk\r\n' +
  'On Copilot the same two commands start with copilot. Or set CONTEXT_CENTRAL_CLI to the path of its bin/context-central file.\r\n'

function cmdMachine() {
  const root = machine()
  run(['wrapper', '--write'], { cwd: join(root, 'map') })
  return root
}

const cmdLauncher = (root: string) => `"${join(root, 'map', 'bin', 'context-central.cmd')}"`
const withNode = (root: string) => [join(root, 'map', 'bin'), dirname(process.execPath), SYSTEM32]

function cmd(root: string, line: string, env?: Env, { path = withNode(root), ownConsole = false, delayedExpansion = false }: { path?: string[], ownConsole?: boolean, delayedExpansion?: boolean } = {}) {
  const result = spawnSync(process.env.ComSpec as string, [...(delayedExpansion ? ['/v:on'] : []), '/d', '/s', '/c', `"${line}"`], {
    cwd: root,
    encoding: 'utf8',
    windowsVerbatimArguments: true,
    windowsHide: ownConsole,
    env: { PATH: path.join(delimiter), PATHEXT: process.env.PATHEXT, USERPROFILE: join(root, 'home'), ...env },
  })
  return { code: result.status, stdout: result.stdout, stderr: result.stderr }
}

test('the cmd launcher runs the plugin the install record names and passes every argument through unchanged', CMD, () => {
  const root = cmdMachine()
  install(root, join(root, 'config'))

  const result = cmd(root, `${cmdLauncher(root)} resolve "two words" "" * it's --max 3`, { CLAUDE_CONFIG_DIR: join(root, 'config') })

  assert.equal(result.stderr, '')
  assert.equal(result.code, 0)
  assert.deepEqual(JSON.parse(result.stdout) as unknown, {
    cli: join(root, 'installed/context-central/bin/context-central'),
    args: ['resolve', 'two words', '', '*', "it's", '--max', '3'],
  })
})

test('the cmd launcher looks in .claude under the profile folder when no config dir is set', CMD, () => {
  const root = cmdMachine()
  install(root, join(root, 'home/.claude'))

  const result = cmd(root, `${cmdLauncher(root)} index`, {})

  assert.deepEqual(JSON.parse(result.stdout) as unknown, { cli: join(root, 'installed/context-central/bin/context-central'), args: ['index'] })
})

function installUnderProfile(root: string, folder: string) {
  const profile = join(root, folder)
  const installPath = join(profile, '.claude', 'plugins', 'cache', 'context-central')
  mkdirSync(join(installPath, 'bin'), { recursive: true })
  writeFileSync(join(installPath, 'bin', 'context-central'), STUB_CLI)
  install(root, join(profile, '.claude'), installPath)
  return { profile, cli: join(installPath, 'bin', 'context-central') }
}

test('in a console on code page 437 the cmd launcher finds a plugin installed under a profile folder with a letter outside ASCII', CMD, () => {
  const root = cmdMachine()
  const { profile, cli } = installUnderProfile(root, 'café')

  const result = cmd(root, `chcp 437 >nul && ${cmdLauncher(root)} index`, { USERPROFILE: profile }, { ownConsole: true })

  assert.equal(result.stderr, '')
  assert.deepEqual(JSON.parse(result.stdout) as unknown, { cli, args: ['index'] })
})

test('the cmd launcher finds a plugin installed under a profile folder with a space in its name', CMD, () => {
  const root = cmdMachine()
  const { profile, cli } = installUnderProfile(root, 'two words')

  const result = cmd(root, `${cmdLauncher(root)} index`, { USERPROFILE: profile })

  assert.equal(result.stderr, '')
  assert.deepEqual(JSON.parse(result.stdout) as unknown, { cli, args: ['index'] })
})

test('with delayed expansion on in cmd, the cmd launcher finds a plugin installed under a profile folder with an exclamation mark', CMD, () => {
  const root = cmdMachine()
  const { profile, cli } = installUnderProfile(root, 'wow!')

  const result = cmd(root, `${cmdLauncher(root)} index`, { USERPROFILE: profile }, { delayedExpansion: true })

  assert.equal(result.stderr, '')
  assert.deepEqual(JSON.parse(result.stdout) as unknown, { cli, args: ['index'] })
})

test('CONTEXT_CENTRAL_CLI wins over the installed plugin in the cmd launcher too', CMD, () => {
  const root = cmdMachine()
  install(root, join(root, 'config'))

  const result = cmd(root, `${cmdLauncher(root)} index`, { CLAUDE_CONFIG_DIR: join(root, 'config'), CONTEXT_CENTRAL_CLI: join(root, 'elsewhere/bin/context-central') })

  assert.deepEqual(JSON.parse(result.stdout) as unknown, { cli: join(root, 'elsewhere/bin/context-central'), args: ['index'] })
})

test('the exit code of the CLI is the exit code of the cmd launcher', CMD, () => {
  const root = cmdMachine()
  writeFileSync(join(root, 'elsewhere/bin/context-central'), 'process.exitCode = 2\n')

  const result = cmd(root, `${cmdLauncher(root)} nonsense`, { CONTEXT_CENTRAL_CLI: join(root, 'elsewhere/bin/context-central') })

  assert.equal(result.code, 2)
})

test('with nothing installed the cmd launcher prints the same two lines and exits 1', CMD, () => {
  const root = cmdMachine()

  const result = cmd(root, `${cmdLauncher(root)} index`, {})

  assert.deepEqual(result, { code: 1, stdout: '', stderr: NOT_FOUND })
})

test('the cmd launcher runs the copy another host installed where Claude Code has none on record, from the profile folder or the folder that host names', CMD, () => {
  const root = cmdMachine()
  installOnOtherHost(join(root, 'home/.copilot'), [fromAuthor(root)])
  const named = cmdMachine()
  installOnOtherHost(join(named, 'kept elsewhere'), [fromAuthor(named)])

  const result = cmd(root, `${cmdLauncher(root)} index`, {})
  const fromNamed = cmd(named, `${cmdLauncher(named)} index`, { COPILOT_HOME: join(named, 'kept elsewhere') })

  assert.equal(result.stderr, '')
  assert.deepEqual(JSON.parse(result.stdout) as unknown, { cli: join(root, 'installed/context-central/bin/context-central'), args: ['index'] })
  assert.deepEqual(JSON.parse(fromNamed.stdout) as unknown, { cli: join(named, 'installed/context-central/bin/context-central'), args: ['index'] })
})

test('where the record for Claude Code names a folder that is gone, the cmd launcher runs the copy the other host installed', CMD, () => {
  const root = cmdMachine()
  install(root, join(root, 'home/.claude'), join(root, 'gone'))
  installOnOtherHost(join(root, 'home/.copilot'), [fromAuthor(root)])

  const result = cmd(root, `${cmdLauncher(root)} index`, {})

  assert.equal(result.stderr, '')
  assert.deepEqual(JSON.parse(result.stdout) as unknown, { cli: join(root, 'installed/context-central/bin/context-central'), args: ['index'] })
})

test('the cmd launcher counts an install record it cannot use as nothing installed', CMD, () => {
  const gone = cmdMachine()
  install(gone, join(gone, 'config'))
  rmSync(join(gone, 'installed'), { recursive: true })
  const unreadable = cmdMachine()
  mkdirSync(join(unreadable, 'config/plugins'), { recursive: true })
  writeFileSync(join(unreadable, 'config/plugins/installed_plugins.json'), 'not json\n')
  const without = cmdMachine()
  mkdirSync(join(without, 'config/plugins'), { recursive: true })
  writeFileSync(join(without, 'config/plugins/installed_plugins.json'), '{ "version": 2, "plugins": { "other-plugin@some-market": [{ "installPath": "/nowhere" }] } }\n')

  for (const root of [gone, unreadable, without]) {
    const result = cmd(root, `${cmdLauncher(root)} index`, { CLAUDE_CONFIG_DIR: join(root, 'config') })

    assert.deepEqual(result, { code: 1, stdout: '', stderr: NOT_FOUND })
  }
})

test('without node on the PATH the cmd launcher says so and exits 1', CMD, () => {
  const root = cmdMachine()

  const result = cmd(root, `${cmdLauncher(root)} index`, { CONTEXT_CENTRAL_CLI: join(root, 'elsewhere/bin/context-central') }, { path: [SYSTEM32] })

  assert.deepEqual(result, { code: 1, stdout: '', stderr: 'context-central: node was not found on the PATH. Install Node 22.18 or later.\r\n' })
})

const ARGS_THEN_EXIT_2 = 'console.log(JSON.stringify(process.argv.slice(2)))\nprocess.exitCode = 2\n'

test('in cmd the bare name runs the cmd launcher and its exit code comes back', CMD, () => {
  const root = cmdMachine()
  writeFileSync(join(root, 'elsewhere/bin/context-central'), ARGS_THEN_EXIT_2)

  const result = cmd(root, 'context-central work list', { CONTEXT_CENTRAL_CLI: join(root, 'elsewhere/bin/context-central') })

  assert.deepEqual(result, { code: 2, stdout: '["work","list"]\n', stderr: '' })
})

test('in Windows PowerShell the bare name runs the cmd launcher and its exit code comes back', CMD, () => {
  const root = cmdMachine()
  writeFileSync(join(root, 'elsewhere/bin/context-central'), ARGS_THEN_EXIT_2)
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([name]) => name.toUpperCase() !== 'PATH'))

  const result = spawnSync(join(SYSTEM32, 'WindowsPowerShell', 'v1.0', 'powershell.exe'), ['-NoProfile', '-NonInteractive', '-Command', 'context-central work list; exit $LASTEXITCODE'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...inherited, PATH: withNode(root).join(delimiter), CONTEXT_CENTRAL_CLI: join(root, 'elsewhere/bin/context-central') },
  })

  assert.equal(result.stderr, '')
  assert.equal(result.stdout.trim(), '["work","list"]')
  assert.equal(result.status, 2)
})
