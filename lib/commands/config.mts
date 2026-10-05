import { parseArgs } from 'node:util'
import { PluginError } from '../errors.mts'
import { requireEstate } from '../estate.mts'

export const summary = 'Print the estate settings, or one of them with --get <dotted.key>'

export function run(args, io) {
  const { values } = parseArgs({ args, options: { get: { type: 'string' } } })
  const { config } = requireEstate(io)
  io.out(render(values.get ? lookup(config, values.get) : config))
}

function lookup(config, key) {
  const value = key.split('.').reduce((held, part) => held?.[part], config)
  if (value === undefined) throw new PluginError(`no setting "${key}"`)
  return value
}

function render(value) {
  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
}
