import { existsSync, realpathSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { CLAUDE_CODE } from './hosts/claude-code.mts'
import { closeSync, openSync, readSync, statSync } from 'node:fs'
import { COPILOT, COPILOTS_OWN_INSTRUCTIONS, copilotInstalls, copilotLoadsAtAStart, copilotLoadsFromAnAddedFolder, foldersAddedToCopilot, repositoryRoot } from './hosts/copilot.mts'
import { pluginRoot } from './manifest.mts'
import { hubPath } from './nodes.mts'
import { holds, inTree } from './worktree.mts'
import type { Env } from './cli.mts'
import type { Estate } from './estate.mts'

export { COPILOTS_OWN_INSTRUCTIONS, COPILOTS_OWN_SERVERS, copilotHome, copilotInstalls, copilotLoadsIn } from './hosts/copilot.mts'
export type { CopilotInstall, CopilotLoads } from './hosts/copilot.mts'

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

// The hub's text for a host that does not load the hub by itself: only a file that lies inside the estate once links are followed, read no further than the limit can show.
export function hubNotLoaded(host: Host, estate: Estate, startDir: string, env: Env, limitChars: number) {
  if (loadsHub(host, estate, startDir, env)) return null
  const hub = hubPath(estate)
  const text = startOf(estate, hub, limitChars).trimEnd()
  return text.trim() ? { hub, text } : null
}

function startOf(estate: Estate, hub: string, limitChars: number) {
  try {
    const place = realpathSync(hub)
    if (!holds(realpathSync(estate.estateRoot), place) || !statSync(place).isFile()) return ''
    const file = openSync(place, 'r')
    try {
      const bytes = Buffer.alloc(limitChars * 4)
      return bytes.toString('utf8', 0, readSync(file, bytes, 0, bytes.length, 0))
    } finally {
      closeSync(file)
    }
  } catch {
    return ''
  }
}

// A new map on Copilot is given the file Copilot's own init writes, where the folder holds no hub of either host.
export function hubAtARootOn(host: Host) {
  return host === 'copilot' ? COPILOTS_OWN_INSTRUCTIONS : null
}

function real(path: string) {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}
