import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { PluginError, UsageError } from '../errors.mts'
import { requireEstate } from '../estate.mts'
import { locked, writeWhole } from '../lock.mts'
import { EVIDENCE_DIR, findWorkItem, makeFolder, nextSourceNumber } from '../nodes.mts'
import { NAME_ANOTHER, SHEET_FILE, readResearch, requireResearch, researchTaken } from '../research.mts'
import { researchTemplates } from '../templates.mts'
import { formatBytes, localDate, plural } from '../text.mts'
import { asked, gitTracks } from '../worktree.mts'
import type { Env, Io } from '../cli.mts'
import type { Estate } from '../estate.mts'
import type { Research } from '../research.mts'

type KeptByGit = 'kept' | 'ignored' | null

interface Standing {
  name: string
  title: string
  item: string | null
  facts: { stand: number; superseded: number; next: string }
  sources: { saved: number; next: string }
  rounds: { last: number; day: string | null; stopped: string | null }
  checkAgain: { day: string; daysOff: number } | null
  sheet: { bytes: number; limit: number; pages: number }
  dates: { today: string; stable: { days: number; day: string }; moving: { days: number; day: string } }
}

export const summary = 'Research folders: new <name>, open <name>'

const USAGE = 'expected one of: new <name> [--title <title>] [--item <item>] [--json], open <name> [--json]'
const ACTIONS: Record<string, string[]> = { new: ['title', 'item', 'json'], open: ['json'] }
const A_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9_-])?$/
const A_LINE_BREAK = /[\r\n\u0085\u2028\u2029]/
const NEVER_LISTED = 'node_modules'
const IGNORED = 0
const NOT_IGNORED = 1
const A_DAY_MS = 86_400_000

export function run(args: string[], io: Io) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { title: { type: 'string' }, item: { type: 'string' }, json: { type: 'boolean' } },
  })
  const [action, name, ...more] = positionals
  if (!Object.hasOwn(ACTIONS, action ?? '') || more.length > 0 || name === undefined) throw new UsageError(USAGE)
  const misplaced = Object.keys(values).find(flag => !ACTIONS[action].includes(flag))
  if (misplaced) throw new UsageError(`--${misplaced} does not go with ${action}`)
  if (action === 'open') return open(requireEstate(io), name, values.json, io)
  if (!A_NAME.test(name)) throw new UsageError('a research name is letters, digits, dots, dashes and underscores, opens with a letter or a digit and does not end in a dot, for example gateway-limits')
  if (values.title !== undefined && A_LINE_BREAK.test(values.title)) throw new UsageError('a title is one line')
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
  const { researchDir, readingTemplate, deepDirs } = estate.config
  const dirRel = `${researchDir}/${name}`
  const kept = [...new Set([...deepDirs, EVIDENCE_DIR, NEVER_LISTED])]
  if (kept.some(held => held.toLowerCase() === name.toLowerCase())) throw new PluginError(`${name} is a name the map keeps for something else, so no research takes it: ${kept.join(', ')}`)
  locked(estate.mapDir, () => {
    const taken = researchTaken(estate)
    if (taken) throw new PluginError(`${researchDir} ${taken}, so no research is made there: ${NAME_ANOTHER}`)
    if (namesIn(join(estate.mapDir, researchDir)).some(held => held.toLowerCase() === name.toLowerCase())) throw new PluginError(`${dirRel} is there already`)
    const item = asked === undefined ? null : findWorkItem(estate, asked)
    if (asked !== undefined && !item) throw new PluginError(`no work item "${asked}"`)
    const reading = readingTemplate === undefined ? undefined : templateAt(estate, readingTemplate)
    written(dirRel, () => {
      makeFolder(estate.mapDir, `${dirRel}/sources`)
      for (const [file, text] of Object.entries(researchTemplates({ name, title: title ?? name, item: item?.id ?? null, reading }))) writeWhole(join(estate.mapDir, dirRel, file), text)
    })
  })
  return dirRel
}

function written(dirRel: string, write: () => void) {
  try {
    write()
  } catch (error) {
    const { code } = error as NodeJS.ErrnoException
    if (error instanceof PluginError || !code) throw error
    throw new PluginError(`${dirRel} could not be made (${code})`)
  }
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

function open(estate: Estate, name: string, json: boolean | undefined, io: Io) {
  const standing = standingOf(estate, requireResearch(estate, name), localDate(io.env).day)
  io.out(json ? JSON.stringify(standing, null, 2) : said(standing).join('\n'))
}

function standingOf(estate: Estate, research: Research, today: string): Standing {
  const { researchSheetBytes, researchStableDays, researchMovingDays } = estate.config.budgets
  const { stands, superseded, rounds, checkAgain } = readResearch(research)
  const last = rounds.reduce<(typeof rounds)[number] | null>((highest, round) => (highest && highest.number > round.number ? highest : round), null)
  const on = (days: number) => ({ days, day: new Date(Date.parse(`${today}T00:00:00Z`) + days * A_DAY_MS).toISOString().slice(0, 10) })
  return {
    name: research.name,
    title: research.title,
    item: research.item,
    facts: { stand: stands.length, superseded: superseded.length, next: `F${Math.max(0, ...[...stands, ...superseded].map(fact => fact.number)) + 1}` },
    sources: { saved: research.sources.length, next: nextSourceNumber(estate.mapDir, `${research.dirRel}/sources`) },
    rounds: { last: last?.number ?? 0, day: last?.day ?? null, stopped: last?.stopped ?? null },
    checkAgain: checkAgain === null ? null : { day: checkAgain, daysOff: Math.round((Date.parse(`${checkAgain}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / A_DAY_MS) },
    sheet: { bytes: research.sheet.bytes, limit: researchSheetBytes, pages: research.pages.length },
    dates: { today, stable: on(researchStableDays), moving: on(researchMovingDays) },
  }
}

function said({ name, title, item, facts, sources, rounds, checkAgain, sheet, dates }: Standing) {
  const stand = facts.stand === 1 ? '1 stands' : `${facts.stand || 'none'} stand`
  const size = formatBytes(sheet.bytes)
  const limit = formatBytes(sheet.limit)
  const past = sheet.bytes > sheet.limit
  return [
    `research ${name}: ${title}`,
    ...(item ? [`item: ${item}`] : []),
    `facts: ${facts.stand + facts.superseded === 0 ? 'none' : `${stand}, ${facts.superseded || 'none'} superseded`}; the next is ${facts.next}`,
    `sources: ${sources.saved || 'none'} saved; the next is ${sources.next}`,
    `rounds: ${rounds.day === null ? 'none' : `${rounds.last}, the last on ${rounds.day}, ${rounds.stopped === null ? 'not stopped' : `stopped: ${rounds.stopped}`}`}`,
    `check again by: ${checkAgain === null ? 'no date on the sheet' : `${checkAgain.day}, ${off(checkAgain.daysOff)}`}`,
    past
      ? `sheet: ${size}, past ${limit}: its facts go to ${sheet.pages > 0 ? `its ${plural(sheet.pages, 'page')}` : 'pages'} by subject`
      : `sheet: ${size} of ${limit}${sheet.pages > 0 ? `, and ${plural(sheet.pages, 'page')} by subject` : ''}`,
    `dates: today is ${dates.today}, ${plural(dates.stable.days, 'day')} on is ${dates.stable.day}, ${plural(dates.moving.days, 'day')} on is ${dates.moving.day}`,
  ]
}

function off(days: number) {
  if (days === 0) return 'today'
  return days > 0 ? `${plural(days, 'day')} off` : `passed ${plural(-days, 'day')} ago`
}
