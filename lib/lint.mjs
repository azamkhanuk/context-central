import { readFileSync, statSync } from 'node:fs'
import { buildIndex } from './index-text.mjs'
import { describeFile, expandImports } from './instructions.mjs'
import { hubPath, inFlight, listNodes, listWorkItems } from './nodes.mjs'
import { formatBytes } from './text.mjs'

const DATED = /(?<![\w/-])\d{4}-\d{2}-\d{2}(?![\d-]|\.\w)|\b\d{1,2} (?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/
const DATED_ALLOWED = 3

export function lintEstate(estate, env) {
  const items = listWorkItems(estate)
  const itemsInFlight = items.filter(inFlight)
  return [
    ...hubFindings(estate, env),
    ...items.flatMap(item => stateFindings(estate, item)),
    ...itemsInFlight.flatMap(entryFindings),
    ...listNodes(estate).flatMap(node => nodeFindings(estate, node)),
    ...indexFindings(estate, itemsInFlight.length),
  ]
}

function hubFindings(estate, env) {
  const path = hubPath(estate)
  const rel = estate.config.hub
  if (!statSync(path, { throwIfNoEntry: false })?.isFile()) return [finding('ERROR', 'hub', rel, `${rel} does not exist`)]
  return [...hubSizeFindings(estate, path, env), ...datedFindings(rel, readFileSync(path, 'utf8'))]
}

function hubSizeFindings(estate, path, env) {
  const budget = estate.config.budgets.hubLines
  const total = [describeFile(path), ...expandImports(path, env)].reduce((sum, file) => sum + file.lines, 0)
  if (total <= budget) return []
  return [finding('ERROR', 'hub', estate.config.hub, `${estate.config.hub} is ${total} lines with its imports (budget ${budget})`)]
}

function datedFindings(rel, text) {
  const dated = text.split('\n').flatMap((line, index) => (DATED.test(line) ? [index + 1] : []))
  if (dated.length <= DATED_ALLOWED) return []
  return [finding('WARN', 'hub', rel, `${dated.length} dated statements; status belongs in state files (first at line ${dated[0]})`)]
}

function stateFindings(estate, item) {
  if (item.entry?.kind !== 'state') return []
  const budget = estate.config.budgets.stateChars
  const { length } = readFileSync(item.entry.path, 'utf8')
  if (length <= budget) return []
  return [finding('ERROR', 'state', item.entry.rel, `${item.entry.rel} is ${length} characters (budget ${budget})`)]
}

function entryFindings(item) {
  if (item.entry?.kind === 'state') return []
  if (!item.entry) return [finding('WARN', 'entry', null, `${item.id} has no STATE.md and no other entry file`)]
  return [finding('WARN', 'entry', item.entry.rel, `${item.id} has no STATE.md; its entry file ${item.entry.rel} is ${formatBytes(item.entry.bytes)}`)]
}

function nodeFindings(estate, node) {
  const cap = estate.config.budgets.nodeBytes
  if (node.bytes <= cap) return []
  return [finding('WARN', 'node', node.rel, `${node.rel} is ${formatBytes(node.bytes)} (soft cap ${formatBytes(cap)})`)]
}

function indexFindings(estate, count) {
  const budget = estate.config.budgets.indexChars
  if (count === 0 || uncutIndex(estate).length <= budget) return []
  return [finding('WARN', 'index', null, `${count} items in flight do not fit in ${budget} characters; the list is cut`)]
}

function uncutIndex(estate) {
  const budgets = { ...estate.config.budgets, indexChars: Infinity }
  return buildIndex({ ...estate, config: { ...estate.config, budgets } }, { absolute: true })
}

function finding(level, check, rel, detail) {
  return { level, check, rel, message: `${check}: ${detail}` }
}
