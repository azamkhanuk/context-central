import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, posix, relative, resolve, sep } from 'node:path'
import { firstHeading, headings, parseFrontmatter, withoutCode } from './text.mts'
import type { Estate, Settings } from './estate.mts'
import type { Frontmatter, Parsed } from './text.mts'

export interface MapFile {
  rel: string
  path: string
  bytes: number
}

export interface Node extends MapFile {
  id: string
  kind: string
  deep: boolean
}

export type NodeRef = Pick<Node, 'id' | 'rel' | 'path'>

export interface NodeText extends NodeRef {
  text: string
  data: Frontmatter
  title: string
  headings: string[]
  links: string[]
}

export interface Link {
  style: 'wiki' | 'path'
  target: string
}

export type EntryKind = 'state' | 'start-here' | 'note' | 'readme'

export interface EntryFile extends Node {
  kind: EntryKind
}

export interface FileGroup<File extends MapFile> {
  count: number
  bytes: number
  files: File[]
}

interface WorkItemBody {
  id: string
  dirRel: string
  title: string
  status: string
  ticket: string | null
  files: Node[]
  deep: FileGroup<Node>
  evidence: FileGroup<MapFile> & { rel: string }
}

export interface WorkItemWithEntry extends WorkItemBody {
  entry: EntryFile
}

export interface WorkItemWithoutEntry extends WorkItemBody {
  entry: null
}

export type WorkItem = WorkItemWithEntry | WorkItemWithoutEntry

export interface StrayFile {
  rel: string
  dirRel: string
}

export const EVIDENCE_DIR = 'evidence'

