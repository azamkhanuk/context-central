import { parseArgs } from 'node:util'
import { coverage, requireEstate } from '../estate.mts'
import { glossaryPath, glossaryRepo } from '../glossary.mts'
import type { Io } from '../cli.mts'

export const summary = 'Show which map covers this folder, and whether the hooks answer here'

export function run(args: string[], io: Io) {
  const { values } = parseArgs({ args, options: { json: { type: 'boolean' } } })
  const estate = requireEstate(io)
  const where = {
    name: estate.config.name,
    estateRoot: estate.estateRoot,
    mapDir: estate.mapDir,
    layout: estate.layout,
    covered: coverage(estate, io.cwd),
    glossary: glossaryPath(estate),
    glossaryRepo: glossaryRepo(estate),
  }
  if (values.json) return io.out(JSON.stringify(where, null, 2))
  io.out(`map: ${where.name} at ${where.mapDir}`)
  io.out(`estate root: ${where.estateRoot}`)
  io.out(`glossary: ${where.glossary}${where.glossaryRepo ? `, inside repo ${where.glossaryRepo}` : ''}`)
  io.out(where.covered ? `here: ${where.covered}` : 'here: not covered, so the hooks stay silent')
}
