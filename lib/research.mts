import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, posix, relative, resolve, sep } from 'node:path'
import { filesUnder, findWorkItem, parseLinks, underNotNodes } from './nodes.mts'
import { fenced, firstHeading, parseFrontmatter } from './text.mts'
import { holds } from './worktree.mts'
import type { Estate } from './estate.mts'
import type { Node } from './nodes.mts'

export interface Research {
  name: string
  dirRel: string
  title: string
  item: string | null
  sheet: Node
  pages: Node[]
  files: Node[]
  sources: Node[]
}

export interface Superseding {
  number: number
  day: string | null
  reason: string | null
  line: number
}

export interface Fact {
  number: number
  verified: boolean
  disputed: boolean
  rel: string
  line: number
  written: string
  nested: { line: number; text: string }[]
  supersedes: Superseding[]
}

export interface Round {
  number: number
  day: string
  line: number
  stopped: string | null
}

export interface Read {
  stands: Fact[]
  superseded: Fact[]
  unread: { rel: string; line: number }[]
  rounds: Round[]
  checkAgain: string | null
}

export interface Said {
  rel: string
  message: string
}

type Place = { rel: string; line: number }

export const SHEET_FILE = 'index.md'
export const LOG_FILE = 'log.md'

const PAGE = /^facts-[a-z0-9-]+\.md$/
const OPENS_AS_A_FACT = /^- \*\*F\d+\*\*/
const FACT = /^- \*\*F(\d+)\*\* `(verified|inferred)`( `disputed`)?(?! `disputed`) \S/
const ROUND = /^## Round (\d+), (\d{4}-\d{2}-\d{2})\s*$/
const STOPPED = /^- Stopped: (\S.*)$/
const CHECK_AGAIN_BY = /^## Check again by\s*$/
const HEADING = /^#{1,6}\s/
const A_DAY = /\b\d{4}-\d{2}-\d{2}\b/
const SUPERSEDES = /^- Supersedes F(\d+)(?:, (\d{4}-\d{2}-\d{2}): (\S.*))?/
const ONCE = 'a number is used once across the sheet and the log'
const LEAVES = 'a superseded fact leaves the sheet for the log'
const LINKS_ITS_OWN = "a research links its own files, a full address and its item's saved ticket or pull request"

export function researchTaken({ estateRoot, mapDir, config }: Estate): string | null {
  const folder = join(mapDir, config.researchDir)
  if (statSync(folder, { throwIfNoEntry: false })?.isFile()) return 'is a file, not a folder'
  if (existsSync(join(folder, '.git'))) return 'holds a .git of its own'
  const repo = config.repos.find(candidate => {
    const root = resolve(estateRoot, candidate.path)
    return root !== mapDir && holds(mapDir, root) && holds(root, folder)
  })
  if (repo) return `is inside the repo ${repo.name}`
  if (underNotNodes(config, config.researchDir)) return 'is under a notNodes entry'
  const fromRoot = relative(estateRoot, folder).split(sep).join('/')
  const leftAlone = config.leftAlone.map(entry => entry.replace(/\/+$/, '')).some(entry => fromRoot === entry || fromRoot.startsWith(`${entry}/`))
  return leftAlone ? 'is under a leftAlone entry' : null
}

export function listResearches(estate: Estate): Research[] {
  if (researchTaken(estate)) return []
  const { researchDir } = estate.config
  const folders = new Map<string, Node[]>()
  for (const file of filesUnder(estate, researchDir)) {
    const [name] = file.rel.slice(researchDir.length + 1).split('/')
    folders.set(name, [...(folders.get(name) ?? []), file])
  }
  return [...folders].flatMap(([name, inFolder]) => researchIn(`${researchDir}/${name}`, name, inFolder))
}

export function findResearch(estate: Estate, name: string): Research | null {
  const all = listResearches(estate)
  return all.find(one => one.name === name) ?? all.find(one => one.name.toLowerCase() === name.toLowerCase()) ?? null
}

