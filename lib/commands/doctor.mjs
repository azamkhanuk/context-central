import { spawnSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, sep } from 'node:path'
import { parseArgs } from 'node:util'
import { PluginError } from '../errors.mjs'
import { loadEstate } from '../estate.mjs'
import { graphEstate } from '../graph.mjs'
import { lintEstate } from '../lint.mjs'
import { claudeConfigDir, ghAccounts, onPath } from '../machine.mjs'
import { hubPath, listWorkItems } from '../nodes.mjs'
import { evidenceIgnoreRule } from '../templates.mjs'
import { plural } from '../text.mjs'

export const summary = 'Check the set-up: node, config, hub, lint, links, repos, git, evidence, hooks, gh'

const MIN_NODE = 20
const HOME_SPELLINGS = ['$HOME', '${HOME}', '~']
// Elsewhere a backslash in a hook command is an escape, not a separator.
const oneSeparator = sep === '\\' ? text => text.replaceAll('\\', '/') : text => text
const ESTATE_CHECKS = { hub, lint, links, repos, git, evidence, hooks, gh }

export function run(args, io) {
  const { values } = parseArgs({ args, options: { json: { type: 'boolean' } } })
  const results = checks(io)
  io.out(values.json ? JSON.stringify(results, null, 2) : results.map(describe).join('\n'))
  return results.every(result => result.ok) ? 0 : 1
}

function checks(io) {
  const { estate, fix } = load(io)
  const first = [result('node', node(io.nodeVersion)), result('config', fix)]
  if (!estate) return first
  return [...first, ...Object.entries(ESTATE_CHECKS).map(([name, check]) => result(name, check(estate, io)))]
}

function result(check, fix) {
  return { check, ok: !fix, fix: fix ?? null }
}

function describe({ check, ok, fix }) {
  return ok ? `ok   ${check}` : `FIX  ${check}: ${fix}`
}

function load(io) {
  try {
    const estate = loadEstate(io.cwd)
    return estate ? { estate } : { fix: `no context map found from ${io.cwd}; run context-central init or /context-central:onboard` }
  } catch (error) {
    if (!(error instanceof PluginError)) throw error
    return { fix: error.message }
  }
}

function node(version) {
  if (Number(version.split('.')[0]) >= MIN_NODE) return null
  return `this is Node ${version}; install Node ${MIN_NODE} or later`
}

function hub(estate) {
  if (statSync(hubPath(estate), { throwIfNoEntry: false })?.isFile()) return null
  return `${estate.config.hub} does not exist; write it, or point "hub" in estate.json at the file that is there`
}

function lint(estate, io) {
  const errors = lintEstate(estate, io.env).filter(found => found.level === 'ERROR')
  return errors.length === 0 ? null : `${plural(errors.length, 'error')}; run context-central lint`
}

function links(estate) {
  const { broken } = graphEstate(estate)
  return broken.length === 0 ? null : `${plural(broken.length, 'broken link')}; run context-central graph`
}

function repos(estate) {
  const missing = estate.config.repos.filter(repo => !repoExists(estate, repo)).map(repo => repo.path)
  return missing.length === 0 ? null : `no folder at ${missing.join(', ')}; clone there, or take the entry out of estate.json`
}

function git(estate, io) {
  if (estate.layout !== 'root') return null
  const ask = args => spawnSync('git', args, { cwd: estate.estateRoot, env: io.env, encoding: 'utf8' })
  if (ask(['rev-parse', '--is-inside-work-tree']).stdout?.trim() !== 'true') return null
  const checkouts = estate.config.repos.filter(repo => repo.path !== '.' && repoExists(estate, repo))
  const exposed = checkouts.filter(repo => ask(['check-ignore', '-q', repo.path]).status !== 0).map(repo => repo.path)
  if (exposed.length === 0) return null
  return `${exposed.join(', ')} ${exposed.length === 1 ? 'is' : 'are'} not ignored; git add there could stage a checkout; add an allowlist .gitignore`
}

