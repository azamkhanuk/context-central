import { spawnSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, sep } from 'node:path'
import { parseArgs } from 'node:util'
import { accountFault, listed, reachOf, whyNotStarted } from '../connections.mts'
import { PluginError } from '../errors.mts'
import { loadEstate } from '../estate.mts'
import { graphEstate } from '../graph.mts'
import { lintEstate } from '../lint.mts'
import { claudeConfigDir } from '../machine.mts'
import { hubPath, listWorkItems } from '../nodes.mts'
import { presetNamed } from '../presets.mts'
import { evidenceIgnoreRule } from '../templates.mts'
import { plural } from '../text.mts'
import type { Env, Io } from '../cli.mts'
import type { Connection } from '../connections.mts'
import type { Estate, Repo } from '../estate.mts'

interface Result {
  check: string
  ok: boolean
  fix: string | null
  note: string | null
}

interface Note {
  note: string
}

type Finding = string | Note | null | undefined

export const summary = 'Check the set-up: node, config, hub, lint, links, repos, git, evidence, hooks, connections'

const MIN_NODE = [22, 18]
const HOME_SPELLINGS = ['$HOME', '${HOME}', '~']
// Elsewhere a backslash in a hook command is an escape, not a separator.
const oneSeparator = sep === '\\' ? (text: string) => text.replaceAll('\\', '/') : (text: string) => text
const NONE_RECORDED = 'none is recorded; the plugin works without one, and one is recommended so that a session can read the ticket or the pull request behind the work'
const ESTATE_CHECKS = { hub, lint, links, repos, git, evidence, hooks, connections }

export function run(args: string[], io: Io) {
  const { values } = parseArgs({ args, options: { json: { type: 'boolean' } } })
  const results = checks(io)
  io.out(values.json ? JSON.stringify(results, null, 2) : results.map(describe).join('\n'))
  return results.every(result => result.ok) ? 0 : 1
}

function checks(io: Io) {
  const { estate, fix } = load(io)
  const first = [result('node', node(io.nodeVersion)), result('config', fix)]
  if (!estate) return first
  return [...first, ...Object.entries(ESTATE_CHECKS).map(([name, check]) => result(name, check(estate, io)))]
}

function result(check: string, finding: Finding): Result {
  if (finding && typeof finding === 'object') return { check, ok: true, fix: null, note: finding.note }
  return { check, ok: !finding, fix: finding ?? null, note: null }
}

function describe({ check, ok, fix, note }: Result) {
  if (!ok) return `FIX  ${check}: ${fix}`
  return note ? `note ${check}: ${note}` : `ok   ${check}`
}

function load(io: Io): { estate?: Estate; fix?: string } {
  try {
    const estate = loadEstate(io.cwd)
    return estate ? { estate } : { fix: `no context map found from ${io.cwd}; run context-central init or /context-central:onboard` }
  } catch (error) {
    if (!(error instanceof PluginError)) throw error
    return { fix: error.message }
  }
}

function node(version: string) {
  const [major, minor] = version.split('.').map(Number)
  if (major > MIN_NODE[0] || (major === MIN_NODE[0] && minor >= MIN_NODE[1])) return null
  return `this is Node ${version}; install Node ${MIN_NODE.join('.')} or later`
}

function hub(estate: Estate) {
  if (statSync(hubPath(estate), { throwIfNoEntry: false })?.isFile()) return null
  return `${estate.config.hub} does not exist; write it, or point "hub" in estate.json at the file that is there`
}

function lint(estate: Estate, io: Io) {
  const errors = lintEstate(estate, io.env).filter(found => found.level === 'ERROR')
  return errors.length === 0 ? null : `${plural(errors.length, 'error')}; run context-central lint`
}

function links(estate: Estate) {
  const { broken } = graphEstate(estate)
  return broken.length === 0 ? null : `${plural(broken.length, 'broken link')}; run context-central graph`
}

function repos(estate: Estate) {
  const missing = estate.config.repos.filter(repo => !repoExists(estate, repo)).map(repo => repo.path)
  return missing.length === 0 ? null : `no folder at ${missing.join(', ')}; clone there, or take the entry out of estate.json`
}

function git(estate: Estate, io: Io) {
  if (estate.layout !== 'root') return null
  const ask = (args: string[]) => spawnSync('git', args, { cwd: estate.estateRoot, env: io.env, encoding: 'utf8' })
  if (ask(['rev-parse', '--is-inside-work-tree']).stdout?.trim() !== 'true') return null
  const checkouts = estate.config.repos.filter(repo => repo.path !== '.' && repoExists(estate, repo))
  const exposed = checkouts.filter(repo => ask(['check-ignore', '-q', repo.path]).status !== 0).map(repo => repo.path)
  if (exposed.length === 0) return null
  return `${exposed.join(', ')} ${exposed.length === 1 ? 'is' : 'are'} not ignored; git add there could stage a checkout; add an allowlist .gitignore`
}