const LINK = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]|\]\((?!\w+:)([^)\s#]+\.md)(?:#[^)]*)?\)/g
const listings = new Map<string, Set<string>>()

export function hubPath(estate: Estate) {
  return join(estate.estateRoot, estate.config.hub)
}

export function inFlight(item: WorkItem) {
  return item.status !== 'done'
}

export function isDeep(config: Settings, rel: string) {
  const parts = rel.split('/')
  if (parts.slice(0, -1).some(part => config.deepDirs.includes(part))) return true
  return config.deepPatterns.some(pattern => globToRegExp(pattern).test(parts.at(-1)!))
}

export function isEvidence(config: Settings, rel: string) {
  const prefix = `${config.workDir}/`
  const [, folder, ...below] = rel.startsWith(prefix) ? rel.slice(prefix.length).split('/') : []
  return folder === EVIDENCE_DIR && below.length > 0
}

export function listFiles(estate: Estate) {
  return estate.config.nodeDirs
    .filter(dir => existsSync(join(estate.mapDir, dir)))
    .flatMap(dir => walk(estate.mapDir, dir))
    .filter(rel => !estate.config.notNodes.some(skipped => rel === skipped || rel.startsWith(`${skipped}/`)))
    .filter(rel => !isEvidence(estate.config, rel))
    .map(rel => describe(estate, rel))
}

export function listNodes(estate: Estate) {
  return listFiles(estate).filter(file => !file.deep)
}

export function readNode(estate: Estate, node: NodeRef): NodeText {
  const text = readFileSync(node.path, 'utf8')
  const { data, body } = parseFrontmatter(text)
  return {
    ...node,
    text,
    data,
    title: data.title ?? firstHeading(body) ?? posix.basename(node.id),
    headings: headings(body),
    links: parseLinks(text)
      .map(link => resolveLink(estate, node.rel, link))
      .filter(link => link !== null),
  }
}

export function parseLinks(text: string): Link[] {
  return [...withoutCode(text).matchAll(LINK)].map(match => (match[1] ? { style: 'wiki', target: match[1].trim() } : { style: 'path', target: decoded(match[2]) }))
}

export function resolveLink(estate: Estate, fromRel: string, link: Link) {
  const written = link.style === 'wiki' ? link.target : posix.join(posix.dirname(fromRel), link.target)
  const target = fromMap(estate, written).replace(/\.md$/, '')
  if (existsExactly(estate.mapDir, `${target}.md`)) return `${target}.md`
  const workPrefix = `${estate.config.workDir}/`
  if (!target.startsWith(workPrefix) || target.slice(workPrefix.length).includes('/')) return null
  return workItemIds(estate).includes(target.slice(workPrefix.length)) ? (workItem(estate, target.slice(workPrefix.length))?.entry?.rel ?? null) : null
}

export function workItemIds(estate: Estate) {
  const workAbs = join(estate.mapDir, estate.config.workDir)
  if (!existsSync(workAbs)) return []
  const ids = new Set<string>()
  for (const entry of readdirSync(workAbs, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue
    if (entry.isDirectory()) ids.add(entry.name)
    else if (entry.isFile() && entry.name.endsWith('.md')) ids.add(entry.name.slice(0, -3))
  }
  return [...ids].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

export function strayFiles(estate: Estate): StrayFile[] {
  return workItemIds(estate)
    .map(id => `${estate.config.workDir}/${id}`)
    .filter(dirRel => isFolder(join(estate.mapDir, dirRel)))
    .flatMap(dirRel =>
      walk(estate.mapDir, dirRel, name => !isMarkdown(name))
        .filter(rel => !isEvidence(estate.config, rel))
        .map(rel => ({ rel, dirRel })),
    )
}

export function listWorkItems(estate: Estate) {
  return workItemIds(estate)
    .map(id => workItem(estate, id))
    .filter(item => item !== null)
}

export function findWorkItem(estate: Estate, id: string) {
  const actual = workItemIds(estate).find(candidate => candidate.toLowerCase() === id.toLowerCase())
  return actual ? workItem(estate, actual) : null
}

function workItem(estate: Estate, id: string): WorkItem | null {
  const { workDir } = estate.config
  const dirRel = `${workDir}/${id}`
  const noteRel = `${workDir}/${id}.md`
  const evidenceRel = `${dirRel}/${EVIDENCE_DIR}`
  const inFolder = existsSync(join(estate.mapDir, dirRel))
    ? walk(estate.mapDir, dirRel)
        .filter(rel => !isEvidence(estate.config, rel))
        .map(rel => describe(estate, rel))
    : []
  const evidence = isFolder(join(estate.mapDir, evidenceRel)) ? walk(estate.mapDir, evidenceRel, anyName).map(rel => sized(estate, rel)) : []
  const note = existsSync(join(estate.mapDir, noteRel)) ? describe(estate, noteRel) : null
  const entry = pickEntry(inFolder, dirRel, note)
  if (!entry && inFolder.length === 0 && evidence.length === 0) return null
  const head: Parsed = entry ? parseFrontmatter(readFileSync(entry.path, 'utf8')) : { data: {}, body: '' }
  const deep = inFolder.filter(file => file.deep)
  return {
    id,
    dirRel,
    title: head.data.title ?? stripId(firstHeading(head.body) ?? id, id),
    status: head.data.status ?? 'active',
    ticket: head.data.ticket || null,
    entry,
    files: [...(note ? [note] : []), ...inFolder].filter(file => !file.deep && file.rel !== entry?.rel),
    deep: group(deep),
    evidence: { ...group(evidence), rel: evidenceRel },
  }
}

function pickEntry(inFolder: Node[], dirRel: string, note: Node | null): EntryFile | null {
  const inDir = (name: string) => inFolder.find(file => file.rel === `${dirRel}/${name}`)
  const candidates: ([Node, EntryKind] | [null | undefined, EntryKind])[] = [
    [inDir('STATE.md'), 'state'],
    [inDir('00-START-HERE.md'), 'start-here'],
    [note, 'note'],
    [inDir('README.md'), 'readme'],
  ]
  const [file, kind] = candidates.find(([candidate]) => candidate) ?? []
  return file ? { ...file, kind } : null
}

function fromMap(estate: Estate, written: string) {
  return relative(estate.mapDir, resolve(estate.mapDir, written)).split(sep).join('/')
}

function stripId(title: string, id: string) {
  return title.startsWith(id) ? title.slice(id.length).replace(/^[\s:.-]+/, '') || id : title
}

function group<File extends MapFile>(files: File[]): FileGroup<File> {
  return { count: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0), files }
}

function describe(estate: Estate, rel: string): Node {
  return { id: rel.slice(0, -3), ...sized(estate, rel), kind: rel.split('/')[0], deep: isDeep(estate.config, rel) }
}

function sized(estate: Estate, rel: string): MapFile {
  const path = join(estate.mapDir, rel)
  return { rel, path, bytes: statSync(path).size }
}

function isFolder(path: string) {
  return statSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false
}

function isMarkdown(name: string) {
  return name.endsWith('.md')
}

function anyName() {
  return true
}

function walk(mapDir: string, dirRel: string, keeps: (name: string) => boolean = isMarkdown): string[] {
  const found: string[] = []
  for (const entry of readdirSync(join(mapDir, dirRel), { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const rel = `${dirRel}/${entry.name}`
    if (entry.isDirectory()) found.push(...walk(mapDir, rel, keeps))
    else if (entry.isFile() && keeps(entry.name)) found.push(rel)
  }
  return found.sort()
}

// A case-insensitive disk would accept [[Concepts/Gateway]]; a case-sensitive one would not.
function existsExactly(root: string, rel: string) {
  let dir = root
  for (const part of rel.split('/')) {
    if (part === '..') dir = dirname(dir)
    else if (!namesIn(dir).has(part)) return false
    else dir = join(dir, part)
  }
  return statSync(dir, { throwIfNoEntry: false })?.isFile() ?? false
}

function namesIn(dir: string) {
  if (!listings.has(dir)) listings.set(dir, new Set(readNames(dir)))
  return listings.get(dir)!
}

function readNames(dir: string) {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

function decoded(target: string) {
  try {
    return decodeURIComponent(target)
  } catch {
    return target
  }
}

function globToRegExp(pattern: string) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`)
}
