import { readFileSync, statSync } from 'node:fs'
import { posix } from 'node:path'
import { noteWarnings } from './citations.mts'
import { standardsFiles } from './estate.mts'
import { glossaryPath } from './glossary.mts'
import { buildIndex } from './index-text.mts'
import { describeFile, expandImports } from './instructions.mts'
import { EVIDENCE_DIR, hubPath, inFlight, leftOut, listNodes, listWorkItems, passedOver, savedSourceNames, strayFiles } from './nodes.mts'
import { saidOf, unproven } from './proof.mts'
import { LOG_FILE, layoutFindings, listResearches, withoutResearches } from './research.mts'
import { fenced, formatBytes, plural, unquoted } from './text.mts'
import type { Env } from './cli.mts'
import type { Estate, Repo } from './estate.mts'
import type { Node, StrayFile, WorkItem } from './nodes.mts'
import type { Research } from './research.mts'

export type Level = 'ERROR' | 'WARN'

export type Check = 'hub' | 'glossary' | 'state' | 'entry' | 'node' | 'evidence' | 'standards' | 'index' | 'read' | 'proof' | 'mark' | 'research'

export interface Finding {
  level: Level
  check: Check
  rel: string | null
  message: string
}

const DATED = /(?<![\w/-])\d{4}-\d{2}-\d{2}(?![\d-]|\.\w)|\b\d{1,2} (?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/
const DATED_ALLOWED = 3
const VERIFIED = '`verified`'
const INFERRED = '`inferred`'
const TAB_IS = '    '
const NAMES_A_SOURCE = [/[\w.-]*\w\.[A-Za-z]\w*:\d+/, /https?:\/\/\S+/, /\]\([^)\s]+\)|\[\[[^\]]+\]\]/]

export function lintEstate(estate: Estate, env: Env): Finding[] {
  const items = listWorkItems(estate)
  const itemsInFlight = items.filter(inFlight)
  const nodes = withoutResearches(estate, listNodes(estate))
  const researches = listResearches(estate)
  const logs = new Set(researches.map(research => `${research.dirRel}/${LOG_FILE}`))
  return [
    ...hubFindings(estate, env),
    ...glossaryFindings(estate),
    ...items.flatMap(item => stateFindings(estate, item)),
    ...itemsInFlight.flatMap(item => entryFindings(estate, item)),
    ...once([...nodes, ...researches.flatMap(research => research.files)]).filter(node => !logs.has(node.rel)).flatMap(node => nodeFindings(estate, node)),
    ...markFindings(estate, once([...nodes, ...researches.flatMap(readForFacts)]), researches.flatMap(research => research.sources.map(source => posix.basename(source.rel)))),
    ...researches.flatMap(research => layoutFindings(estate, research)).map(({ rel, message }) => finding('WARN', 'research', rel, message)),
    ...items.flatMap(item => evidenceSizeFindings(estate, item)),
    ...strayFiles(estate).map(strayFinding),
    ...proofFindings(estate, itemsInFlight, env),
    ...estate.config.repos.flatMap(repo => standardsFindings(estate, repo, env)),
    ...indexFindings(estate, itemsInFlight.length, env),
    ...passedOver(estate).map(({ rel, why }) => finding('ERROR', 'read', rel, `${rel} ${why}, so the listings pass over it`)),
  ]
}

function hubFindings(estate: Estate, env: Env) {
  const path = hubPath(estate)
  const rel = estate.config.hub
  if (!statSync(path, { throwIfNoEntry: false })?.isFile()) return [finding('ERROR', 'hub', rel, `${rel} does not exist`)]
  return [...hubSizeFindings(estate, path, env), ...datedFindings(rel, readFileSync(path, 'utf8'))]
}

function glossaryFindings(estate: Estate) {
  const named = estate.config.glossary
  if (!named || statSync(glossaryPath(estate), { throwIfNoEntry: false })?.isFile()) return []
  return [finding('ERROR', 'glossary', named, `${named} does not exist`)]
}

function hubSizeFindings(estate: Estate, path: string, env: Env) {
  const budget = estate.config.budgets.hubLines
  const total = [describeFile(path), ...expandImports(path, env)].reduce((sum, file) => sum + file.lines, 0)
  if (total <= budget) return []
  return [finding('ERROR', 'hub', estate.config.hub, `${estate.config.hub} is ${total} lines with its imports (budget ${budget})`)]
}

function datedFindings(rel: string, text: string) {
  const dated = text.split('\n').flatMap((line, index) => (DATED.test(line) ? [index + 1] : []))
  if (dated.length <= DATED_ALLOWED) return []
  return [finding('WARN', 'hub', rel, `${dated.length} dated statements; status belongs in state files (first at line ${dated[0]})`)]
}

function stateFindings(estate: Estate, item: WorkItem) {
  if (item.entry?.kind !== 'state') return []
  const budget = estate.config.budgets.stateChars
  const { length } = readFileSync(item.entry.path, 'utf8')
  if (length <= budget) return []
  return [finding('ERROR', 'state', item.entry.rel, `${item.entry.rel} is ${length} characters (budget ${budget})`)]
}