export function readResearch(research: Research): Read {
  const log = research.files.find(file => file.rel === `${research.dirRel}/${LOG_FILE}`)
  const sheet = [research.sheet, ...research.pages].map(factsIn)
  const logged = log ? factsIn(log) : { facts: [], unread: [] }
  return { stands: sheet.flatMap(read => read.facts), superseded: logged.facts, unread: [...sheet, logged].flatMap(read => read.unread), rounds: log ? roundsIn(log) : [], checkAgain: dateOn(research.sheet) }
}

function roundsIn(log: Node) {
  const rounds: Round[] = []
  for (const { text, line } of proseOf(log)) {
    const opened = ROUND.exec(text)
    const last = rounds.at(-1)
    if (opened) rounds.push({ number: Number(opened[1]), day: opened[2], line, stopped: null })
    else if (last && last.stopped === null) last.stopped = STOPPED.exec(text)?.[1].trimEnd() ?? null
  }
  return rounds
}

function dateOn(sheet: Node) {
  const prose = proseOf(sheet)
  const from = prose.findIndex(({ text }) => CHECK_AGAIN_BY.test(text))
  if (from === -1) return null
  const below = prose.slice(from + 1)
  const until = below.findIndex(({ text }) => HEADING.test(text))
  const [day] = below.slice(0, until === -1 ? below.length : until).flatMap(({ text }) => A_DAY.exec(text) ?? [])
  return day !== undefined && isADay(day) ? day : null
}

function isADay(day: string) {
  const at = Date.parse(`${day}T00:00:00Z`)
  return !Number.isNaN(at) && new Date(at).toISOString().startsWith(day)
}

function proseOf(file: Node) {
  const lines = linesOf(file.path)
  const inAFence = fenced(lines)
  return lines.flatMap((text, index) => (inAFence[index] ? [] : [{ text, line: index + 1 }]))
}

export function layoutFindings(estate: Estate, research: Research): Said[] {
  const { dirRel, sheet } = research
  const { stands, superseded, unread } = readResearch(research)
  const at = ({ rel, line }: Place) => `${posix.relative(dirRel, rel)}:${line}`
  const every = [...stands, ...superseded]
  const naming = every.flatMap(by => by.supersedes.map(named => ({ ...named, rel: by.rel, by: by.number })))
  const firstOfEach = <Held extends { number: number }>(held: Held[]) => held.filter((one, index) => held.findIndex(other => other.number === one.number) === index)
  const twice = firstOfEach(every).flatMap(first => {
    const [, second] = every.filter(fact => fact.number === first.number)
    return second ? [{ first, second }] : []
  })
  const stillHeld = stands.flatMap(fact => naming.filter(named => named.number === fact.number).slice(0, 1).map(named => ({ fact, by: named.by })))
  const lost = firstOfEach(naming.filter(named => !every.some(fact => fact.number === named.number)))
  const unnamed = superseded.filter(fact => !naming.some(named => named.number === fact.number))
  const undated = firstOfEach(naming.filter(named => named.day === null))
  const out = linksOut(estate, research)
  const log = `${dirRel}/${LOG_FILE}`
  return [
    ...counted(twice, sheet.rel, ({ first, second }) => `${dirRel} uses F${first.number} twice (${at(first)} and ${at(second)}); ${ONCE}`, ({ first, second }, count) => `${dirRel} uses ${count} numbers twice (first F${first.number}, ${at(first)} and ${at(second)}); ${ONCE}`),
    ...counted(stillHeld, sheet.rel, ({ fact, by }) => `${dirRel} still holds F${fact.number} on its sheet (${at(fact)}), which F${by} supersedes; ${LEAVES}`, ({ fact, by }, count) => `${dirRel} still holds ${count} superseded facts on its sheet (first F${fact.number}, ${at(fact)}, which F${by} supersedes); ${LEAVES}`),
    ...counted(lost, sheet.rel, named => `${dirRel} names F${named.number} as superseded (${at(named)}), and its log does not hold F${named.number}`, (named, count) => `${dirRel} names ${count} facts as superseded that its log does not hold (first F${named.number}, ${at(named)})`),
    ...counted(unnamed, log, fact => `${log} holds F${fact.number} (line ${fact.line}), which no fact names as superseded`, (fact, count) => `${log} holds ${count} facts that no fact names as superseded (first F${fact.number}, line ${fact.line})`),
    ...counted(undated, sheet.rel, named => `${dirRel} names F${named.number} as superseded with no date and reason (${at(named)})`, (named, count) => `${dirRel} names ${count} facts as superseded with no date and reason (first F${named.number}, ${at(named)})`),
    ...counted(out, out[0]?.rel ?? sheet.rel, link => `${link.rel} links out of its research (${link.target}, at line ${link.line}); ${LINKS_ITS_OWN}`, (link, count) => `${dirRel} has ${count} links out of its research (first ${link.target}, at ${at(link)}); ${LINKS_ITS_OWN}`),
    ...counted(unread, unread[0]?.rel ?? sheet.rel, line => `${line.rel} has a line that opens as a fact and does not read as one (line ${line.line})`, (line, count) => `${dirRel} has ${count} lines that open as a fact and do not read as one (first at ${at(line)})`),
  ]
}

