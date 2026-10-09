import { readFileSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'
import { withoutBom } from './text.mts'
import type { Estate } from './estate.mts'

export interface Term {
  term: string
  line: number
}

const FENCE = /^ *(```|~~~)/
const BOLD = /^ {0,3}(?:[-*+]\s+|\d+[.)]\s+)?\*\*(.+?)\*\*/
const HEADING = /^#{1,6}\s+(.+?)\s*$/

export function glossaryPath({ config, estateRoot, mapDir }: Estate) {
  return config.glossary ? join(estateRoot, config.glossary) : join(mapDir, 'glossary.md')
}

export function glossaryRepo(estate: Estate) {
  const glossary = glossaryPath(estate)
  const [nearest] = estate.config.repos
    .map(repo => ({ name: repo.name, folder: join(estate.estateRoot, repo.path) }))
    .filter(repo => holds(repo.folder, glossary))
    .sort((a, b) => b.folder.length - a.folder.length)
  const inMap = holds(estate.mapDir, glossary) && estate.mapDir.length >= (nearest?.folder.length ?? 0)
  return nearest && !inMap ? nearest.name : null
}

export function glossaryTerms(estate: Estate): Term[] {
  let fenced = false
  let headings = 0
  return linesOf(glossaryPath(estate)).flatMap((line, at) => {
    const fence = FENCE.test(line)
    if (fence) fenced = !fenced
    if (fence || fenced) return []
    const heading = HEADING.exec(line)
    if (heading) headings += 1
    const written = heading ? (headings > 1 ? heading[1] : undefined) : BOLD.exec(line)?.[1]
    return written ? [{ term: written.replace(/[\s:.]+$/, ''), line: at + 1 }] : []
  })
}

function holds(folder: string, file: string) {
  const within = relative(folder, file)
  return within !== '' && !within.startsWith('..') && !isAbsolute(within)
}

function linesOf(path: string) {
  try {
    return withoutBom(readFileSync(path, 'utf8')).split(/\r?\n/)
  } catch {
    return []
  }
}
