import assert from 'node:assert/strict'
import { chmodSync, cpSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { test } from 'node:test'
import { REPO, acme, disposable, makeTree, notOnWindows, spawned } from './helpers.mts'

const tree = disposable()

const PACK = join(REPO, 'scripts', 'pack.mts')
const { version } = JSON.parse(readFileSync(join(REPO, '.claude-plugin', 'plugin.json'), 'utf8')) as { version: string }
const own = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as { engines: { node: string }, license: string }
const LINKS_NEED_A_RIGHT = 'a symlink needs a right that most Windows accounts lack'
const NPM_IS_A_CMD = 'npm on Windows is a .cmd file, which the tests cannot start'

const pack = (folder: string) => spawned(process.execPath, [PACK, folder])
const runAt = (bin: string, args: string[], cwd?: string) => spawned(process.execPath, [bin, ...args], { cwd })
const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]))
const commandsIn = (dir: string, ending: string) => readdirSync(dir).filter(file => file.endsWith(ending)).map(file => file.slice(0, -ending.length)).sort()

function packed() {
  const out = join(tree(makeTree({})), 'out')
  const result = pack(out)
  assert.deepEqual([result.code, result.stdout], [0, `${join(out, 'package')}\n`], result.stderr)
  return join(out, 'package')
}

function underNodeModules(from: string) {
  const at = join(tree(makeTree({})), 'node_modules', 'context-central')
  mkdirSync(join(at, '..'), { recursive: true })
  cpSync(from, at, { recursive: true })
  return at
}

test('the packed tree, copied under a node_modules folder with no link, answers --version, help, the presets it knows and a command on a map, and holds no .mts file', () => {
  const installed = underNodeModules(packed())
  const bin = join(installed, 'bin', 'context-central')
  const root = tree(acme())

  const shown = runAt(bin, ['--version'])
  const helped = runAt(bin, ['help'])
  const resolved = runAt(bin, ['resolve', 'PROJ-12', '--absolute'], root)
  const presets = runAt(bin, ['connections', '--presets'])

  assert.equal(shown.code, 0, shown.stderr)
  assert.match(shown.stdout, new RegExp(`^context-central ${version.replaceAll('.', '\\.')} \\(Node `))
  assert.equal(helped.code, 0, helped.stderr)
  assert.ok(helped.stdout.startsWith('Usage: context-central <command> [options]\n'))
  for (const name of commandsIn(join(REPO, 'lib', 'commands'), '.mts')) assert.match(helped.stdout, new RegExp(`^  ${name} `, 'm'), name)
  assert.deepEqual([resolved.code, resolved.stdout.split('\n')[0]], [0, 'Context for work item PROJ-12:'], resolved.stderr)
  assert.deepEqual(presets.stdout.trim().split('\n').map(line => line.split(' | ')[0]), commandsIn(join(REPO, 'lib', 'presets'), '.mts'))
  assert.deepEqual(walk(installed).filter(file => file.endsWith('.mts')), [])
})

test('every file of lib is in the packed tree under the same name ending .mjs, and no import there leads to a .mts file', () => {
  const folder = packed()
  const sources = walk(join(REPO, 'lib')).map(file => relative(REPO, file))
  const made = walk(join(folder, 'lib')).map(file => relative(folder, file))

  assert.deepEqual(made.sort(), sources.map(file => file.replace(/\.mts$/, '.mjs')).sort())
  for (const file of [join('lib', 'cli.mjs'), join('lib', 'commands', 'research.mjs'), join('lib', 'presets', 'github.mjs')]) assert.ok(made.includes(file), file)
  for (const file of made) assert.doesNotMatch(readFileSync(join(folder, file), 'utf8'), /\b(from|import)\s*\(?\s*['"][^'"\n]*\.mts['"]/, file)
})

test("the packed tree holds the command, the manifest, the README and the licence as they are, and a package.json of its own that npm will pack and will not publish", () => {
  const folder = packed()
  const files = walk(folder).map(file => relative(folder, file)).filter(file => !file.startsWith('lib'))

  assert.deepEqual(files.sort(), [join('.claude-plugin', 'plugin.json'), 'LICENSE', 'README.md', join('bin', 'context-central'), 'package.json'].sort())
  for (const file of [join('bin', 'context-central'), join('.claude-plugin', 'plugin.json'), 'README.md', 'LICENSE']) assert.equal(readFileSync(join(folder, file), 'utf8'), readFileSync(join(REPO, file), 'utf8'), file)
  assert.deepEqual(JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8')) as unknown, {
    name: 'context-central',
    version,
    description: (JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as { description: string }).description,
    license: own.license,
    private: true,
    engines: own.engines,
    bin: { 'context-central': 'bin/context-central' },
  })
})

test('pack is refused, in one line and with nothing written, where no folder is named or the folder is not empty', () => {
  const full = tree(makeTree({ 'kept.md': '# Kept\n' }))

  const unnamed = spawned(process.execPath, [PACK])
  const taken = pack(full)

  assert.deepEqual(unnamed, { code: 1, stdout: '', stderr: 'pack: name an empty folder to write the package into\n' })
  assert.deepEqual(taken, { code: 1, stdout: '', stderr: `pack: ${full} is not empty, so nothing was written\n` })
  assert.deepEqual(readdirSync(full), ['kept.md'])
})

