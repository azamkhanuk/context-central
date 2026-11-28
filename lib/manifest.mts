import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Env } from './cli.mts'

const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export function pluginRoot(env: Env) {
  return env.CONTEXT_CENTRAL_PLUGIN_ROOT ?? PLUGIN_ROOT
}

export function manifestPath(env: Env) {
  return join(pluginRoot(env), '.claude-plugin', 'plugin.json')
}
