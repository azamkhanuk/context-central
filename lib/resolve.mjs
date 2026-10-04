import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, posix } from 'node:path'
import { keyRegexes } from './estate.mjs'
import { findWorkItem, isDeep, listNodes, listWorkItems, readNode, workItemIds } from './nodes.mjs'
import { formatBytes, parseFrontmatter, plural } from './text.mjs'

const KIND_RANK = ['concepts', 'edges', 'areas', 'repos', 'decisions', 'docs']
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
const MIN_FORM_RUNS = 2
const HEADING_LINE = /^#{1,6}\s+.*$/gm
const STOP_WORDS = new Set(
  `about after all also and any are because been before but can could did does for from get had has have her here him his how into its
  just let like make may more most need new not now off one only other our out over please put say see she should some such than that the
  their them then there these they this those too two use very want was way were what when where which who why will with would you your`.split(/\s+/),
)
const PR_LINK = /https:\/\/github\.com\/[\w.-]+\/([\w.-]+)\/pull\/\d+/g

export function resolveQuery(estate, query, { max = estate.config.budgets.resolveMax, freeText = true } = {}) {
  for (const route of [byWorkItem, byItemForm, byPrLink, byRepoName, ...(freeText ? [byFreeText] : [])]) {
    const found = route(estate, query, max)
    if (found) return found
  }
  return null
}

export function formatPointers(resolution, { absolute = false } = {}) {
  const shown = place => (absolute ? place.path : place.rel)
  const lines = [`Context for ${resolution.label}:`]
  for (const pointer of resolution.pointers) lines.push(`- ${shown(pointer)} (${formatBytes(pointer.bytes)}) ${pointer.why}`)
  if (resolution.more > 0) lines.push(moreLine(resolution))
  if (resolution.notes) lines.push(`Other notes of this item: ${counted(resolution.notes)} under ${shown(resolution.notes)}.`)
  if (resolution.deep) lines.push(`Deep tier: ${counted(resolution.deep)} under ${shown(resolution.deep)}, not listed one by one.`)
  return lines.join('\n')
}

function byWorkItem(estate, query, max) {
  const item = itemNamedIn(estate, query)
  return item && itemResolution(estate, item, 'item', max)
}

function byItemForm(estate, query, max) {
  const asked = runsOf(query)
  const item = listWorkItems(estate).find(candidate => candidate.entry && [candidate.id, candidate.title].some(form => startOf(asked, runsOf(form)) >= 0))
  return item && itemResolution(estate, item, 'item', max)
}

function startOf(asked, form) {
  if (form.length < MIN_FORM_RUNS) return form.length > 0 && asked.join(' ') === form.join(' ') ? 0 : -1
  return asked.findIndex((_, at) => form.every((run, offset) => asked[at + offset] === run))
}

function runsOf(text) {
  return text.toLowerCase().match(RUN) ?? []
}

function byPrLink(estate, query, max) {
  for (const [url, repo] of query.matchAll(PR_LINK)) {
    const item = listWorkItems(estate).find(candidate => candidate.entry && mentions(candidate, url))
    const found = item ? itemResolution(estate, item, 'pr', max) : repoResolution(estate, repo, 'pr', max)
    if (found) return found
  }
  return null
}

function mentions(item, url) {
  const exact = new RegExp(`${escapeRegExp(url)}(?!\\d)`)
  return [item.entry, ...item.files].some(file => exact.test(readFileSync(file.path, 'utf8')))
}

