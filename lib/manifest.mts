import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Env } from './cli.mts'

const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export function manifestPath(env: Env) {
  return join(env.CONTEXT_CENTRAL_PLUGIN_ROOT ?? PLUGIN_ROOT, '.claude-plugin', 'plugin.json')
}
