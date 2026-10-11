import { readFileSync, statSync } from 'node:fs'
import { standardsFiles } from './estate.mts'
import { glossaryPath } from './glossary.mts'
import { buildIndex } from './index-text.mts'
import { describeFile, expandImports } from './instructions.mts'
import { EVIDENCE_DIR, hubPath, inFlight, leftOut, listNodes, listWorkItems, strayFiles } from './nodes.mts'
import { formatBytes } from './text.mts'
import type { Env } from './cli.mts'
import type { Estate, Repo } from './estate.mts'
import type { Node, StrayFile, WorkItem } from './nodes.mts'

export type Level = 'ERROR' | 'WARN'

export type Check = 'hub' | 'glossary' | 'state' | 'entry' | 'node' | 'evidence' | 'standards' | 'index'

export interface Finding {
  level: Level
  check: Check
  rel: string | null
  message: string
}

const DATED = /(?<![\w/-])\d{4}-\d{2}-\d{2}(?![\d-]|\.\w)|\b\d{1,2} (?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/
const DATED_ALLOWED = 3

export function lintEstate(estate: Estate, env: Env): Finding[] {
  const items = listWorkItems(estate)
  const itemsInFlight = items.filter(inFlight)
  return [
    ...hubFindings(estate, env),
    ...glossaryFindings(estate),
    ...items.flatMap(item => stateFindings(estate, item)),
    ...itemsInFlight.flatMap(item => entryFindings(estate, item)),
    ...listNodes(estate).flatMap(node => nodeFindings(estate, node)),
    ...items.flatMap(item => evidenceSizeFindings(estate, item)),
    ...strayFiles(estate).map(strayFinding),
    ...estate.config.repos.flatMap(repo => standardsFindings(estate, repo)),
    ...indexFindings(estate, itemsInFlight.length),
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

function evidenceSizeFindings(estate: Estate, item: WorkItem) {
  const limit = estate.config.budgets.evidenceBytes
  if (!estate.config.evidence.commit) return []
  return item.evidence.files.filter(file => file.bytes > limit).map(file => finding('WARN', 'evidence', file.rel, `${file.rel} is ${formatBytes(file.bytes)} (limit ${formatBytes(limit)})`))
}

function strayFinding({ rel, dirRel }: StrayFile) {
  return finding('WARN', 'evidence', rel, `${rel} is not Markdown and is outside ${dirRel}/${EVIDENCE_DIR}/`)
}

function standardsFindings(estate: Estate, repo: Repo) {
  return standardsFiles(estate, repo)
    .filter(file => file.state !== 'file')
    .map(file => finding('WARN', 'standards', file.rel, `repo ${repo.name} names ${file.rel}, which ${file.state === 'folder' ? 'is a folder, not a file' : 'does not exist'}`))
}

function indexFindings(estate: Estate, count: number) {
  const budget = estate.config.budgets.indexChars
  if (count === 0 || uncutIndex(estate).length <= budget) return []
  return [finding('WARN', 'index', null, `${count} items in flight do not fit in ${budget} characters; the list is cut`)]
}

function uncutIndex(estate: Estate) {
  const budgets = { ...estate.config.budgets, indexChars: Infinity }
  return buildIndex({ ...estate, config: { ...estate.config, budgets } }, { absolute: true })
}

function finding(level: Level, check: Check, rel: string | null, detail: string): Finding {
  return { level, check, rel, message: `${check}: ${detail}` }
}
