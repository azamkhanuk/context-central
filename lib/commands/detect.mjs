import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { PluginError } from '../errors.mjs'
import { DEFAULT_NODE_DIRS, findEstate } from '../estate.mjs'
import { describeFile } from '../instructions.mjs'
import { claudeConfigDir, ghAccounts, onPath } from '../machine.mjs'
import { formatBytes, plural } from '../text.mjs'

export const summary = 'Report what a folder already holds: checkouts, instruction files, key patterns, tools'

const INSTRUCTION_FILES = ['CLAUDE.md', 'CLAUDE.local.md', 'AGENTS.md']
const GLOSSARY_NAMES = ['context.md', 'glossary.md']
const SKIPPED_FOLDERS = ['.git', 'node_modules']
const KEY = /\b([A-Z][A-Z0-9]+)-\d+\b/g
const MAX_EXAMPLES = 3

export function run(args, io) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { json: { type: 'boolean' } } })
  const dir = resolve(io.cwd, positionals[0] ?? '.')
  if (!isFolder(dir)) throw new PluginError(`${dir} is not a folder`)
  const facts = detect(dir, io.env)
  io.out(values.json ? JSON.stringify(facts, null, 2) : describe(facts).join('\n'))
}

function detect(dir, env) {
  const places = [{ rel: '', abs: dir, names: namesIn(dir) }, ...subfolders(dir)]
  const ask = git(env)
  const checkouts = places.filter(place => place.names.includes('.git'))
  return {
    dir,
    existingMap: findEstate(dir),
    repos: checkouts.map(place => describeRepo(place, ask)),
    instructionFiles: places.flatMap(place => filesNamed(place, name => INSTRUCTION_FILES.includes(name), INSTRUCTION_FILES)).map(sized),
    nodeDirs: DEFAULT_NODE_DIRS.filter(name => isFolder(join(dir, name))).sort(),
    keyCandidates: keyCandidates([...workNames(dir), ...checkouts.flatMap(place => branchNames(place, ask))]),
    mcpServers: places.flatMap(mcpServers),
    tools: { git: Boolean(onPath('git', env)), gh: Boolean(onPath('gh', env)), acli: Boolean(onPath('acli', env)) },
    ghAccounts: ghAccounts(env),
    configDir: claudeConfigDir(env),
    glossaryCandidates: places.flatMap(place => filesNamed(place, name => GLOSSARY_NAMES.includes(name.toLowerCase()))).map(file => file.rel),
  }
}

function subfolders(dir) {
  return namesIn(dir)
    .filter(name => !SKIPPED_FOLDERS.includes(name) && isFolder(join(dir, name)))
    .map(name => ({ rel: name, abs: join(dir, name), names: namesIn(join(dir, name)) }))
}

function namesIn(dir) {
  try {
    return readdirSync(dir).sort()
  } catch {
    return []
  }
}

function isFolder(path) {
  return existsSync(path) && statSync(path).isDirectory()
}

function filesNamed(place, wanted, order = place.names) {
  return place.names
    .filter(wanted)
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map(name => ({ rel: place.rel ? `${place.rel}/${name}` : name, abs: join(place.abs, name) }))
    .filter(file => isFile(file.abs))
}

function isFile(path) {
  return existsSync(path) && statSync(path).isFile()
}

function sized({ rel, abs }) {
  const { bytes, lines } = describeFile(abs)
  return { rel, bytes, lines }
}

function git(env) {
  const path = onPath('git', env)
  return (cwd, ...args) => {
    if (!path) return null
    const result = spawnSync(path, ['-C', cwd, ...args], { env, encoding: 'utf8' })
    return result.status === 0 ? result.stdout.trim() : null
  }
}

function describeRepo(place, ask) {
  const originHead = ask(place.abs, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD')
  return {
    name: basename(place.abs),
    path: place.rel || '.',
    ...parseRemote(ask(place.abs, 'remote', 'get-url', 'origin')),
    defaultBranch: originHead ? originHead.replace(/^origin\//, '') : null,
    currentBranch: ask(place.abs, 'branch', '--show-current') || null,
  }
}

function parseRemote(url) {
  if (!url) return { remote: null, host: null, org: null }
  const scp = /^[^@/\s]+@([^:/]+):(.+)$/.exec(url)
  if (scp) return { remote: url, host: scp[1], org: firstSegment(scp[2]) }
  try {
    const parsed = new URL(url)
    parsed.password = ''
    if (parsed.protocol.startsWith('http')) parsed.username = ''
    return { remote: parsed.href, host: parsed.hostname, org: firstSegment(parsed.pathname) }
  } catch {
    return { remote: url, host: null, org: null }
  }
}

function firstSegment(path) {
  return path.split('/').filter(Boolean)[0] ?? null
}

function workNames(dir) {
  return namesIn(join(dir, 'work'))
}

function branchNames(place, ask) {
  const local = ask(place.abs, 'for-each-ref', '--format=%(refname:lstrip=2)', 'refs/heads') ?? ''
  const remote = ask(place.abs, 'for-each-ref', '--format=%(refname:lstrip=3)', 'refs/remotes') ?? ''
  return [...new Set(`${local}\n${remote}`.split('\n').filter(Boolean))]
}

function keyCandidates(names) {
  const prefixes = new Map()
  for (const name of names) {
    for (const [key, prefix] of name.matchAll(KEY)) {
      const held = prefixes.get(prefix) ?? { seen: 0, examples: new Set() }
      held.seen += 1
      held.examples.add(key)
      prefixes.set(prefix, held)
    }
  }
  return [...prefixes]
    .map(([prefix, { seen, examples }]) => ({ pattern: `${prefix}-\\d+`, seen, examples: [...examples].slice(0, MAX_EXAMPLES) }))
    .sort((a, b) => b.seen - a.seen || a.pattern.localeCompare(b.pattern))
}

function mcpServers(place) {
  return filesNamed(place, name => name === '.mcp.json').flatMap(file => {
    try {
      return [{ file: file.rel, names: Object.keys(JSON.parse(readFileSync(file.abs, 'utf8')).mcpServers ?? {}) }]
    } catch {
      return []
    }
  })
}

function describe(facts) {
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
    `gh accounts: ${inline(facts.ghAccounts.map(account => (account.active ? `${account.user} (active)` : account.user)))}`,
    `Config dir: ${facts.configDir}`,
    `Glossary candidates: ${inline(facts.glossaryCandidates)}`,
  ]
}

function describeRepoLine(repo) {
  const remote = repo.remote ?? 'no remote'
  const base = repo.defaultBranch ? `default branch ${repo.defaultBranch}` : 'default branch unknown'
  const current = repo.currentBranch ? `on ${repo.currentBranch}` : 'no branch checked out'
  return `${repo.name} (${repo.path}) ${remote}, ${base}, ${current}`
}

function listed(label, lines) {
  if (lines.length === 0) return [`${label}: none`]
  return [`${label} (${lines.length}):`, ...lines.map(line => `- ${line}`)]
}

function inline(items) {
  return items.length > 0 ? items.join(', ') : 'none'
}
