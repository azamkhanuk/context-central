import { parseArgs } from 'node:util'
import { PluginError } from '../errors.mts'
import { requireEstate } from '../estate.mts'
import type { Io } from '../cli.mts'
import type { Settings } from '../estate.mts'

export const summary = 'Print the estate settings, or one of them with --get <dotted.key>'

export function run(args: string[], io: Io) {
  const { values } = parseArgs({ args, options: { get: { type: 'string' } } })
  const { config } = requireEstate(io)
  io.out(render(values.get ? lookup(config, values.get) : config))
}

function lookup(config: Settings, key: string) {
  const value = key.split('.').reduce<unknown>((held, part) => (held as Record<string, unknown> | null | undefined)?.[part], config)
  if (value === undefined) throw new PluginError(`no setting "${key}"`)
  return value
}

function render(value: unknown) {
  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
}
