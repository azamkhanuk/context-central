import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { withoutBom } from './text.mts'
import type { Estate } from './estate.mts'

export interface Term {
  term: string
  line: number
}

const FENCE = /^ *(```|~~~)/
const BOLD = /^\s*(?:[-*+]\s+|\d+[.)]\s+)?\*\*(.+?)\*\*/
const HEADING = /^#{1,6}\s+(.+?)\s*$/

export function glossaryPath(estate: Estate) {
  return join(estate.mapDir, 'glossary.md')
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

function linesOf(path: string) {
  try {
    return withoutBom(readFileSync(path, 'utf8')).split(/\r?\n/)
  } catch {
    return []
  }
}