function evidence(estate, io) {
  const files = listWorkItems(estate).flatMap(item => item.evidence.files.map(file => file.rel))
  if (files.length === 0) return null
  const ask = (args, input) => spawnSync('git', args, { cwd: estate.mapDir, env: io.env, encoding: 'utf8', input })
  if (ask(['rev-parse', '--is-inside-work-tree']).stdout?.trim() !== 'true') return null
  const ignoredWith = flags => new Set((ask(['check-ignore', ...flags, '-z', '--stdin'], files.join('\0')).stdout ?? '').split('\0'))
  const ignoredByGit = ignoredWith([])
  if (estate.config.evidence.commit) return committedYetIgnored(files, ignoredByGit)
  return keptOutYetNotIgnored(files, ignoredByGit, () => ignoredWith(['--no-index']), estate.config.workDir)
}

function committedYetIgnored(files, ignoredByGit) {
  const ignored = files.filter(rel => ignoredByGit.has(rel))
  if (ignored.length === 0) return null
  return `evidence is set to be committed and git ignores ${named(ignored)}; take out the ignore rule, or set "evidence.commit" to false in estate.json`
}

function keptOutYetNotIgnored(files, ignoredByGit, matchedByIgnoreRule, workDir) {
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

function named(files) {
  return files.length === 1 ? files[0] : `${files[0]} and ${files.length - 1} more`
}

function hooks(estate, io) {
  const home = io.env.HOME ?? homedir()
  const estateFiles = ['settings.json', 'settings.local.json'].map(name => join(estate.estateRoot, '.claude', name))
  const legacy = file => hookCommands(file).filter(command => estate.config.legacyHooks.some(name => command.includes(name)))
  const found = [
    { file: join(claudeConfigDir(io.env), 'settings.json'), counts: command => namesPath(command, estate.estateRoot, home) },
    ...estateFiles.map(file => ({ file, counts: () => true })),
  ].flatMap(({ file, counts }) => legacy(file).filter(counts).map(command => ({ file, command })))
  if (found.length === 0) return null
  const names = estate.config.legacyHooks.filter(name => found.some(({ command }) => command.includes(name)))
  const files = [...new Set(found.map(({ file }) => file))]
  return `an older hook (${names.join(', ')}) for this estate is still set in ${files.join(', ')}; remove it so prompts are not resolved twice`
}

function gh(estate, io) {
  const { codeHost, tracker } = estate.config
  const user = codeHost?.ghUser
  if (!user && codeHost?.type !== 'github' && tracker.type !== 'github') return null
  if (!onPath('gh', io.env)) return 'gh is not on PATH; install the GitHub CLI'
  if (!user || activeAccounts(io.env).includes(user.toLowerCase())) return null
  return `the active gh account is not ${user}; run gh auth switch --user ${user}, or start each gh command with GH_TOKEN=$(gh auth token --user ${user})`
}

function repoExists(estate, repo) {
  return statSync(join(estate.estateRoot, repo.path), { throwIfNoEntry: false })?.isDirectory() ?? false
}

function hookCommands(file) {
  try {
    return commandsIn(JSON.parse(readFileSync(file, 'utf8')).hooks)
  } catch {
    return []
  }
}

function commandsIn(value) {
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, held]) => (key === 'command' && typeof held === 'string' ? [held] : commandsIn(held)))
}

function namesPath(command, estateRoot, homeDir) {
  const [path, home] = [estateRoot, homeDir].map(oneSeparator)
  const underHome = path === home || path.startsWith(`${home}/`)
  const spellings = [path, ...(underHome ? HOME_SPELLINGS.map(written => `${written}${path.slice(home.length)}`) : [])]
  return spellings.some(spelling => new RegExp(`${spelling.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[/"'\\s]|$)`).test(oneSeparator(command)))
}

function activeAccounts(env) {
  return ghAccounts(env)
    .filter(account => account.active)
    .map(account => account.user.toLowerCase())
}