function evidence(estate: Estate, io: Io) {
  const files = listWorkItems(estate).flatMap(item => item.evidence.files.map(file => file.rel))
  if (files.length === 0) return null
  const ask = (args: string[], input?: string) => spawnSync('git', args, { cwd: estate.mapDir, env: io.env, encoding: 'utf8', input })
  if (ask(['rev-parse', '--is-inside-work-tree']).stdout?.trim() !== 'true') return null
  const ignoredWith = (flags: string[]) => new Set((ask(['check-ignore', ...flags, '-z', '--stdin'], files.join('\0')).stdout ?? '').split('\0'))
  const ignoredByGit = ignoredWith([])
  if (estate.config.evidence.commit) return committedYetIgnored(files, ignoredByGit)
  return keptOutYetNotIgnored(files, ignoredByGit, () => ignoredWith(['--no-index']), estate.config.workDir)
}

function committedYetIgnored(files: string[], ignoredByGit: Set<string>) {
  const ignored = files.filter(rel => ignoredByGit.has(rel))
  if (ignored.length === 0) return null
  return `evidence is set to be committed and git ignores ${named(ignored)}; take out the ignore rule, or set "evidence.commit" to false in estate.json`
}

function keptOutYetNotIgnored(files: string[], ignoredByGit: Set<string>, matchedByIgnoreRule: () => Set<string>, workDir: string) {
  const notIgnored = files.filter(rel => !ignoredByGit.has(rel))
  if (notIgnored.length === 0) return null
  const matched = matchedByIgnoreRule()
  const withoutRule = notIgnored.filter(rel => !matched.has(rel))
  const fix =
    withoutRule.length > 0
      ? `git does not ignore ${named(withoutRule)}; ignore ${evidenceIgnoreRule(workDir)} in the map's .gitignore`
      : `git already tracks ${named(notIgnored)}; run git rm --cached on ${notIgnored.length === 1 ? 'it' : 'each'}`
  return `evidence is set to stay out of git and ${fix}, or set "evidence.commit" to true in estate.json`
}

function named(files: string[]) {
  return files.length === 1 ? files[0] : `${files[0]} and ${files.length - 1} more`
}

function hooks(estate: Estate, io: Io) {
  const home = io.env.HOME ?? homedir()
  const estateFiles = ['settings.json', 'settings.local.json'].map(name => join(estate.estateRoot, '.claude', name))
  const legacy = (file: string) => hookCommands(file).filter(command => estate.config.legacyHooks.some(name => command.includes(name)))
  const found = [
    { file: join(claudeConfigDir(io.env), 'settings.json'), counts: (command: string) => namesPath(command, estate.estateRoot, home) },
    ...estateFiles.map(file => ({ file, counts: () => true })),
  ].flatMap(({ file, counts }) => legacy(file).filter(counts).map(command => ({ file, command })))
  if (found.length === 0) return null
  const names = estate.config.legacyHooks.filter(name => found.some(({ command }) => command.includes(name)))
  const files = [...new Set(found.map(({ file }) => file))]
  return `an older hook (${names.join(', ')}) for this estate is still set in ${files.join(', ')}; remove it so prompts are not resolved twice`
}

function connections(estate: Estate, io: Io): Finding {
  const found = listed(estate.config.connections)
  const fault = found.map(connection => accountFault(connection, io.env)).find(Boolean)
  if (fault) return fault
  if (found.length === 0) return { note: NONE_RECORDED }
  const notes = found.flatMap(connection => notesOn(connection, io.env))
  return notes.length > 0 ? { note: notes.join('; ') } : null
}

function notesOn(connection: Connection, env: Env) {
  const { name, entry } = connection
  const preset = presetNamed(entry.preset)
  if (entry.preset && !preset) return [`${name} names the preset ${entry.preset}, which this version does not carry`]
  const reach = reachOf(connection, env)
  if (!preset || !reach.missing || reach.by !== 'hand' || entry.how) return []
  return [`${name} is not reached here: ${whyNotStarted(preset, env)}`]
}

function repoExists(estate: Estate, repo: Repo) {
  return statSync(join(estate.estateRoot, repo.path), { throwIfNoEntry: false })?.isDirectory() ?? false
}

function hookCommands(file: string) {
  try {
    return commandsIn((JSON.parse(readFileSync(file, 'utf8')) as { hooks?: unknown }).hooks)
  } catch {
    return []
  }
}

function commandsIn(value: unknown): string[] {
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, held]: [string, unknown]) => (key === 'command' && typeof held === 'string' ? [held] : commandsIn(held)))
}

function namesPath(command: string, estateRoot: string, homeDir: string) {
  const [path, home] = [estateRoot, homeDir].map(oneSeparator)
  const underHome = path === home || path.startsWith(`${home}/`)
  const spellings = [path, ...(underHome ? HOME_SPELLINGS.map(written => `${written}${path.slice(home.length)}`) : [])]
  return spellings.some(spelling => new RegExp(`${spelling.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[/"'\\s]|$)`).test(oneSeparator(command)))
}
