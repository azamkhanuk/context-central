import { existsSync, realpathSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { CLAUDE_CODE } from './hosts/claude-code.mts'
import { COPILOT, copilotInstalls, copilotLoadsAtAStart, copilotLoadsFromAnAddedFolder, foldersAddedToCopilot } from './hosts/copilot.mts'
import { pluginRoot } from './manifest.mts'
import { hubPath } from './nodes.mts'
import { inTree } from './worktree.mts'
import type { Env } from './cli.mts'
import type { Estate } from './estate.mts'

export { copilotHome, copilotInstalls } from './hosts/copilot.mts'
export type { CopilotInstall } from './hosts/copilot.mts'

export type Host = 'claude-code' | 'copilot'

const TITLES: Record<Host, string> = { 'claude-code': CLAUDE_CODE.title, copilot: COPILOT.title }

export function titleOf(host: Host) {
  return TITLES[host]
}

// Copilot names a plugin's folder to the plugin's own hooks, in a variable Claude Code does not set.
export function hostOf(env: Env): Host {
  return env[COPILOT.namesToItsHooks] ? 'copilot' : 'claude-code'
}

// Each host sets a mark for the commands a session runs, and a session of one host started inside a shell of the other holds both.
export function hostFor(env: Env): Host {
  if (hostOf(env) === 'copilot') return 'copilot'
  const copilots = Boolean(env[COPILOT.setsForACommand])
  const claudes = Boolean(env[CLAUDE_CODE.setsForACommand])
  if (copilots !== claudes) return copilots ? 'copilot' : 'claude-code'
  return runsACopyOfCopilots(env) ? 'copilot' : 'claude-code'
}

function runsACopyOfCopilots(env: Env) {
  const running = real(pluginRoot(env))
  return copilotInstalls(env).some(install => real(install.installPath) === running)
}

export function loadsHub(host: Host, estate: Estate, startDir: string, env: Env) {
  if (host !== 'copilot') return true
  const start = real(resolve(startDir))
  const roots = [start, repositoryRoot(start)].filter(root => root !== null)
  const hub = hubPath(estate)
  const copies = [[estate.estateRoot, hub], ...(estate.workTree ? [[estate.workTree.root, inTree(estate.workTree, hub)]] : [])].filter(([, copy]) => existsSync(copy))
  const stands = copies.flatMap(places)
  const added = foldersAddedToCopilot(env).map(folder => real(resolve(folder)))
  return stands.some(place => roots.some(root => copilotLoadsAtAStart(counted(root, place), place)) || added.some(folder => copilotLoadsFromAnAddedFolder(counted(folder, place), place)))
}

// The host loads a file by the name it is kept under, and a file a link of another name leads to by that file's own name.
function places([base, copy]: string[]) {
  return [join(real(base), relative(base, copy)), real(copy)]
}

function counted(from: string, place: string) {
  return relative(from, place).split(sep).join('/')
}

function repositoryRoot(dir: string): string | null {
  if (existsSync(join(dir, '.git'))) return dir
  return dirname(dir) === dir ? null : repositoryRoot(dirname(dir))
}

function real(path: string) {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}
