import { spawnSync } from 'node:child_process'
import { accessSync, constants, statSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { delimiter, join } from 'node:path'
import type { Env } from './cli.mts'
import type { Account, Entry, Preset } from './presets.mts'

export interface AccountToken {
  variable: string
  token: string
}

const ACCOUNTS_TIMEOUT_MS = 5000
const ONE_WORD = /^[^\s\p{Cc}]+$/u
// Node starts a .exe or a .com without a shell, and nothing else.
const FILE_NAMES = platform() === 'win32' ? (name: string) => [`${name}.exe`, `${name}.com`] : (name: string) => [name]
const SCRIPT_NAMES = platform() === 'win32' ? (name: string) => [`${name}.cmd`, `${name}.bat`] : () => []

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

export function isOnlyAScript(name: string, env: Env) {
  return (env.PATH ?? '')
    .split(delimiter)
    .filter(Boolean)
    .flatMap(dir => SCRIPT_NAMES(name).map(file => join(dir, file)))
    .some(isFile)
}

export function accountsOf(preset: Preset, env: Env, entry?: Entry): Account[] {
  const program = onPath(preset.program, env)
  if (!program || !preset.accounts) return []
  const result = spawnSync(program, preset.accounts.args, { env, encoding: 'utf8', timeout: ACCOUNTS_TIMEOUT_MS })
  return preset.accounts.read(`${result.stdout ?? ''}\n${result.stderr ?? ''}`, entry)
}

export function tokenOf(preset: Preset, wanted: string, entry: Entry, env: Env): AccountToken | null {
  const program = onPath(preset.program, env)
  const asked = preset.accounts?.token?.(wanted, entry)
  const given = [wanted, ...Object.values(entry).flat()].filter(value => typeof value === 'string')
  if (!program || !asked || given.some(word => word.startsWith('-')) || !asked.args.every(word => ONE_WORD.test(word))) return null
  const result = spawnSync(program, asked.args, { env, encoding: 'utf8', timeout: ACCOUNTS_TIMEOUT_MS })
  const token = result.status === 0 ? (result.stdout ?? '').trim() : ''
  return ONE_WORD.test(token) ? { variable: asked.variable, token } : null
}

function isExecutable(path: string) {
  try {
    accessSync(path, constants.X_OK)
    return statSync(path).isFile()
  } catch {
    return false
  }
}

function isFile(path: string) {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}
