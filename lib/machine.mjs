import { spawnSync } from 'node:child_process'
import { accessSync, constants, statSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { delimiter, join } from 'node:path'

const GH_TIMEOUT_MS = 5000
// Node starts a .exe or a .com without a shell, and nothing else.
const FILE_NAMES = platform() === 'win32' ? name => [`${name}.exe`, `${name}.com`] : name => [name]

export function claudeConfigDir(env) {
  return env.CLAUDE_CONFIG_DIR || join(env.HOME ?? homedir(), '.claude')
}

export function onPath(name, env) {
  return (
    (env.PATH ?? '')
      .split(delimiter)
      .filter(Boolean)
      .flatMap(dir => FILE_NAMES(name).map(file => join(dir, file)))
      .find(isExecutable) ?? null
  )
}

export function ghAccounts(env) {
  const gh = onPath('gh', env)
  if (!gh) return []
  const result = spawnSync(gh, ['auth', 'status'], { env, encoding: 'utf8', timeout: GH_TIMEOUT_MS })
  const accounts = []
  for (const line of `${result.stdout ?? ''}\n${result.stderr ?? ''}`.split('\n')) {
    const login = /Logged in to \S+ (?:account|as) (\S+)/.exec(line)
    const active = /Active account: (true|false)/.exec(line)
    if (login) accounts.push({ user: login[1], active: true })
    if (active && accounts.length > 0) accounts.at(-1).active = active[1] === 'true'
  }
  return accounts
}

function isExecutable(path) {
  try {
    accessSync(path, constants.X_OK)
    return statSync(path).isFile()
  } catch {
    return false
  }
}
