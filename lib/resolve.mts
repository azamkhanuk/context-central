import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, posix, relative, sep } from 'node:path'
import { PULL_REQUESTS, TICKETS, holding, isLink, listed, referenceOf, referencesIn, sameReference } from './connections.mts'
import { standardsFiles } from './estate.mts'
import { findWorkItem, isDeep, listNodes, listWorkItems, readNode, workItemIds } from './nodes.mts'
import { formatBytes, parseFrontmatter, plural } from './text.mts'
import type { Connection, Reference } from './connections.mts'
import type { Estate } from './estate.mts'
import type { MapFile, Node, NodeText, WorkItem } from './nodes.mts'

export interface Pointer extends MapFile {
  why: string
}

export interface Counted {
  count: number
  bytes: number
  rel: string
  path: string
}

export type Route = 'item' | 'pr' | 'link' | 'repo' | 'text'

export interface Resolution {
  by: Route
  key: string
  item: string | null
  name: string | null
  label: string
  pointers: Pointer[]
  more: number
  notes: Counted | null
  deep: Counted | null
  evidence: Counted | null
}

export interface Unanswered {
  text: string
  connection: string
  key: string
}

interface Profile {
  rel: string
  name: Set<string>
  heading: Set<string>
  prose: Map<string, number>
  all: Set<string>
}

interface Scored {
  rel: string
  score: number
  matched: string[]
}

const KIND_RANK = ['concepts', 'edges', 'areas', 'repos', 'standards', 'decisions', 'docs']
const MIN_ID_LENGTH = 5
const MORE_MAX = 20
const LABEL_CHARS = 80
const COMMON_SHARE = 0.4
const COMMON_FLOOR = 2
const MIN_SCORE = 14
const MIN_WORDS = 2
const NAME_SCORE = 12
const HEADING_SCORE = 6
const BODY_CAP = 4
const WORD = /\p{L}{3,}/gu
const RUN = /[\p{L}\p{N}]+/gu
const MIN_PHRASE_RUNS = 2
const UNANSWERED_MAX = 3
const DIGITS_ALONE = /^\d+$/
const HEADING_LINE = /^#{1,6}\s+.*$/gm
const STOP_WORDS = new Set(
  `about after all also and any are because been before but can could did does for from get had has have her here him his how into its
  just let like make may more most need new not now off one only other our out over please put say see she should some such than that the
  their them then there these they this those too two use very want was way were what when where which who why will with would you your`.split(/\s+/),
)

export function resolveQuery(estate: Estate, query: string, { max = estate.config.budgets.resolveMax, plainWords = true, itemWords = false }: { max?: number; plainWords?: boolean; itemWords?: boolean } = {}): Resolution | null {
  const routes = [byWorkItem, ...(plainWords ? [byItemNameOrTitle] : []), byLink, byRepoName, ...(plainWords ? [byFreeText] : []), ...(itemWords ? [byItemWords] : [])]
  for (const route of routes) {
    const found = route(estate, query, max)
    if (found) return found
  }
  return null
}

export function formatPointers(resolution: Resolution, { absolute = false }: { absolute?: boolean } = {}) {
  const shown = (place: Pointer | Counted) => (absolute ? place.path : place.rel)
  const lines = [`Context for ${resolution.label}:`]
  for (const pointer of resolution.pointers) lines.push(`- ${shown(pointer)} (${formatBytes(pointer.bytes)}) ${pointer.why}`)
  if (resolution.more > 0) lines.push(moreLine(resolution))
  if (resolution.notes) lines.push(`Other notes of this item: ${counted(resolution.notes)} under ${shown(resolution.notes)}.`)
  if (resolution.deep) lines.push(`Deep tier: ${counted(resolution.deep)} under ${shown(resolution.deep)}, not listed one by one.`)
  if (resolution.evidence) lines.push(`Evidence: ${counted(resolution.evidence)} under ${shown(resolution.evidence)}, not listed one by one.`)
  return lines.join('\n')
}

export function unansweredIn(estate: Estate, query: string, told: string[] = []): Unanswered[] {
  const tickets = holding(listed(estate.config.connections), TICKETS)
  if (tickets.length === 0) return []
  const answering = answerer(estate, tickets, workItemIds(estate).map(id => id.toLowerCase()))
  const found = referencesIn(tickets, query)
    .filter(reference => !DIGITS_ALONE.test(reference.text) && answering(reference) === null)
    .map(({ text, connection, id }) => ({ text, connection: connection.name, key: `reference:${connection.name}:${id.toLowerCase()}` }))
  return found.filter((one, index) => !told.includes(one.key) && found.findIndex(other => other.key === one.key) === index).slice(0, UNANSWERED_MAX)
}

