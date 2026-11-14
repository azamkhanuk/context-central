import { parseArgs } from 'node:util'
import { PluginError, UsageError } from '../errors.mts'
import { repoAt, requireEstate } from '../estate.mts'
import { findWorkItem } from '../nodes.mts'
import { recordRun } from '../proof.mts'
import type { Io } from '../cli.mts'

export const summary = 'Record what a recorded check exited with, for a work item: proof <item> --check "<check>" --exit <code>'

const WHOLE_NUMBER = /^\d+$/

export function run(args: string[], io: Io) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { check: { type: 'string' }, exit: { type: 'string' } } })
  if (positionals.length !== 1 || values.check === undefined || values.exit === undefined) throw new UsageError('expected: proof <item> --check "<check>" --exit <code>')
  if (!WHOLE_NUMBER.test(values.exit) || !Number.isSafeInteger(Number(values.exit))) throw new UsageError('--exit takes what the check exited with, a whole number of 0 or more')
  const estate = requireEstate(io)
  const item = findWorkItem(estate, positionals[0])
  if (!item) throw new PluginError(`no work item "${positionals[0]}"`)
  const repo = repoAt(estate, io.cwd)
  if (!repo) throw new PluginError(`${io.cwd} is in no registered repo, so there is no recorded check to record; run this from the repo's folder`)
  const recorded = repo.checks ?? []
  if (!recorded.includes(values.check)) throw new PluginError(`repo ${repo.name} records no check "${values.check}". Its checks: ${recorded.map(check => `"${check}"`).join(', ') || 'none'}`)
  const made = recordRun(estate, item, repo, values.check, Number(values.exit), io.env)
  io.out(`recorded: ${made.repo} "${made.check}" exit ${made.exit} at ${made.commit.slice(0, 7)} on ${made.branch ?? 'no branch'}${made.dirty ? ', with changes not committed' : ''}`)
}
