import { spawnSync } from 'node:child_process'
import { accessSync, constants, statSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { delimiter, join } from 'node:path'
import type { Env } from './cli.mts'
import type { Account, Preset } from './presets.mts'

const ACCOUNTS_TIMEOUT_MS = 5000
// Node starts a .exe or a .com without a shell, and nothing else.
const FILE_NAMES = platform() === 'win32' ? (name: string) => [`${name}.exe`, `${name}.com`] : (name: string) => [name]

export function claudeConfigDir(env: Env) {
  return env.CLAUDE_CONFIG_DIR || join(env.HOME ?? homedir(), '.claude')
}

export function onPath(name: string, env: Env) {
  return (
    (env.PATH ?? '')
      .split(delimiter)
      .filter(Boolean)
      .flatMap(dir => FILE_NAMES(name).map(file => join(dir, file)))
      .find(isExecutable) ?? null
  )
}

export function accountsOf(preset: Preset, env: Env): Account[] {
  const program = onPath(preset.program, env)
  if (!program || !preset.accounts) return []
  const result = spawnSync(program, preset.accounts.args, { env, encoding: 'utf8', timeout: ACCOUNTS_TIMEOUT_MS })
  return preset.accounts.read(`${result.stdout ?? ''}\n${result.stderr ?? ''}`)
}

function isExecutable(path: string) {
  try {
    accessSync(path, constants.X_OK)
    return statSync(path).isFile()
  } catch {
    return false
  }
}