export function formatUnanswered({ text, connection }: Unanswered) {
  return `${text} reads as a ticket of connection ${connection}. No work item answers to it.`
}

function resolution({ by, key, item = null, name = null, label, pointers, more, notes = null, deep = null, evidence = null }: Pick<Resolution, 'by' | 'key' | 'label' | 'pointers' | 'more'> & Partial<Resolution>): Resolution {
  return { by, key, item, name, label, pointers, more, notes, deep, evidence }
}

function byWorkItem(estate: Estate, query: string, max: number) {
  const item = itemNamedIn(estate, query)
  return item && itemResolution(estate, item, 'item', max)
}

function byItemNameOrTitle(estate: Estate, query: string, max: number) {
  const asked = runsOf(query)
  const [first, ...others] = listWorkItems(estate)
    .filter(item => item.entry)
    .flatMap(item => [item.id, item.title, ...(item.ticket ? [item.ticket] : [])].map(runsOf).map(phrase => ({ item, at: startOf(asked, phrase), length: phrase.length })))
    .filter(found => found.at >= 0)
    .sort((a, b) => a.at - b.at || b.length - a.length)
  if (!first || others.some(other => other.at === first.at && other.length === first.length && other.item.id !== first.item.id)) return null
  return itemResolution(estate, first.item, 'item', max)
}

function startOf(asked: string[], phrase: string[]) {
  if (phrase.length < MIN_PHRASE_RUNS) return phrase.length > 0 && asked.join(' ') === phrase.join(' ') ? 0 : -1
  return asked.findIndex((_, at) => phrase.every((run, offset) => asked[at + offset] === run))
}

function runsOf(text: string): string[] {
  return text.toLowerCase().match(RUN) ?? []
}

function byLink(estate: Estate, query: string, max: number) {
  const connections = [...listed(estate.config.connections), ...holding(estate.unasked, PULL_REQUESTS)]
  for (const { text, repo, connection } of referencesIn(connections, query).filter(isLink)) {
    const by = connection.entry.holds === PULL_REQUESTS ? 'pr' : 'link'
    const item = listWorkItems(estate).find(candidate => candidate.entry && mentions(candidate, text))
    const found = item ? itemResolution(estate, item, by, max) : repo ? repoResolution(estate, repo, by, max) : null
    if (found) return found
  }
  return null
}

function mentions(item: WorkItem, url: string) {
  const exact = new RegExp(`${escapeRegExp(url)}(?!\\d)`)
  return [...(item.entry ? [item.entry] : []), ...item.files].some(file => exact.test(readFileSync(file.path, 'utf8')))
}

function byRepoName(estate: Estate, query: string, max: number) {
  const named = estate.config.repos
    .map(repo => ({ name: repo.name, at: query.search(wholeWord(repo.name)) }))
    .filter(found => found.at >= 0)
    .sort((a, b) => a.at - b.at)
  for (const { name } of named) {
    const found = repoResolution(estate, name, 'repo', max)
    if (found) return found
  }
  return null
}

function byFreeText(estate: Estate, query: string, max: number) {
  const asked = countedWords(query)
  if (asked.length < MIN_WORDS) return null
  const notes = listNodes(estate)
    .filter(node => !node.rel.startsWith('log/'))
    .map(profile)
  const words = asked.filter(word => !common(notes, word))
  const scored = notes.map(note => scoreNote(note, words)).sort((a, b) => b.score - a.score)
  if (scored.length === 0 || !confident(scored[0])) return null
  const passing = scored.filter(confident).map(found => pointer(estate, found.rel, `matches: ${found.matched.join(', ')}`))
  const pointers = passing.slice(0, max)
  return resolution({ by: 'text', key: `text:${pointers.map(found => found.rel).join(',')}`, label: `"${brief(query)}"`, pointers, more: passing.length - pointers.length })
}

function byItemWords(estate: Estate, query: string, max: number) {
  const asked = countedWords(query)
  if (asked.length < MIN_WORDS) return null
  const holding = listWorkItems(estate).filter(item => item.entry && asked.every(word => wordsOf(`${item.id} ${item.title}`).includes(word)))
  return holding.length === 1 ? itemResolution(estate, holding[0], 'item', max) : null
}