function entryFindings(estate: Estate, item: WorkItem) {
  if (item.entry?.kind === 'state') return []
  if (!item.entry) return [finding('WARN', 'entry', null, `${item.id} has no STATE.md and no other entry file`)]
  const adopt = leftOut(estate.config, item.dirRel) ? '' : `; context-central work adopt ${item.id} gives it one`
  return [finding('WARN', 'entry', item.entry.rel, `${item.id} has no STATE.md; its entry file ${item.entry.rel} is ${formatBytes(item.entry.bytes)}${adopt}`)]
}

function nodeFindings(estate: Estate, node: Node) {
  const cap = estate.config.budgets.nodeBytes
  if (node.bytes <= cap) return []
  return [finding('WARN', 'node', node.rel, `${node.rel} is ${formatBytes(node.bytes)} (soft cap ${formatBytes(cap)})`)]
}

function once(nodes: Node[]) {
  const seen = new Set<string>()
  return nodes.filter(node => !seen.has(node.rel) && seen.add(node.rel))
}

function readForFacts({ dirRel, sheet, pages, files }: Research) {
  return files.filter(file => file === sheet || pages.includes(file) || file.rel === `${dirRel}/${LOG_FILE}`)
}

function markFindings(estate: Estate, nodes: Node[], ofResearches: string[]) {
  const saved = [...savedSourceNames(estate), ...ofResearches]
  const hub = hubPath(estate)
  return nodes.filter(node => node.path !== hub).flatMap(node => {
    const unsourced = claimsWithNoSource(readFileSync(node.path, 'utf8').split(/\r?\n/), saved)
    if (unsourced.length === 0) return []
    const [first] = unsourced
    const said = unsourced.length === 1 ? `names no source (at line ${first})` : `name no source (first at line ${first})`
    return [finding('WARN', 'mark', node.rel, `${node.rel} has ${plural(unsourced.length, 'claim')} marked verified that ${said}`)]
  })
}

function claimsWithNoSource(asWritten: string[], saved: string[]) {
  const lines = asWritten.map(unquoted)
  const inAFence = fenced(asWritten)
  const namesASource = (line: string) => NAMES_A_SOURCE.some(kind => kind.test(line)) || saved.some(name => line.includes(name))
  return lines.flatMap((line, at) => {
    const claim = !inAFence[at] && line.includes(VERIFIED) && !line.includes(INFERRED)
    return claim && !namesASource(line) && !linesUnder(lines, at).some(namesASource) ? [at + 1] : []
  })
}

function linesUnder(lines: string[], at: number) {
  const depth = indentOf(lines[at])
  let end = at + 1
  while (end < lines.length && (lines[end].trim() === '' || indentOf(lines[end]) > depth)) end += 1
  return lines.slice(at + 1, end)
}

function indentOf(line: string) {
  return line.slice(0, line.length - line.trimStart().length).replaceAll('\t', TAB_IS).length
}

function evidenceSizeFindings(estate: Estate, item: WorkItem) {
  const limit = estate.config.budgets.evidenceBytes
  if (!estate.config.evidence.commit) return []
  return item.evidence.files.filter(file => file.bytes > limit).map(file => finding('WARN', 'evidence', file.rel, `${file.rel} is ${formatBytes(file.bytes)} (limit ${formatBytes(limit)})`))
}

function strayFinding({ rel, dirRel }: StrayFile) {
  return finding('WARN', 'evidence', rel, `${rel} is not Markdown and is outside ${dirRel}/${EVIDENCE_DIR}/`)
}

function proofFindings(estate: Estate, itemsInFlight: WorkItem[], env: Env) {
  return itemsInFlight.flatMap(item => {
    const lacks = unproven(estate, item, env)
    return lacks.length > 0 ? [finding('WARN', 'proof', item.entry?.rel ?? null, saidOf(item, lacks))] : []
  })
}

function standardsFindings(estate: Estate, repo: Repo, env: Env) {
  const listed = standardsFiles(estate, repo)
    .filter(file => file.state !== 'file')
    .map(file => finding('WARN', 'standards', file.rel, `repo ${repo.name} names ${file.rel}, which ${file.state === 'folder' ? 'is a folder, not a file' : 'does not exist'}`))
  const note = noteWarnings(estate, repo, env)
  return note ? [...listed, ...note.said.map(said => finding('WARN', 'standards', note.rel, said))] : listed
}

function indexFindings(estate: Estate, count: number, env: Env) {
  const budget = estate.config.budgets.indexChars
  if (count === 0 || uncutIndex(estate, env).length <= budget) return []
  return [finding('WARN', 'index', null, `${count} items in flight do not fit in ${budget} characters; the list is cut`)]
}

function uncutIndex(estate: Estate, env: Env) {
  const budgets = { ...estate.config.budgets, indexChars: Infinity }
  return buildIndex({ ...estate, config: { ...estate.config, budgets } }, env, { absolute: true })
}

function finding(level: Level, check: Check, rel: string | null, detail: string): Finding {
  return { level, check, rel, message: `${check}: ${detail}` }
}
