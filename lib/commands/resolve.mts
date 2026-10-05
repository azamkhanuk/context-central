import { parseArgs } from 'node:util'
import { UsageError } from '../errors.mts'
import { requireEstate } from '../estate.mts'
import { formatPointers, resolveQuery } from '../resolve.mts'

export const summary = 'List the notes behind a work item, a PR link, a repo name or a few words'

export function run(args, io) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { max: { type: 'string' }, json: { type: 'boolean' }, absolute: { type: 'boolean' } },
  })
  const query = positionals.join(' ').trim()
  if (!query) throw new UsageError('expected a query: a work item, a PR link, a repo name or a few words')
  const estate = requireEstate(io)
  const resolution = resolveQuery(estate, query, { max: maxOf(values.max, estate.config.budgets.resolveMax), itemWords: true })
  if (values.json) io.out(JSON.stringify(resolution, null, 2))
  else io.out(resolution ? formatPointers(resolution, { absolute: values.absolute }) : `No confident match for "${query}".`)
}

function maxOf(given, fallback) {
  if (given === undefined) return fallback
  if (!/^\d+$/.test(given)) throw new UsageError('--max takes a whole number')
  return Number(given)
}