function countedWords(query: string) {
  return [...new Set(wordsOf(query))].filter(word => !STOP_WORDS.has(word))
}

function common(notes: Profile[], word: string) {
  const carrying = notes.filter(note => note.all.has(word)).length
  return carrying > COMMON_FLOOR && carrying > notes.length * COMMON_SHARE
}

function profile(node: Node): Profile {
  const { body } = parseFrontmatter(readFileSync(node.path, 'utf8'))
  const name = new Set(wordsOf(posix.basename(node.id)))
  const heading = new Set(wordsOf((body.match(HEADING_LINE) ?? []).join(' ')))
  const prose = new Map<string, number>()
  for (const word of wordsOf(body.replace(HEADING_LINE, ''))) prose.set(word, (prose.get(word) ?? 0) + 1)
  return { rel: node.rel, name, heading, prose, all: new Set([...name, ...heading, ...prose.keys()]) }
}

function scoreNote(note: Profile, words: string[]): Scored {
  const scores = words.map(word => (note.name.has(word) ? NAME_SCORE : 0) + (note.heading.has(word) ? HEADING_SCORE : 0) + Math.min(BODY_CAP, note.prose.get(word) ?? 0))
  return { rel: note.rel, score: scores.reduce((sum, score) => sum + score, 0), matched: words.filter((_, at) => scores[at] > 0) }
}

function confident(found: Scored) {
  return found.score >= MIN_SCORE && found.matched.length >= MIN_WORDS
}

function wordsOf(text: string): string[] {
  return text.toLowerCase().match(WORD) ?? []
}

function brief(query: string) {
  const line = query.replace(/\s+/g, ' ').trim()
  return line.length <= LABEL_CHARS ? line : `${line.slice(0, LABEL_CHARS - 3)}...`
}

function itemNamedIn(estate: Estate, query: string) {
  for (const name of namesIn(estate, query)) {
    const item = findWorkItem(estate, name)
    if (item?.entry) return item
  }
  return null
}

function namesIn(estate: Estate, query: string) {
  const ids = workItemIds(estate).map(id => id.toLowerCase())
  const tickets = holding(listed(estate.config.connections), TICKETS)
  const answering = answerer(estate, tickets, ids)
  const keys = referencesIn(tickets, query)
    .map(reference => ({ name: answering(reference), at: reference.at }))
    .filter((found): found is { name: string; at: number } => found.name !== null)
  const plain = ids
    .filter(id => id.length >= MIN_ID_LENGTH)
    .map(id => ({ name: id, at: query.search(wholeWord(id)) }))
    .filter(found => found.at >= 0)
  const whole = ids.filter(id => id === query.trim().toLowerCase())
  return [...new Set([...whole, ...[...keys, ...plain].sort((a, b) => a.at - b.at).map(found => found.name)])]
}

function answerer(estate: Estate, tickets: Connection[], ids: string[]) {
  let own: { id: string; reference: Reference | null }[] | null = null
  return (reference: Reference) => {
    const written = reference.text.toLowerCase()
    if (ids.includes(written)) return written
    own ??= listWorkItems(estate)
      .filter(item => item.entry)
      .map(item => ({ id: item.id.toLowerCase(), reference: referenceOf(tickets, item.ticket ?? item.id) }))
    return own.find(item => item.reference !== null && sameReference(item.reference, reference))?.id ?? null
  }
}

function itemResolution(estate: Estate, item: WorkItem, by: Route, max: number) {
  if (!item.entry) return null
  const entry = readNode(estate, item.entry)
  const specRel = `${item.dirRel}/SPEC.md`
  const lead = [
    pointer(estate, entry.rel, item.entry.kind === 'state' ? 'state file: where the work stands and what is next' : 'entry note of the work item'),
    ...(item.files.some(file => file.rel === specRel) ? [pointer(estate, specRel, 'spec of the work item')] : []),
  ]
  const linked = linkedFrom(estate, entry).filter(rel => rel !== specRel)
  const named = namedRepoNotes(estate, entry.text).filter(rel => rel !== entry.rel && !linked.includes(rel))
  const rest = [...linked.map(rel => pointer(estate, rel, 'linked from the work item')), ...named.map(rel => pointer(estate, rel, 'named in the work item'))]
  const listed = capped(lead, rest, max)
  return resolution({
    by,
    key: `item:${item.id}`,
    item: item.id,
    name: item.id,
    label: `work item ${item.id}`,
    ...listed,
    notes: otherNotes(estate, item, listed.pointers),
    deep: deepTier(estate, item),
    evidence: evidenceOf(estate, item),
  })
}