test('pack is refused, in one line and with nothing written, where the folder named is a file or lies under one', () => {
  const room = tree(makeTree({ 'kept.md': '# Kept\n' }))

  assert.deepEqual(pack(join(room, 'kept.md')), { code: 1, stdout: '', stderr: `pack: ${join(room, 'kept.md')} is a file, so nothing was written\n` })
  assert.deepEqual(pack(join(room, 'kept.md', 'out')), { code: 1, stdout: '', stderr: `pack: ${join(room, 'kept.md', 'out')} lies under a file, so nothing was written\n` })
  assert.deepEqual(readdirSync(room), ['kept.md'])
})

test('pack is refused, in one line and with nothing written, where the folder named is a link that leads nowhere', notOnWindows(LINKS_NEED_A_RIGHT), () => {
  const room = tree(makeTree({}))
  symlinkSync(join(room, 'nowhere', 'out'), join(room, 'gone'))

  assert.deepEqual(pack(join(room, 'gone')), { code: 1, stdout: '', stderr: `pack: ${join(room, 'gone')} is a link that leads nowhere, so nothing was written\n` })
  assert.deepEqual(readdirSync(room), ['gone'])
})

test('pack is refused, in one line and with nothing written, where the folder named lies below a link that leads nowhere or round in a loop, in a folder nobody may write or open, or has a part longer than a disk holds', notOnWindows(LINKS_NEED_A_RIGHT), () => {
  const room = tree(makeTree({}))
  symlinkSync(join(room, 'nowhere'), join(room, 'gone'))
  symlinkSync(join(room, 'back'), join(room, 'loop'))
  symlinkSync(join(room, 'loop'), join(room, 'back'))
  mkdirSync(join(room, 'shut'))
  chmodSync(join(room, 'shut'), 0o555)
  mkdirSync(join(room, 'closed'))
  chmodSync(join(room, 'closed'), 0o000)
  const long = join(room, 'z'.repeat(300))

  assert.deepEqual(pack(join(room, 'gone', 'out')), { code: 1, stdout: '', stderr: `pack: ${join(room, 'gone', 'out')} lies below a link that leads nowhere, so nothing was written\n` })
  assert.deepEqual(pack(join(room, 'loop', 'out')), { code: 1, stdout: '', stderr: `pack: ${join(room, 'loop', 'out')} lies below a link that leads round in a loop, so nothing was written\n` })
  assert.deepEqual(pack(join(room, 'shut', 'out')), { code: 1, stdout: '', stderr: `pack: ${join(room, 'shut', 'out')} lies in a folder this user may not write, so nothing was written\n` })
  assert.deepEqual(pack(join(room, 'shut')), { code: 1, stdout: '', stderr: `pack: ${join(room, 'shut')} is a folder this user may not write, so nothing was written\n` })
  assert.deepEqual(pack(join(room, 'closed', 'out')), { code: 1, stdout: '', stderr: `pack: ${join(room, 'closed', 'out')} lies in a folder this user may not open, so nothing was written\n` })
  assert.deepEqual(pack(long), { code: 1, stdout: '', stderr: `pack: ${long} has a part longer than a disk holds, so nothing was written\n` })
  chmodSync(join(room, 'closed'), 0o755)
  chmodSync(join(room, 'shut'), 0o755)
  assert.deepEqual(readdirSync(room).sort(), ['back', 'closed', 'gone', 'loop', 'shut'])
  assert.deepEqual([readdirSync(join(room, 'shut')), readdirSync(join(room, 'closed'))], [[], []])
})

test("the checkout's own command runs through a link under a node_modules folder, as npm's install of a clone makes one", notOnWindows(LINKS_NEED_A_RIGHT), () => {
  const at = join(tree(makeTree({})), 'node_modules', 'context-central')
  mkdirSync(join(at, '..'), { recursive: true })
  symlinkSync(REPO, at, 'dir')

  const shown = runAt(join(at, 'bin', 'context-central'), ['--version'])

  assert.equal(shown.code, 0, shown.stderr)
  assert.match(shown.stdout, new RegExp(`^context-central ${version.replaceAll('.', '\\.')} \\(Node `))
})

test('npm packs the packed tree into a file, and an install from that file under a prefix of its own gives the bare command', notOnWindows(NPM_IS_A_CMD), () => {
  const from = packed()
  const room = tree(makeTree({}))
  const npm = { npm_config_cache: join(room, 'cache'), npm_config_update_notifier: 'false', npm_config_fund: 'false', npm_config_audit: 'false' }
  writeFileSync(join(room, 'note.txt'), 'npm writes nothing outside this folder\n')

  const made = spawned('npm', ['pack', from, '--pack-destination', room, '--silent'], { cwd: room, env: npm })
  const file = made.stdout.trim().split('\n').at(-1) ?? ''
  const installed = spawned('npm', ['install', '-g', join(room, file), '--prefix', join(room, 'prefix'), '--offline'], { cwd: room, env: npm })
  const shown = spawned(join(room, 'prefix', 'bin', 'context-central'), ['--version'])

  assert.deepEqual([made.code, file], [0, `context-central-${version}.tgz`], made.stderr)
  assert.equal(installed.code, 0, installed.stderr)
  assert.equal(shown.code, 0, shown.stderr)
  assert.match(shown.stdout, new RegExp(`^context-central ${version.replaceAll('.', '\\.')} \\(Node `))
})
