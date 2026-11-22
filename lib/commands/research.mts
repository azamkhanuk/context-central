import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { PluginError, UsageError } from '../errors.mts'
import { NODE_NAME, requireEstate } from '../estate.mts'
import { locked, writeWhole } from '../lock.mts'
import { findWorkItem, makeFolder } from '../nodes.mts'
import { SHEET_FILE, researchTaken } from '../research.mts'
import { researchTemplates } from '../templates.mts'
import { asked, gitTracks } from '../worktree.mts'
import type { Env, Io } from '../cli.mts'
import type { Estate } from '../estate.mts'

type KeptByGit = 'kept' | 'ignored' | null

export const summary = 'Research folders: new <name>'

const USAGE = 'expected: research new <name> [--title <title>] [--item <item>] [--json]'
const IGNORED = 0
const NOT_IGNORED = 1

export function run(args: string[], io: Io) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { title: { type: 'string' }, item: { type: 'string' }, json: { type: 'boolean' } },
  })
  const [action, name, ...more] = positionals
  if (action !== 'new' || more.length > 0 || name === undefined) throw new UsageError(USAGE)
  if (!NODE_NAME.test(name)) throw new UsageError('a research name is letters, digits, dots, dashes and underscores, for example gateway-limits')
  const estate = requireEstate(io)
  const dirRel = create(estate, name, values)
  const sheet = `${dirRel}/${SHEET_FILE}`
  const git = keptByGit(estate, sheet, io.env)
  if (values.json) return io.out(JSON.stringify({ sheet, git }, null, 2))
  io.out(sheet)
  if (git === 'kept') io.out(`git: this map is kept in git, and ${dirRel}/ goes into it with every source it saves`)
  if (git === 'ignored') io.out(`git: this map is kept in git, which ignores ${dirRel}/, so this research stays on this machine`)
}

function create(estate: Estate, name: string, { title, item: asked }: { title?: string; item?: string }) {
  const { researchDir, readingTemplate } = estate.config
  const dirRel = `${researchDir}/${name}`
  locked(estate.mapDir, () => {
    const taken = researchTaken(estate)
    if (taken) throw new PluginError(`${researchDir} ${taken}, so no research is made there: name another folder with "researchDir" in estate.json`)
    if (namesIn(join(estate.mapDir, researchDir)).some(held => held.toLowerCase() === name.toLowerCase())) throw new PluginError(`${dirRel} is there already`)
    const item = asked === undefined ? null : findWorkItem(estate, asked)
    if (asked !== undefined && !item) throw new PluginError(`no work item "${asked}"`)
    const reading = readingTemplate === undefined ? undefined : templateAt(estate, readingTemplate)
    makeFolder(estate.mapDir, `${dirRel}/sources`)
    for (const [file, text] of Object.entries(researchTemplates({ name, title: title ?? name, item: item?.id ?? null, reading }))) writeWhole(join(estate.mapDir, dirRel, file), text)
  })
  return dirRel
}

function templateAt({ estateRoot }: Estate, rel: string) {
  try {
    return readFileSync(join(estateRoot, rel), 'utf8')
  } catch {
    throw new PluginError(`the reading's template ${rel} cannot be read`)
  }
}

function keptByGit({ mapDir, configPath }: Estate, sheet: string, env: Env): KeptByGit {
  if (gitTracks(mapDir, configPath, env) !== true) return null
  const { status } = asked(mapDir, ['check-ignore', '-q', '--', sheet], env)
  return status === IGNORED ? 'ignored' : status === NOT_IGNORED ? 'kept' : null
}

function namesIn(dir: string) {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}
