import { parseArgs } from 'node:util'
import { draftsDir, inMap, take } from '../drafts.mts'
import { PluginError } from '../errors.mts'
import { requireEstate } from '../estate.mts'
import type { Io } from '../cli.mts'

export const summary = "Put this work tree's drafts into the map: take [--over <path>]..."

export function run(args: string[], io: Io) {
  const { values } = parseArgs({ args, options: { over: { type: 'string', multiple: true } } })
  const estate = requireEstate(io)
  if (!draftsDir(estate)) return io.out('Nothing to take: here a file of the map is written in place.')
  const { took, kept } = take(estate, (values.over ?? []).map(given => inMap(estate, given) ?? refuse(given)))
  for (const rel of took) io.out(`took ${rel}`)
  for (const { rel, why } of kept) io.err(`context-central take: kept ${rel}: ${why}`)
  if (took.length + kept.length === 0) io.out('Nothing waits to be taken.')
  return kept.length > 0 ? 1 : 0
}

function refuse(given: string): never {
  throw new PluginError(`${given} is not a file of the map`)
}
