import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { PluginError } from '../errors.mts'
import { DEFAULT_NODE_DIRS, findEstate } from '../estate.mts'
import { describeFile } from '../instructions.mts'
import { accountsOf, claudeConfigDir, onPath } from '../machine.mts'
import { PRESETS } from '../presets.mts'
import { formatBytes, plural } from '../text.mts'
import type { Env, Io } from '../cli.mts'
import type { Entry, Preset } from '../presets.mts'

interface Place {
  rel: string
  abs: string
  names: string[]
}

type Ask = (cwd: string, ...args: string[]) => string | null

type Facts = ReturnType<typeof detect>

type RepoFacts = ReturnType<typeof describeRepo>

export const summary = 'Report what a folder already holds: checkouts, instruction files, key patterns, tools'

const INSTRUCTION_FILES = ['CLAUDE.md', 'CLAUDE.local.md', 'AGENTS.md']
const GLOSSARY_NAMES = ['context.md', 'glossary.md']
const SKIPPED_FOLDERS = ['.git', 'node_modules']
const KEY = /\b([A-Z][A-Z0-9]+)-\d+\b/g
const MAX_EXAMPLES = 3

export function run(args: string[], io: Io) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { json: { type: 'boolean' } } })
  const dir = resolve(io.cwd, positionals[0] ?? '.')
  if (!isFolder(dir)) throw new PluginError(`${dir} is not a folder`)
  const facts = detect(dir, io.env)
  io.out(values.json ? JSON.stringify(facts, null, 2) : describe(facts).join('\n'))
}

function detect(dir: string, env: Env) {
  const places = [{ rel: '', abs: dir, names: namesIn(dir) }, ...subfolders(dir)]
  const ask = git(env)
  const checkouts = places.filter(place => place.names.includes('.git'))
  const repos = checkouts.map(place => describeRepo(place, ask))
  const tools = { git: Boolean(onPath('git', env)), ...Object.fromEntries(PRESETS.map(preset => [preset.program, Boolean(onPath(preset.program, env))])) }
  return {
    dir,
    existingMap: findEstate(dir),
    repos,
    instructionFiles: places.flatMap(place => filesNamed(place, name => INSTRUCTION_FILES.includes(name), INSTRUCTION_FILES)).map(sized),
    nodeDirs: DEFAULT_NODE_DIRS.filter(name => isFolder(join(dir, name))).sort(),
    keyCandidates: keyCandidates([...workNames(dir), ...checkouts.flatMap(place => branchNames(place, ask))]),
    mcpServers: places.flatMap(mcpServers),
    tools,
    accounts: Object.fromEntries(PRESETS.filter(preset => preset.accounts).map(preset => [preset.name, accountsOf(preset, env)])),
    connectionCandidates: PRESETS.flatMap(preset => candidatesOf(preset, repos, tools)),
    configDir: claudeConfigDir(env),
    glossaryCandidates: places.flatMap(place => filesNamed(place, name => GLOSSARY_NAMES.includes(name.toLowerCase()))).map(file => file.rel),
  }
}

function subfolders(dir: string): Place[] {
  return namesIn(dir)
    .filter(name => !SKIPPED_FOLDERS.includes(name) && isFolder(join(dir, name)))
    .map(name => ({ rel: name, abs: join(dir, name), names: namesIn(join(dir, name)) }))
}

function namesIn(dir: string) {
  try {
    return readdirSync(dir).sort()
  } catch {
    return []
  }
}

function isFolder(path: string) {
  return existsSync(path) && statSync(path).isDirectory()
}

function filesNamed(place: Place, wanted: (name: string) => boolean, order = place.names) {
  return place.names
    .filter(wanted)
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map(name => ({ rel: place.rel ? `${place.rel}/${name}` : name, abs: join(place.abs, name) }))
    .filter(file => isFile(file.abs))
}

function isFile(path: string) {
  return existsSync(path) && statSync(path).isFile()
}

function sized({ rel, abs }: { rel: string; abs: string }) {
  const { bytes, lines } = describeFile(abs)
  return { rel, bytes, lines }
}

function git(env: Env): Ask {
  const path = onPath('git', env)
  return (cwd, ...args) => {
    if (!path) return null
    const result = spawnSync(path, ['-C', cwd, ...args], { env, encoding: 'utf8' })
    return result.status === 0 ? result.stdout.trim() : null
  }
}

