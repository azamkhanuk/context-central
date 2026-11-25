import { readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { citedIn, judgedIn } from '../citations.mts'
import { PluginError, UsageError } from '../errors.mts'
import { repoAt, repoFolder, requireEstate } from '../estate.mts'
import { handOver } from '../handover.mts'
import { locked, writeWhole } from '../lock.mts'
import { onPath } from '../machine.mts'
import { EVIDENCE_DIR, findWorkItem, makeFolder, nextSourceNumber } from '../nodes.mts'
import { NAME_ANOTHER, SHEET_FILE, readResearch, readingTemplateOf, requireResearch, researchTaken } from '../research.mts'
import { researchTemplates } from '../templates.mts'
import { formatBytes, localDate, plural } from '../text.mts'
import { asked, gitTracks } from '../worktree.mts'
import type { Cited, Judged } from '../citations.mts'
import type { Env, Io } from '../cli.mts'
import type { Estate, Repo } from '../estate.mts'
import type { Fact, Research } from '../research.mts'

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

interface CitedLine {
  fact: Fact
  cited: Cited
  repo: Repo | null
}

interface Compared {
  fact: string
  span: string
  commit: string | null
  repo: string | null
  state: Judged | 'no repo' | 'no answer'
  at: string
}

export const summary = 'Research folders: new <name>, open <name>, moved <name>, handover <name> <folder>'

const USAGE = 'expected one of: new <name> [--title <title>] [--item <item>] [--json], open <name> [--json], moved <name> [--json], handover <name> <folder> [--without <kind>]... [--reading]'
const ACTIONS: Record<string, string[]> = { new: ['title', 'item', 'json'], open: ['json'], moved: ['json'], handover: ['without', 'reading'] }
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
    options: { title: { type: 'string' }, item: { type: 'string' }, json: { type: 'boolean' }, without: { type: 'string', multiple: true }, reading: { type: 'boolean' } },
  })
  const [action, name, ...more] = positionals
  if (!Object.hasOwn(ACTIONS, action ?? '') || more.length !== (action === 'handover' ? 1 : 0) || name === undefined) throw new UsageError(USAGE)
  const misplaced = Object.keys(values).find(flag => !ACTIONS[action].includes(flag))
  if (misplaced) throw new UsageError(`--${misplaced} does not go with ${action}`)
  if (action === 'open') return open(requireEstate(io), name, values.json, io)
  if (action === 'moved') return moved(requireEstate(io), name, values.json, io)
  if (action === 'handover') return handover(requireEstate(io), name, more[0], values, io)
  if (!A_NAME.test(name)) throw new UsageError('a research name is letters, digits, dots, dashes and underscores, opens with a letter or a digit and does not end in a dot, for example gateway-limits')
  if (values.title !== undefined && A_LINE_BREAK.test(values.title)) throw new UsageError('a title is one line')
  if (values.title !== undefined && !/[\p{L}\p{N}]/u.test(values.title)) throw new UsageError('a title holds words: leave --title out and the name is the title')
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
    const reading = readingTemplateOf(estate)
    if (reading === null) throw new PluginError(`the reading's template ${readingTemplate} cannot be read`)
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
  const [researchSheetBytes, researchStableDays, researchMovingDays] = (['researchSheetBytes', 'researchStableDays', 'researchMovingDays'] as const).map(key => aNumber(estate, key))
  const { stands, superseded, unread, rounds, checkAgain } = readResearch(research)
  const last = rounds.reduce<(typeof rounds)[number] | null>((highest, round) => (highest && highest.number > round.number ? highest : round), null)
  const on = (days: number) => ({ days, day: new Date(Date.parse(`${today}T00:00:00Z`) + days * A_DAY_MS).toISOString().slice(0, 10) })
  return {
    name: research.name,
    title: research.title,
    item: research.item,
    facts: { stand: stands.length, superseded: superseded.length, next: `F${Math.max(0, ...[...stands, ...superseded, ...unread].map(fact => fact.number)) + 1}` },
    sources: { saved: research.sources.length, next: nextSourceNumber(estate.mapDir, `${research.dirRel}/sources`) },
    rounds: { last: last?.number ?? 0, day: last?.day ?? null, stopped: last?.stopped ?? null },
    checkAgain: checkAgain === null ? null : { day: checkAgain, daysOff: Math.round((Date.parse(`${checkAgain}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / A_DAY_MS) },
    sheet: { bytes: research.sheet.bytes, limit: researchSheetBytes, pages: research.pages.length },
    dates: { today, stable: on(researchStableDays), moving: on(researchMovingDays) },
  }
}

function aNumber({ config }: Estate, key: 'researchSheetBytes' | 'researchStableDays' | 'researchMovingDays') {
  const held: unknown = config.budgets[key]
  if (typeof held !== 'number' || !Number.isFinite(held) || held < 0) throw new PluginError(`"budgets.${key}" is ${JSON.stringify(held)} in estate.json, where research open needs a number of 0 or more`)
  return held
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

function moved(estate: Estate, name: string, json: boolean | undefined, io: Io) {
  const research = requireResearch(estate, name)
  const lines = citedLines(estate, research)
  if (lines.length > 0 && !onPath('git', io.env)) throw new PluginError('git was not found on the PATH, so nothing was compared')
  const compared = comparedWith(estate, lines, io.env)
  if (json) return io.out(JSON.stringify(compared, null, 2))
  if (compared.length === 0) return io.out(`No fact of ${research.name} cites a line of a repo.`)
  io.out([...compared.flatMap(saidOf), counted(compared)].join('\n'))
}

function citedLines(estate: Estate, research: Research): CitedLine[] {
  return readResearch(research).stands.flatMap(fact =>
    fact.nested.flatMap(({ line, text }) =>
      citedIn(text, line - 1)
        .filter(cited => cited.first !== null)
        .map(cited => ({ fact, cited, repo: repoAt(estate, dirname(resolve(estate.estateRoot, cited.path))) })),
    ),
  )
}

function comparedWith(estate: Estate, lines: CitedLine[], env: Env): Compared[] {
  const states = new Map<CitedLine, Compared['state']>()
  for (const repo of new Set(lines.flatMap(line => line.repo ?? []))) {
    const inRepo = lines.filter(line => line.repo === repo)
    const judged = judgedIn(repoFolder(estate, repo), repo, inRepo.map(({ cited }) => cited), env)
    inRepo.forEach((line, at) => states.set(line, judged?.[at] ?? 'no answer'))
  }
  return lines.map(line => ({ fact: `F${line.fact.number}`, span: line.cited.span, commit: line.cited.commit, repo: line.repo?.name ?? null, state: states.get(line) ?? 'no repo', at: `${line.fact.rel}:${line.cited.line}` }))
}

function saidOf({ fact, span, commit, repo, state, at }: Compared) {
  if (state === 'held') return []
  if (state === 'moved') return [`${fact} has moved: \`${span}\` at \`${commit}\` (${at})`]
  const why = {
    'no commit': 'its line names no commit',
    'commit not held': `repo ${repo} does not hold the commit \`${commit}\``,
    'not behind the head': `the commit is not behind the head of repo ${repo}`,
    'no such file': `repo ${repo} holds no such file at the commit`,
    'no repo': 'it is in no repo the map registers',
    'no answer': `git gave no answer in repo ${repo}`,
  }[state]
  return [`${fact} was not compared: ${why} (\`${span}\`, ${at})`]
}

function counted(compared: Compared[]) {
  const factsWith = (states: (state: Compared['state']) => boolean) => new Set(compared.filter(({ state }) => states(state)).map(({ fact }) => fact)).size
  const citing = factsWith(() => true)
  const moving = factsWith(state => state === 'moved')
  const left = factsWith(state => state !== 'moved' && state !== 'held')
  const many = moving > 1
  const which = citing === 1 ? `The one fact that cites a line of a repo has${moving === 1 ? '' : ' not'}` : `${moving || 'None'} of ${citing} facts that cite a line of a repo ${many ? 'have' : 'has'}`
  const notCompared = left === 0 ? '' : ` ${left === 1 ? '1 has' : `${left} have`} a line that was not compared.`
  return `${which} moved since the commit ${many ? 'they were' : 'it was'} read at.${notCompared}`
}

function handover(estate: Estate, name: string, folder: string, { without = [], reading = false }: { without?: string[]; reading?: boolean }, io: Io) {
  const research = requireResearch(estate, name)
  const { files, bytes, leftOut, restOnLeftOut } = handOver(estate, research, { folder: resolve(io.cwd, folder), written: folder, without: [...new Set(without)], reading })
  io.out(
    [
      `handed over research ${research.name} to ${folder}: ${plural(files, 'file')} (${formatBytes(bytes)})`,
      ...leftOut.map(({ kind, count }) => `left out: ${plural(count, 'source')} of kind ${kind}`),
      ...(restOnLeftOut.length > 0 ? [`${listed(restOnLeftOut.map(number => `F${number}`))} ${restOnLeftOut.length === 1 ? 'rests' : 'rest'} only on sources left out`] : []),
    ].join('\n'),
  )
}

function listed(names: string[]) {
  return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}
