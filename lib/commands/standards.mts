import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { PluginError, UsageError } from '../errors.mts'
import { requireEstate, standardsFiles } from '../estate.mts'
import type { Io } from '../cli.mts'
import type { Estate, Repo, StandardsFile } from '../estate.mts'

interface Recorded {
  repo: string
  root: string
  standards: StandardsFile[]
  checks: string[]
}

export const summary = "Print each repo's standards files and recorded checks: standards [<repo>] [--json]"

const MARKS = { file: '', missing: ' (missing)', folder: ' (a folder)' }
const NOTE_MARK = ' (the standards note)'

export function run(args: string[], io: Io) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { json: { type: 'boolean' } } })
  if (positionals.length > 1) throw new UsageError('expected one repo, or none for all of them')
  const estate = requireEstate(io)
  const recorded = chosen(estate, positionals[0]).map(repo => describe(estate, repo))
  if (values.json) return io.out(JSON.stringify(recorded.map(asData), null, 2))
  io.out(recorded.length > 0 ? recorded.map(render).join('\n\n') : 'This estate registers no repos.')
}

function chosen({ config }: Estate, name: string | undefined) {
  if (name === undefined) return config.repos
  const named = config.repos.filter(candidate => candidate.name === name)
  if (named.length === 0) throw new PluginError(`no repo "${name}" in this estate. Its repos: ${config.repos.map(candidate => candidate.name).join(', ') || 'none'}.`)
  return named
}

function describe(estate: Estate, repo: Repo): Recorded {
  return { repo: repo.name, root: resolve(estate.estateRoot, repo.path), standards: standardsFiles(estate, repo), checks: repo.checks ?? [] }
}

function asData({ standards, ...rest }: Recorded) {
  return { ...rest, standards: standards.map(({ path, state, note }) => ({ path, exists: state === 'file', note })) }
}

function render({ repo, root, standards, checks }: Recorded) {
  return [
    ...(standards.length > 0 ? [`Standards for repo ${repo}:`, ...standards.map(file => `- ${file.path}${file.note ? NOTE_MARK : MARKS[file.state]}`)] : [`No standards recorded for repo ${repo}.`]),
    ...(checks.length > 0 ? [`Checks for repo ${repo}, run from ${root}:`, ...checks.map(check => `- ${check}`)] : [`No checks recorded for repo ${repo}.`]),
  ].join('\n')
}
