import { parseArgs } from 'node:util'
import { UsageError } from '../errors.mts'
import { requireEstate } from '../estate.mts'
import { formatPointers, formatUnanswered, resolveQuery, unansweredIn } from '../resolve.mts'
import type { Io } from '../cli.mts'
import type { Resolution, Unanswered } from '../resolve.mts'

export const summary = 'List the notes behind a work item, a link, a repo name or a few words, and say which ticket named has no work item'

export function run(args: string[], io: Io) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { max: { type: 'string' }, json: { type: 'boolean' }, absolute: { type: 'boolean' } },
  })
  const query = positionals.join(' ').trim()
  if (!query) throw new UsageError('expected a query: a work item, a link, a repo name or a few words')
  const estate = requireEstate(io)
  const resolution = resolveQuery(estate, query, { max: maxOf(values.max, estate.config.budgets.resolveMax), itemWords: true })
  const unanswered = unansweredIn(estate, query)
  if (values.json) return io.out(JSON.stringify(asJson(resolution, unanswered), null, 2))
  const lines = [...(resolution ? [formatPointers(resolution, { absolute: values.absolute })] : []), ...unanswered.map(formatUnanswered)]
  io.out(lines.length > 0 ? lines.join('\n') : `No confident match for "${query}".`)
}

function asJson(resolution: Resolution | null, unanswered: Unanswered[]) {
  if (unanswered.length === 0) return resolution
  return { ...resolution, unanswered: unanswered.map(({ text, connection }) => ({ text, connection })) }
}

function maxOf(given: string | undefined, fallback: number) {
  if (given === undefined) return fallback
  if (!/^\d+$/.test(given)) throw new UsageError('--max takes a whole number')
  return Number(given)
}
