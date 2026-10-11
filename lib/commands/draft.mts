import { parseArgs } from 'node:util'
import { drafted, draftsOf, inMap, mapFiles } from '../drafts.mts'
import { UsageError } from '../errors.mts'
import { requireEstate } from '../estate.mts'
import type { Io } from '../cli.mts'
import type { Estate } from '../estate.mts'

export const summary = 'Print the file to write for a file of the map: draft <path>...'

export function run(args: string[], io: Io) {
  const { positionals } = parseArgs({ args, allowPositionals: true, options: {} })
  if (positionals.length === 0) throw new UsageError('expected a file of the map: draft <path>...')
  const estate = requireEstate(io)
  const drafts = draftsOf(estate, io.env)
  const asked = positionals.map(given => inMap(estate, drafts?.dir ?? null, given) ?? refuse(estate, given))
  for (const rel of asked) io.out(drafted(estate, drafts, rel))
}

function refuse(estate: Estate, given: string): never {
  const { files, folders } = mapFiles(estate)
  throw new UsageError(`${given} is not a file of the map: expected ${files.join(', ')} or a path under one of: ${folders.join(', ')}`)
}