function describeRepo(place: Place, ask: Ask) {
  const originHead = ask(place.abs, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD')
  return {
    name: basename(place.abs),
    path: place.rel || '.',
    ...readRemote(ask(place.abs, 'remote', 'get-url', 'origin')),
    defaultBranch: originHead ? originHead.replace(/^origin\//, '') : null,
    currentBranch: ask(place.abs, 'branch', '--show-current') || null,
  }
}

function readRemote(url: string | null) {
  const { remote, host } = parseRemote(url)
  const { org = null, ...parts } = remote ? partsBy(recognising(remote), remote) : {}
  return { remote, host, system: (remote && recognising(remote)?.name) ?? null, org, ...parts }
}

function recognising(remote: string) {
  return PRESETS.find(preset => preset.remote?.(remote)) ?? null
}

function partsBy(preset: Preset | null, remote: string): Entry {
  return Object.fromEntries(Object.entries(preset?.remote?.(remote) ?? {}).filter(([part]) => part !== 'repo'))
}

function candidatesOf(preset: Preset, repos: RepoFacts[], tools: Record<string, boolean>) {
  const read = repos.filter(repo => repo.system === preset.name).map(repo => partsBy(preset, repo.remote ?? ''))
  if (read.length === 0 && !tools[preset.program]) return []
  const agreed = Object.fromEntries(Object.entries(read[0] ?? {}).filter(([part, value]) => read.every(parts => parts[part] === value)))
  const because = read.length > 0 ? 'a remote reads as it' : 'its tool is on the PATH'
  return Object.keys(preset.kinds).map(holds => ({ preset: preset.name, holds, because, entry: { holds, preset: preset.name, ...agreed } }))
}

function parseRemote(url: string | null) {
  if (!url) return { remote: null, host: null }
  const scp = /^[^@/\s]+@([^:/]+):(.+)$/.exec(url)
  if (scp) return { remote: url, host: scp[1] }
  try {
    const parsed = new URL(url)
    parsed.password = ''
    if (parsed.protocol.startsWith('http')) parsed.username = ''
    return { remote: parsed.href, host: parsed.hostname }
  } catch {
    return { remote: url, host: null }
  }
}

function workNames(dir: string) {
  return namesIn(join(dir, 'work'))
}

function branchNames(place: Place, ask: Ask) {
  const local = ask(place.abs, 'for-each-ref', '--format=%(refname:lstrip=2)', 'refs/heads') ?? ''
  const remote = ask(place.abs, 'for-each-ref', '--format=%(refname:lstrip=3)', 'refs/remotes') ?? ''
  return [...new Set(`${local}\n${remote}`.split('\n').filter(Boolean))]
}

function keyCandidates(names: string[]) {
  const prefixes = new Map<string, { seen: number; examples: Set<string> }>()
  for (const name of names) {
    for (const [key, prefix] of name.matchAll(KEY)) {
      const held = prefixes.get(prefix) ?? { seen: 0, examples: new Set<string>() }
      held.seen += 1
      held.examples.add(key)
      prefixes.set(prefix, held)
    }
  }
  return [...prefixes]
    .map(([prefix, { seen, examples }]) => ({ pattern: `${prefix}-\\d+`, seen, examples: [...examples].slice(0, MAX_EXAMPLES) }))
    .sort((a, b) => b.seen - a.seen || a.pattern.localeCompare(b.pattern))
}

function mcpServers(place: Place) {
  return filesNamed(place, name => name === '.mcp.json').flatMap(file => {
    try {
      return [{ file: file.rel, names: Object.keys((JSON.parse(readFileSync(file.abs, 'utf8')) as { mcpServers?: Record<string, unknown> }).mcpServers ?? {}) }]
    } catch {
      return []
    }
  })
}

function describe(facts: Facts) {
  return [
    `Folder: ${facts.dir}`,
    `Existing map: ${facts.existingMap ? `${facts.existingMap.configPath} (${facts.existingMap.layout} layout)` : 'none'}`,
    ...listed('Repos', facts.repos.map(describeRepoLine)),
    ...listed(
      'Instruction files',
      facts.instructionFiles.map(file => `${file.rel} (${formatBytes(file.bytes)}, ${plural(file.lines, 'line')})`),
    ),
    `Node folders: ${inline(facts.nodeDirs)}`,
    ...listed(
      'Key candidates',
      facts.keyCandidates.map(key => `${key.pattern} seen ${plural(key.seen, 'time')}, for example ${key.examples.join(', ')}`),
    ),
    ...listed(
      'MCP servers',
      facts.mcpServers.map(found => `${found.file}: ${inline(found.names)}`),
    ),
    `Tools: ${Object.entries(facts.tools)
      .map(([name, present]) => `${name} ${present ? 'yes' : 'no'}`)
      .join(', ')}`,
    ...Object.entries(facts.accounts).map(([preset, accounts]) => `Accounts (${preset}): ${inline(accounts.map(account => (account.active ? `${account.user} (active)` : account.user)))}`),
    ...listed(
      'Connection candidates',
      facts.connectionCandidates.map(({ preset, holds, because, entry }) => `${[`${holds} by preset ${preset}`, ...Object.entries(entry).filter(([key]) => key !== 'holds' && key !== 'preset').map(([key, value]) => `${key} ${String(value)}`)].join(', ')}: ${because}`),
    ),
    `Config dir: ${facts.configDir}`,
    `Glossary candidates: ${inline(facts.glossaryCandidates)}`,
  ]
}

function describeRepoLine(repo: RepoFacts) {
  const remote = repo.remote ?? 'no remote'
  const base = repo.defaultBranch ? `default branch ${repo.defaultBranch}` : 'default branch unknown'
  const current = repo.currentBranch ? `on ${repo.currentBranch}` : 'no branch checked out'
  return `${repo.name} (${repo.path}) ${remote}, ${base}, ${current}`
}

function listed(label: string, lines: string[]) {
  if (lines.length === 0) return [`${label}: none`]
  return [`${label} (${lines.length}):`, ...lines.map(line => `- ${line}`)]
}

function inline(items: string[]) {
  return items.length > 0 ? items.join(', ') : 'none'
}
