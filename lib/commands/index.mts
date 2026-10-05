import { parseArgs } from 'node:util'
import { requireEstate } from '../estate.mts'
import { buildIndex, indexData } from '../index-text.mts'
import type { Io } from '../cli.mts'

export const summary = 'Print the live index: the map, the hub and the work in flight'

export function run(args: string[], io: Io) {
  const { values } = parseArgs({ args, options: { absolute: { type: 'boolean' }, json: { type: 'boolean' } } })
  const estate = requireEstate(io)
  io.out(values.json ? JSON.stringify(indexData(estate), null, 2) : buildIndex(estate, { absolute: values.absolute }))
}
