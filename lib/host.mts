import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, posix, resolve } from 'node:path'
import { hubPath } from './nodes.mts'
import { withoutBom } from './text.mts'
import { inTree } from './worktree.mts'
import type { Env } from './cli.mts'
import type { Estate } from './estate.mts'

export type Host = 'claude-code' | 'copilot'

export interface CopilotInstall {
  id: string
  installPath: string
  enabled: boolean
}

const COPILOT_LOADS_AT_A_ROOT = ['CLAUDE.md', '.claude/CLAUDE.md', 'AGENTS.md', 'GEMINI.md']
const COPILOT_LOADS_UNDER = [/^\.claude\/rules\/.+\.md$/]
const ONE_WORD = /^[^\s\p{Cc}]+$/u

// Copilot names a plugin's folder to the plugin's own hooks, in a variable Claude Code does not set.
export function hostOf(env: Env): Host {
  return env.COPILOT_PLUGIN_ROOT ? 'copilot' : 'claude-code'
}

export function copilotHome(env: Env) {
  return env.COPILOT_HOME || join(env.HOME ?? homedir(), '.copilot')
}

export function copilotInstalls(env: Env): CopilotInstall[] {
  const { installedPlugins } = recordIn(join(copilotHome(env), 'config.json'))
  if (!Array.isArray(installedPlugins)) return []
  return installedPlugins.flatMap((install: unknown) => {
    const { name, marketplace, cache_path: installPath, enabled } = (install && typeof install === 'object' ? install : {}) as { [key: string]: unknown }
    if (!oneWord(name) || typeof installPath !== 'string' || !installPath) return []
    return [{ id: oneWord(marketplace) ? `${name}@${marketplace}` : name, installPath, enabled: enabled !== false }]
  })
}

export function loadsHub(host: Host, estate: Estate, startDir: string) {
  if (host !== 'copilot') return true
  const named = posix.normalize(estate.config.hub)
  if (!COPILOT_LOADS_AT_A_ROOT.includes(named) && !COPILOT_LOADS_UNDER.some(pattern => pattern.test(named))) return false
  const start = real(resolve(startDir))
  const roots = [start, repositoryRoot(start)]
  const hub = hubPath(estate)
  const copies = estate.workTree ? [hub, inTree(estate.workTree, hub)] : [hub]
  return copies.filter(copy => existsSync(copy)).some(copy => roots.includes(real(rootOf(copy, named))))
}

function rootOf(file: string, named: string) {
  return named.split('/').reduce(folder => dirname(folder), file)
}

function oneWord(value: unknown): value is string {
  return typeof value === 'string' && ONE_WORD.test(value)
}

// The host opens its record with comment lines, which JSON does not take.
function recordIn(file: string): { installedPlugins?: unknown } {
  try {
    const written = withoutBom(readFileSync(file, 'utf8')).split('\n').filter(line => !line.trimStart().startsWith('//')).join('\n')
    const record = JSON.parse(written) as unknown
    return record && typeof record === 'object' ? record : {}
  } catch {
    return {}
  }
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