function byRepoName(estate, query, max) {
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

function byFreeText(estate, query, max) {
  const asked = [...new Set(wordsOf(query))].filter(word => !STOP_WORDS.has(word))
  if (asked.length < MIN_WORDS) return null
  const notes = listNodes(estate)
    .filter(node => !node.rel.startsWith('log/'))
    .map(profile)
  const words = asked.filter(word => !common(notes, word))
  const scored = notes.map(note => scoreNote(note, words)).sort((a, b) => b.score - a.score)
  if (scored.length === 0 || !confident(scored[0])) return null
  const passing = scored.filter(confident).map(found => pointer(estate, found.rel, `matches: ${found.matched.join(', ')}`))
  const pointers = passing.slice(0, max)
  return {
    by: 'text',
    key: `text:${pointers.map(found => found.rel).join(',')}`,
    item: null,
    name: null,
    label: `"${brief(query)}"`,
    pointers,
    more: passing.length - pointers.length,
    notes: null,
    deep: null,
  }
}

function common(notes, word) {
  const carrying = notes.filter(note => note.all.has(word)).length
  return carrying > COMMON_FLOOR && carrying > notes.length * COMMON_SHARE
}

function profile(node) {
  const { body } = parseFrontmatter(readFileSync(node.path, 'utf8'))
  const name = new Set(wordsOf(posix.basename(node.id)))
  const heading = new Set(wordsOf((body.match(HEADING_LINE) ?? []).join(' ')))
  const prose = new Map()
  for (const word of wordsOf(body.replace(HEADING_LINE, ''))) prose.set(word, (prose.get(word) ?? 0) + 1)
  return { rel: node.rel, name, heading, prose, all: new Set([...name, ...heading, ...prose.keys()]) }
}

function scoreNote(note, words) {
  const scores = words.map(word => (note.name.has(word) ? NAME_SCORE : 0) + (note.heading.has(word) ? HEADING_SCORE : 0) + Math.min(BODY_CAP, note.prose.get(word) ?? 0))
  return { rel: note.rel, score: scores.reduce((sum, score) => sum + score, 0), matched: words.filter((_, at) => scores[at] > 0) }
}

function confident(found) {
  return found.score >= MIN_SCORE && found.matched.length >= MIN_WORDS
}

function wordsOf(text) {
  return text.toLowerCase().match(WORD) ?? []
}

function brief(query) {
  const line = query.replace(/\s+/g, ' ').trim()
  return line.length <= LABEL_CHARS ? line : `${line.slice(0, LABEL_CHARS - 3)}...`
}

function itemNamedIn(estate, query) {
  for (const name of namesIn(estate, query)) {
    const item = findWorkItem(estate, name)
    if (item?.entry) return item
  }
  return null
}

function namesIn(estate, query) {
  const ids = workItemIds(estate).map(id => id.toLowerCase())
  const keys = keyRegexes(estate.config)
    .flatMap(regex => [...query.matchAll(regex)])
    .map(match => ({ name: match[0].toLowerCase(), at: match.index }))
    .filter(found => ids.includes(found.name))
  const plain = ids
    .filter(id => id.length >= MIN_ID_LENGTH)
    .map(id => ({ name: id, at: query.search(wholeWord(id)) }))
    .filter(found => found.at >= 0)
  const whole = ids.filter(id => id === query.trim().toLowerCase())
  return [...new Set([...whole, ...[...keys, ...plain].sort((a, b) => a.at - b.at).map(found => found.name)])]
}

function itemResolution(estate, item, by, max) {
  const entry = readNode(estate, item.entry)
  const specRel = `${item.dirRel}/SPEC.md`
  const lead = [
    pointer(estate, entry.rel, item.entry.kind === 'state' ? 'state file: where the work stands and what is next' : 'entry note of the work item'),
    ...(item.files.some(file => file.rel === specRel) ? [pointer(estate, specRel, 'spec of the work item')] : []),
  ]
  const linked = linkedFrom(estate, entry).filter(rel => rel !== specRel)
  const named = namedRepoNotes(estate, entry.text).filter(rel => rel !== entry.rel && !linked.includes(rel))
  const rest = [...linked.map(rel => pointer(estate, rel, 'linked from the work item')), ...named.map(rel => pointer(estate, rel, 'named in the work item'))]
  const answer = capped(lead, rest, max)
  return { by, key: `item:${item.id}`, item: item.id, name: item.id, label: `work item ${item.id}`, ...answer, notes: otherNotes(estate, item, answer.pointers), deep: deepTier(estate, item) }
}

function otherNotes(estate, item, pointers) {
  const listed = new Set(pointers.map(found => found.rel))
  const unlisted = item.files.filter(file => !listed.has(file.rel))
  if (unlisted.length === 0) return null
  return { count: unlisted.length, bytes: unlisted.reduce((sum, file) => sum + file.bytes, 0), rel: item.dirRel, path: join(estate.mapDir, item.dirRel) }
}

function repoResolution(estate, name, by, max) {
  const rel = `repos/${name}.md`
  if (!existsSync(join(estate.mapDir, rel))) return null
  const note = readNode(estate, { id: rel.slice(0, -3), rel, path: join(estate.mapDir, rel) })
  const rest = linkedFrom(estate, note).map(linked => pointer(estate, linked, 'linked from the repo note'))
  return { by, key: `repo:${name}`, item: null, name, label: `repo ${name}`, ...capped([pointer(estate, rel, 'repo note')], rest, max), notes: null, deep: null }
}

function linkedFrom(estate, node) {
  return [...new Set(node.links)]
    .filter(rel => rel !== node.rel && !rel.startsWith('../') && !rel.startsWith('log/') && !isDeep(estate.config, rel))
    .sort((a, b) => rank(a) - rank(b))
}

function rank(rel) {
  const kind = KIND_RANK.indexOf(rel.split('/')[0])
  return kind >= 0 ? kind : KIND_RANK.length
}

function namedRepoNotes(estate, text) {
  return estate.config.repos
    .filter(repo => wholeWord(repo.name).test(text))
    .map(repo => `repos/${repo.name}.md`)
    .filter(rel => existsSync(join(estate.mapDir, rel)))
}

function wholeWord(word) {
  return new RegExp(`(?<![\\w-])${escapeRegExp(word)}(?![\\w-])`, 'i')
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function capped(lead, rest, max) {
  return { pointers: [...lead, ...rest.slice(0, max)], more: Math.max(0, rest.length - max) }
}

function pointer(estate, rel, why) {
  const path = join(estate.mapDir, rel)
  return { rel, path, bytes: statSync(path).size, why }
}

function deepTier(estate, item) {
  if (item.deep.count === 0) return null
  const rel = commonDir(item.deep.files.map(file => posix.dirname(file.rel)))
  return { count: item.deep.count, bytes: item.deep.bytes, rel, path: join(estate.mapDir, rel) }
}

function commonDir(dirs) {
  const shared = dirs[0].split('/')
  for (const dir of dirs.slice(1)) {
    const parts = dir.split('/')
    let same = 0
    while (same < shared.length && shared[same] === parts[same]) same += 1
    shared.length = same
  }
  return shared.join('/')
}

function moreLine(resolution) {
  const { by, name, more, pointers } = resolution
  const one = more === 1
  const kind = by === 'text' ? 'matching' : 'linked'
  const rerun = by === 'text' ? 'a higher --max' : `context-central resolve ${name} --max ${Math.max(MORE_MAX, pointers.length + more)}`
  return `${one ? `1 more ${kind} note is` : `${more} more ${kind} notes are`} not listed; ${rerun} lists ${one ? 'it' : 'them'}.`
}

function counted(group) {
  return `${plural(group.count, 'file')} (${formatBytes(group.bytes)})`
}