function otherNotes(estate: Estate, item: WorkItem, pointers: Pointer[]): Counted | null {
  const listed = new Set(pointers.map(found => found.rel))
  const unlisted = item.files.filter(file => !listed.has(file.rel))
  if (unlisted.length === 0) return null
  return { count: unlisted.length, bytes: unlisted.reduce((sum, file) => sum + file.bytes, 0), rel: item.dirRel, path: join(estate.mapDir, item.dirRel) }
}

function repoResolution(estate: Estate, name: string, by: Route, max: number) {
  const rel = `repos/${name}.md`
  if (!existsSync(join(estate.mapDir, rel))) return null
  const note = readNode(estate, { id: rel.slice(0, -3), rel, path: join(estate.mapDir, rel) })
  const standards = standardsNote(estate, name)
  const first = [pointer(estate, rel, 'repo note'), ...(standards ? [pointer(estate, standards, 'standards of the repo')] : [])]
  const rest = linkedFrom(estate, note)
    .filter(linked => linked !== standards)
    .map(linked => pointer(estate, linked, 'linked from the repo note'))
  return resolution({ by, key: `repo:${name}`, name, label: `repo ${name}`, ...capped(first, rest, max) })
}

function standardsNote(estate: Estate, name: string) {
  const repo = estate.config.repos.find(candidate => candidate.name === name)
  const note = repo && standardsFiles(estate, repo).find(file => file.note)
  return note && relative(estate.mapDir, note.path).split(sep).join('/')
}

function linkedFrom(estate: Estate, node: NodeText) {
  return [...new Set(node.links)]
    .filter(rel => rel !== node.rel && !rel.startsWith('../') && !rel.startsWith('log/') && !isDeep(estate.config, rel))
    .sort((a, b) => rank(a) - rank(b))
}

function rank(rel: string) {
  const kind = KIND_RANK.indexOf(rel.split('/')[0])
  return kind >= 0 ? kind : KIND_RANK.length
}

function namedRepoNotes(estate: Estate, text: string) {
  return estate.config.repos
    .filter(repo => wholeWord(repo.name).test(text))
    .map(repo => `repos/${repo.name}.md`)
    .filter(rel => existsSync(join(estate.mapDir, rel)))
}

function wholeWord(word: string) {
  return new RegExp(`(?<![\\w-])${escapeRegExp(word)}(?![\\w-])`, 'i')
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function capped(lead: Pointer[], rest: Pointer[], max: number) {
  return { pointers: [...lead, ...rest.slice(0, max)], more: Math.max(0, rest.length - max) }
}

function pointer(estate: Estate, rel: string, why: string): Pointer {
  const path = join(estate.mapDir, rel)
  return { rel, path, bytes: statSync(path).size, why }
}

function deepTier(estate: Estate, item: WorkItem): Counted | null {
  if (item.deep.count === 0) return null
  const rel = commonDir(item.deep.files.map(file => posix.dirname(file.rel)))
  return { count: item.deep.count, bytes: item.deep.bytes, rel, path: join(estate.mapDir, rel) }
}

function evidenceOf(estate: Estate, item: WorkItem): Counted | null {
  const { count, bytes, rel } = item.evidence
  return count > 0 ? { count, bytes, rel, path: join(estate.mapDir, rel) } : null
}

function commonDir(dirs: string[]) {
  const shared = dirs[0].split('/')
  for (const dir of dirs.slice(1)) {
    const parts = dir.split('/')
    let same = 0
    while (same < shared.length && shared[same] === parts[same]) same += 1
    shared.length = same
  }
  return shared.join('/')
}

function moreLine(resolution: Resolution) {
  const { by, name, more, pointers } = resolution
  const one = more === 1
  const kind = by === 'text' ? 'matching' : 'linked'
  const rerun = by === 'text' ? 'a higher --max' : `context-central resolve ${name} --max ${Math.max(MORE_MAX, pointers.length + more)}`
  return `${one ? `1 more ${kind} note is` : `${more} more ${kind} notes are`} not listed; ${rerun} lists ${one ? 'it' : 'them'}.`
}

function counted(group: Counted) {
  return `${plural(group.count, 'file')} (${formatBytes(group.bytes)})`
}
