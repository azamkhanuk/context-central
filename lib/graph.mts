import { readFileSync, statSync } from 'node:fs'
import { posix, relative, sep } from 'node:path'
import { hubPath, listFiles, listWorkItems, parseLinks, resolveLink } from './nodes.mts'
import type { Estate } from './estate.mts'

export interface BrokenLink {
  from: string
  target: string
}

export interface Graph {
  nodes: number
  links: number
  broken: BrokenLink[]
  orphans: string[]
  unreferenced: string[]
}

interface Source {
  rel: string
  path: string
  text: string
  links: { target: string; to: string | null }[]
}

export function graphEstate(estate: Estate): Graph {
  const files = listFiles(estate)
  const nodes = files.filter(file => !file.deep).map(file => source(estate, file.rel, file.path))
  const hub = hubSource(estate)
  const sources = hub ? [hub, ...nodes.filter(node => node.path !== hub.path)] : nodes
  const linked = new Set(sources.flatMap(from => from.links.filter(link => link.to && link.to !== from.rel).map(link => link.to)))
  const items = listWorkItems(estate)
  const exempt = new Set([hub?.path, ...items.flatMap(item => [item.entry, ...item.files].map(file => file?.path))])
  const isOrphan = (node: Source) => !linked.has(node.rel) && !exempt.has(node.path) && !node.rel.startsWith('log/')
  const isWritten = (rel: string) => sources.some(from => from.text.includes(posix.basename(rel)))
  const isNamed = (rel: string) => linked.has(rel) || isWritten(rel)
  const evidence = items.flatMap(item => item.evidence.files)
  return {
    nodes: nodes.length,
    links: nodes.reduce((sum, node) => sum + new Set(node.links.map(link => link.to).filter(Boolean)).size, 0),
    broken: sources.flatMap(from => from.links.filter(link => !link.to).map(link => ({ from: from.rel, target: link.target }))),
    orphans: nodes.filter(isOrphan).map(node => node.rel),
    unreferenced: [...files.filter(file => file.deep && !isNamed(file.rel)), ...evidence.filter(file => !isWritten(file.rel))].map(file => file.rel),
  }
}

function hubSource(estate: Estate) {
  const path = hubPath(estate)
  return statSync(path, { throwIfNoEntry: false })?.isFile() ? source(estate, estate.config.hub, path, relative(estate.mapDir, path).split(sep).join('/')) : null
}

function source(estate: Estate, rel: string, path: string, relInMap = rel): Source {
  const text = readFileSync(path, 'utf8')
  const links = parseLinks(text).map(link => ({ target: link.target, to: resolveLink(estate, relInMap, link) }))
  return { rel, path, text, links }
}
