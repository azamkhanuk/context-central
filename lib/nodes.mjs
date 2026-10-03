import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, posix, relative, resolve, sep } from 'node:path'
import { firstHeading, headings, parseFrontmatter, withoutCode } from './text.mjs'

const LINK = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]|\]\((?!\w+:)([^)\s#]+\.md)(?:#[^)]*)?\)/g
const listings = new Map()

export function hubPath(estate) {
  return join(estate.estateRoot, estate.config.hub)
}

export function inFlight(item) {
  return item.status !== 'done'
}

export function isDeep(config, rel) {
  const parts = rel.split('/')
  if (parts.slice(0, -1).some(part => config.deepDirs.includes(part))) return true
  return config.deepPatterns.some(pattern => globToRegExp(pattern).test(parts.at(-1)))
}

export function listFiles(estate) {
  return estate.config.nodeDirs
    .filter(dir => existsSync(join(estate.mapDir, dir)))
    .flatMap(dir => walk(estate.mapDir, dir))
    .filter(rel => !estate.config.notNodes.some(skipped => rel === skipped || rel.startsWith(`${skipped}/`)))
    .map(rel => describe(estate, rel))
}

export function listNodes(estate) {
  return listFiles(estate).filter(file => !file.deep)
}

export function readNode(estate, node) {
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
      .filter(Boolean),
  }
}

export function parseLinks(text) {
  return [...withoutCode(text).matchAll(LINK)].map(match => (match[1] ? { style: 'wiki', target: match[1].trim() } : { style: 'path', target: decoded(match[2]) }))
}

export function resolveLink(estate, fromRel, link) {
  const written = link.style === 'wiki' ? link.target : posix.join(posix.dirname(fromRel), link.target)
  const target = fromMap(estate, written).replace(/\.md$/, '')
  if (existsExactly(estate.mapDir, `${target}.md`)) return `${target}.md`
  const workPrefix = `${estate.config.workDir}/`
  if (!target.startsWith(workPrefix) || target.slice(workPrefix.length).includes('/')) return null
  return workItemIds(estate).includes(target.slice(workPrefix.length)) ? (workItem(estate, target.slice(workPrefix.length))?.entry?.rel ?? null) : null
}

export function workItemIds(estate) {
  const workAbs = join(estate.mapDir, estate.config.workDir)
  if (!existsSync(workAbs)) return []
  const ids = new Set()
  for (const entry of readdirSync(workAbs, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue
    if (entry.isDirectory()) ids.add(entry.name)
    else if (entry.isFile() && entry.name.endsWith('.md')) ids.add(entry.name.slice(0, -3))
  }
  return [...ids].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

export function listWorkItems(estate) {
  return workItemIds(estate)
    .map(id => workItem(estate, id))
    .filter(Boolean)
}

export function findWorkItem(estate, id) {
  const actual = workItemIds(estate).find(candidate => candidate.toLowerCase() === id.toLowerCase())
  return actual ? workItem(estate, actual) : null
}

function workItem(estate, id) {
  const { workDir } = estate.config
  const dirRel = `${workDir}/${id}`
  const noteRel = `${workDir}/${id}.md`
  const inFolder = existsSync(join(estate.mapDir, dirRel)) ? walk(estate.mapDir, dirRel).map(rel => describe(estate, rel)) : []
  const note = existsSync(join(estate.mapDir, noteRel)) ? describe(estate, noteRel) : null
  const entry = pickEntry(inFolder, dirRel, note)
  if (!entry && inFolder.length === 0) return null
  const head = entry ? parseFrontmatter(readFileSync(entry.path, 'utf8')) : { data: {}, body: '' }
  const deep = inFolder.filter(file => file.deep)
  return {
    id,
    dirRel,
    title: head.data.title ?? stripId(firstHeading(head.body) ?? id, id),
    status: head.data.status ?? 'active',
    entry,
    files: [...(note ? [note] : []), ...inFolder].filter(file => !file.deep && file.rel !== entry?.rel),
    deep: { count: deep.length, bytes: deep.reduce((sum, file) => sum + file.bytes, 0), files: deep },
  }
}

function pickEntry(inFolder, dirRel, note) {
  const inDir = name => inFolder.find(file => file.rel === `${dirRel}/${name}`)
  const candidates = [
    [inDir('STATE.md'), 'state'],
    [inDir('00-START-HERE.md'), 'start-here'],
    [note, 'note'],
    [inDir('README.md'), 'readme'],
  ]
  const [file, kind] = candidates.find(([candidate]) => candidate) ?? []
  return file ? { ...file, kind } : null
}

function fromMap(estate, written) {
  return relative(estate.mapDir, resolve(estate.mapDir, written)).split(sep).join('/')
}

function stripId(title, id) {
  return title.startsWith(id) ? title.slice(id.length).replace(/^[\s:.-]+/, '') || id : title
}

function describe(estate, rel) {
  const path = join(estate.mapDir, rel)
  return { id: rel.slice(0, -3), rel, path, kind: rel.split('/')[0], bytes: statSync(path).size, deep: isDeep(estate.config, rel) }
}

function walk(mapDir, dirRel) {
  const found = []
  for (const entry of readdirSync(join(mapDir, dirRel), { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const rel = `${dirRel}/${entry.name}`
    if (entry.isDirectory()) found.push(...walk(mapDir, rel))
    else if (entry.isFile() && entry.name.endsWith('.md')) found.push(rel)
  }
  return found.sort()
}

// A case-insensitive disk would accept [[Concepts/Gateway]]; a case-sensitive one would not.
function existsExactly(root, rel) {
  let dir = root
  for (const part of rel.split('/')) {
    if (part === '..') dir = dirname(dir)
    else if (!namesIn(dir).has(part)) return false
    else dir = join(dir, part)
  }
  return statSync(dir, { throwIfNoEntry: false })?.isFile() ?? false
}

function namesIn(dir) {
  if (!listings.has(dir)) listings.set(dir, new Set(readNames(dir)))
  return listings.get(dir)
}

function readNames(dir) {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

function decoded(target) {
  try {
    return decodeURIComponent(target)
  } catch {
    return target
  }
}

function globToRegExp(pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`)
}
