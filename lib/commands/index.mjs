import { parseArgs } from 'node:util'
import { requireEstate } from '../estate.mjs'
import { buildIndex, indexData } from '../index-text.mjs'

export const summary = 'Print the live index: the map, the hub and the work in flight'

export function run(args, io) {
  const { values } = parseArgs({ args, options: { absolute: { type: 'boolean' }, json: { type: 'boolean' } } })
  const estate = requireEstate(io)
  io.out(values.json ? JSON.stringify(indexData(estate), null, 2) : buildIndex(estate, { absolute: values.absolute }))
}
