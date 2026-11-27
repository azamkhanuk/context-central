import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { hubPath } from './nodes.mts'
import type { Env } from './cli.mts'
import type { Estate } from './estate.mts'

export type Host = 'claude-code' | 'copilot'

export interface CopilotInstall {
  id: string
  installPath: string
  enabled: boolean
}

const COPILOT_LOADS_AT_A_ROOT = ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md']

export function hostOf(env: Env): Host {
  return env.COPILOT_CLI && !env.CLAUDECODE ? 'copilot' : 'claude-code'
}

export function copilotHome(env: Env) {
  return env.COPILOT_HOME || join(env.HOME ?? homedir(), '.copilot')
}

export function copilotInstalls(env: Env): CopilotInstall[] {
  const { installedPlugins } = recordIn(join(copilotHome(env), 'config.json'))
  if (!Array.isArray(installedPlugins)) return []
  return installedPlugins.flatMap((install: unknown) => {
    const { name, marketplace, cache_path: installPath, enabled } = (install && typeof install === 'object' ? install : {}) as { [key: string]: unknown }
    if (typeof name !== 'string' || !name || typeof installPath !== 'string' || !installPath) return []
    return [{ id: typeof marketplace === 'string' && marketplace ? `${name}@${marketplace}` : name, installPath, enabled: enabled !== false }]
  })
}

export function loadsHub(host: Host, estate: Estate, startDir: string) {
  if (host !== 'copilot') return true
  if (!COPILOT_LOADS_AT_A_ROOT.includes(estate.config.hub)) return false
  const start = real(resolve(startDir))
  return [start, repositoryRoot(start)].includes(real(dirname(hubPath(estate))))
}

// The host opens its record with comment lines, which JSON does not take.
function recordIn(file: string): { installedPlugins?: unknown } {
  try {
    const written = readFileSync(file, 'utf8').split('\n').filter(line => !line.trimStart().startsWith('//')).join('\n')
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
