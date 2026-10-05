import { readFileSync, statSync } from 'node:fs'
import { posix, relative, sep } from 'node:path'
import { hubPath, listFiles, listWorkItems, parseLinks, resolveLink } from './nodes.mts'

export function graphEstate(estate) {
  const files = listFiles(estate)
  const nodes = files.filter(file => !file.deep).map(file => source(estate, file.rel, file.path))
  const hub = hubSource(estate)
  const sources = hub ? [hub, ...nodes.filter(node => node.path !== hub.path)] : nodes
  const linked = new Set(sources.flatMap(from => from.links.filter(link => link.to && link.to !== from.rel).map(link => link.to)))
  const items = listWorkItems(estate)
  const exempt = new Set([hub?.path, ...items.flatMap(item => [item.entry, ...item.files].map(file => file?.path))])
  const isOrphan = node => !linked.has(node.rel) && !exempt.has(node.path) && !node.rel.startsWith('log/')
  const isWritten = rel => sources.some(from => from.text.includes(posix.basename(rel)))
  const isNamed = rel => linked.has(rel) || isWritten(rel)
  const evidence = items.flatMap(item => item.evidence.files)
  return {
    nodes: nodes.length,
    links: nodes.reduce((sum, node) => sum + new Set(node.links.map(link => link.to).filter(Boolean)).size, 0),
    broken: sources.flatMap(from => from.links.filter(link => !link.to).map(link => ({ from: from.rel, target: link.target }))),
    orphans: nodes.filter(isOrphan).map(node => node.rel),
    unreferenced: [...files.filter(file => file.deep && !isNamed(file.rel)), ...evidence.filter(file => !isWritten(file.rel))].map(file => file.rel),
  }
}

function hubSource(estate) {
  const path = hubPath(estate)
  return statSync(path, { throwIfNoEntry: false })?.isFile() ? source(estate, estate.config.hub, path, relative(estate.mapDir, path).split(sep).join('/')) : null
}

function source(estate, rel, path, relInMap = rel) {
  const text = readFileSync(path, 'utf8')
  const links = parseLinks(text).map(link => ({ target: link.target, to: resolveLink(estate, relInMap, link) }))
  return { rel, path, text, links }
}