function counted<Fault>(faults: Fault[], rel: string, one: (fault: Fault) => string, several: (first: Fault, count: number) => string): Said[] {
  if (faults.length === 0) return []
  return [{ rel, message: faults.length === 1 ? one(faults[0]) : several(faults[0], faults.length) }]
}

function factsIn(file: Node) {
  const lines = linesOf(file.path)
  const inAFence = fenced(lines)
  const facts: Fact[] = []
  const unread: Place[] = []
  lines.forEach((written, index) => {
    if (inAFence[index] || !OPENS_AS_A_FACT.test(written)) return
    const read = FACT.exec(written)
    if (!read) return void unread.push({ rel: file.rel, line: index + 1 })
    const nested = nestedUnder(lines, index)
    facts.push({ number: Number(read[1]), verified: read[2] === 'verified', disputed: read[3] !== undefined, rel: file.rel, line: index + 1, written, nested, supersedes: nested.flatMap(supersedingOn) })
  })
  return { facts, unread }
}

function nestedUnder(lines: string[], at: number) {
  let end = at + 1
  while (end < lines.length && (lines[end].trim() === '' || /^[ \t]/.test(lines[end]))) end += 1
  return lines.slice(at + 1, end).flatMap((text, offset) => (text.trim() === '' ? [] : [{ line: at + offset + 2, text: text.trim() }]))
}

function supersedingOn({ line, text }: { line: number; text: string }): Superseding[] {
  const named = SUPERSEDES.exec(text)
  return named ? [{ number: Number(named[1]), day: named[2] ?? null, reason: named[3] ?? null, line }] : []
}

function linksOut(estate: Estate, research: Research) {
  const item = research.item === null ? null : findWorkItem(estate, research.item)
  const within = [`${research.dirRel}/`, ...(item ? [`${item.dirRel}/sources/`] : [])]
  return research.files.flatMap(file => {
    const lines = linesOf(file.path)
    const inAFence = fenced(lines)
    return lines.flatMap((written, index) =>
      inAFence[index]
        ? []
        : parseLinks(written)
            .filter(link => !within.some(folder => posix.normalize(link.style === 'wiki' ? link.target : posix.join(posix.dirname(file.rel), link.target)).startsWith(folder)))
            .map(link => ({ rel: file.rel, line: index + 1, target: link.target })),
    )
  })
}

function linesOf(path: string) {
  try {
    return readFileSync(path, 'utf8').split(/\r?\n/)
  } catch {
    return []
  }
}

function researchIn(dirRel: string, name: string, inFolder: Node[]): Research[] {
  const sheet = inFolder.find(file => file.rel === `${dirRel}/${SHEET_FILE}`)
  const head = sheet && headOf(sheet.path)
  if (!sheet || !head || head.data.research === undefined) return []
  const files = inFolder.filter(file => !file.deep)
  const pages = files.filter(file => posix.dirname(file.rel) === dirRel && PAGE.test(posix.basename(file.rel)))
  return [{ name, dirRel, title: head.data.title ?? firstHeading(head.body) ?? name, item: head.data.item || null, sheet, pages, files, sources: inFolder.filter(file => file.deep) }]
}

function headOf(path: string) {
  try {
    return parseFrontmatter(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}
