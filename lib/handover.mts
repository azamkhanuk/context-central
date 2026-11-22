import { constants, copyFileSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, posix } from 'node:path'
import { citedIn } from './citations.mts'
import { draftsDir, mapFiles } from './drafts.mts'
import { PluginError } from './errors.mts'
import { filesUnder, findWorkItem, parseLinks } from './nodes.mts'
import { readResearch, relOf } from './research.mts'
import { fenced, plural } from './text.mts'
import { holds } from './worktree.mts'
import type { Estate } from './estate.mts'
import type { MapFile } from './nodes.mts'
import type { Fact, Research } from './research.mts'

export interface Asked {
  folder: string
  written: string
  without: string[]
  reading: boolean
}

export interface HandedOver {
  files: number
  bytes: number
  leftOut: { kind: string; count: number }[]
  restOnLeftOut: number[]
}

interface Copy {
  to: string
  rel: string
  from: string
  text: string | null
  bytes: number
}

interface Places {
  kept: Map<string, string>
  gone: Set<string>
}

interface Page {
  file: MapFile
  to: string
  lines: string[]
}

interface Link {
  rel: string
  asWritten: string | null
  fragment: string
  shown: string
  words: string
  line: number
  whole: string
  again: (destination: string) => string
}

const READING_FILE = 'reading.md'
const LEFT_OUT = '(left out of this copy)'
const A_CODE_SPAN = /(`[^`\n]*`)/
const A_LINK = /\[\[([^\]|#]+)(#[^\]|]*)?(?:\|([^\]]*))?\]\]|(!?)\[((?:[^[\]]|\[[^[\]]*\])*)\]\(\s*(?:<([^<>\n]*)>|([^\s()<>]*(?:\([^\s()<>]*\)[^\s()<>]*)*))((?:\s+(?:"[^"\n]*"|'[^'\n]*'|\([^()\n]*\)))?)\s*\)/g
const A_DEFINITION = /^( {0,3}\[(?!\^)([^\]\n]+)\]:\s*)(?:<([^<>\n]*)>|(\S+))(.*)$/
const AN_ADDRESS = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i
const A_FULL_ADDRESS = /\b[a-z][a-z0-9+.-]*:\/\/\S/i
const A_FACT_NAMED = /\bF\d+\b/
const NOT_PLAIN_IN_A_LINK = /[%\s()<>#?"\\]/g
const THE_HEAD = /^\uFEFF?---\r?\n[\s\S]*?\r?\n---/
const A_LINE_OF_THE_HEAD = /[^\n]*\n/g
const RESTS_ON = /^- (?:Source|From):/
const NOTHING = 'nothing was handed over'
const NOT_THERE = ['ENOENT', 'ENOTDIR']

export function handOver(estate: Estate, research: Research, asked: Asked): HandedOver {
  refuseFolder(estate, asked)
  const { copies, done } = planned(estate, research, asked)
  write(asked, copies)
  return done
}

function refuseFolder(estate: Estate, { folder, written }: Asked) {
  const drafts = draftsDir(estate)
  const ofTheMap = [...(estate.layout === 'inner' ? [estate.mapDir] : mapFiles(estate).folders.map(own => join(estate.mapDir, own))), ...(drafts ? [drafts] : [])]
  const { taken, inside } = reached(written, () => {
    const asTheDiskHoldsIt = holdsOneNameUnderBothCases(estate.mapDir) ? (path: string) => path.normalize('NFC').toLowerCase() : (path: string) => path
    const place = asTheDiskHoldsIt(placeOf(folder))
    return { taken: isTaken(folder), inside: ofTheMap.some(own => holds(asTheDiskHoldsIt(placeOf(own)), place)) }
  })
  if (taken) throw new PluginError(`${written} is there already and is not an empty folder, so nothing was handed over`)
  if (inside) throw new PluginError(`${written} is inside the map, so nothing was handed over: a hand-over is a folder outside it`)
}

function reached<Read>(written: string, read: () => Read): Read {
  try {
    return read()
  } catch (error) {
    throw new PluginError(`${written} cannot be reached (${codeOf(error)}), so nothing was handed over`)
  }
}

function codeOf(error: unknown) {
  return (error as NodeJS.ErrnoException).code ?? 'unknown'
}

function isTaken(folder: string) {
  if (!lstatSync(folder, { throwIfNoEntry: false })) return false
  const there = statSync(folder, { throwIfNoEntry: false })
  return !there?.isDirectory() || readdirSync(folder).length > 0
}

function placeOf(path: string): string {
  try {
    return realpathSync.native(path)
  } catch (error) {
    if (!NOT_THERE.includes(codeOf(error)) || dirname(path) === path) throw error
    return join(placeOf(dirname(path)), basename(path))
  }
}

function holdsOneNameUnderBothCases(folder: string): boolean {
  const name = basename(folder)
  const inTheOtherCase = join(dirname(folder), name === name.toLowerCase() ? name.toUpperCase() : name.toLowerCase())
  if (inTheOtherCase === folder) return dirname(folder) !== folder && holdsOneNameUnderBothCases(dirname(folder))
  const [here, there] = [folder, inTheOtherCase].map(path => statSync(path, { throwIfNoEntry: false, bigint: true }))
  return here !== undefined && there !== undefined && here.ino === there.ino && here.dev === there.dev
}

function planned(estate: Estate, research: Research, { without, reading }: Asked): { copies: Copy[]; done: HandedOver } {
  const { dirRel } = research
  const { stands, kinds } = readResearch(research)
  const readingRel = `${dirRel}/${READING_FILE}`
  const pages: Page[] = research.files.filter(file => reading || file.rel !== readingRel).map(file => ({ file, to: file.rel.slice(dirRel.length + 1), lines: readFileSync(file.path, 'utf8').split('\n') }))
  const linked = new Set(pages.flatMap(({ file, lines }) => linksIn(file.rel, lines).map(link => link.rel)))
  const sources = [...research.sources.map(source => ({ source, to: source.rel.slice(dirRel.length + 1) })), ...itemSources(estate, research).filter(({ source }) => linked.has(source.rel))]
  const left = leftOut(research, sources.map(({ source }) => source), kinds, without)
  const taken = sources.filter(({ source }) => !left.has(source.rel))
  const places: Places = {
    kept: new Map([...pages.map(({ file, to }) => [file.rel, to] as const), ...taken.map(({ source, to }) => [source.rel, to] as const)]),
    gone: new Set([...left, ...(reading ? [] : [readingRel])]),
  }
  const texts = pages.map(page => ({ ...page, lines: rewritten(page.file.rel, page.lines, link => ledTo(estate, research, page, places, link)) }))
  for (const page of texts) refuseLinks(estate, research, page, new Set(places.kept.values()))
  const copies = [
    ...texts.map(({ file, to, lines }) => asText(file, to, file.rel === research.sheet.rel ? withoutItem(lines.join('\n')) : lines.join('\n'))),
    ...taken.map(({ source, to }) => ({ to, rel: source.rel, from: source.path, text: null, bytes: source.bytes })),
  ]
  refuseOneNameTwice(copies)
  const count = (kind: string) => sources.filter(({ source }) => left.has(source.rel) && kinds.get(source.rel) === kind).length
  return {
    copies,
    done: {
      files: copies.length,
      bytes: copies.reduce((sum, { bytes }) => sum + bytes, 0),
      leftOut: without.map(kind => ({ kind, count: count(kind) })),
      restOnLeftOut: stands.filter(fact => restsOnlyOn(fact, left)).map(fact => fact.number),
    },
  }
}

function itemSources(estate: Estate, research: Research) {
  const item = research.item === null ? null : findWorkItem(estate, research.item)
  const folder = item && `${item.dirRel}/sources`
  return folder ? filesUnder(estate, folder).map(source => ({ source, to: `sources/item-${source.rel.slice(folder.length + 1).split('/').join('-')}` })) : []
}

function leftOut({ name }: Research, sources: MapFile[], kinds: Map<string, string>, without: string[]) {
  if (without.length === 0) return new Set<string>()
  const unsorted = sources.filter(source => !kinds.has(source.rel))
  if (unsorted.length === 1) throw new PluginError(`${NOTHING}: ${unsorted[0].rel} has no kind under Sources on the fact sheet, so --without cannot tell whether to leave it out`)
  if (unsorted.length > 1) throw new PluginError(`${NOTHING}: ${plural(unsorted.length, 'saved source')} have no kind under Sources on the fact sheet (first ${unsorted[0].rel}), so --without cannot tell whether to leave them out`)
  const held = [...new Set(sources.map(source => kinds.get(source.rel)))]
  const unknown = without.find(kind => !held.includes(kind))
  if (unknown !== undefined) throw new PluginError(`no source of ${name} is of kind "${unknown}"; ${held.length > 0 ? `its kinds are: ${held.join(', ')}` : 'none of its sources has a kind'}`)
  return new Set(sources.filter(source => without.includes(kinds.get(source.rel) ?? '')).map(source => source.rel))
}

function prose(lines: string[]) {
  const inAFence = fenced(lines)
  return lines.flatMap((text, index) => (inAFence[index] ? [] : [{ text, line: index + 1 }]))
}

function linksIn(fromRel: string, lines: string[]) {
  const found: Link[] = []
  rewritten(fromRel, lines, link => (found.push(link), link.whole))
  return found
}

function rewritten(fromRel: string, lines: string[], write: (link: Link) => string) {
  const inAFence = fenced(lines)
  return lines.map((text, index) => {
    if (inAFence[index]) return text
    const line = index + 1
    const plainLink = (whole: string, words: string, destination: string, again: Link['again']) => {
      const target = targetOf(fromRel, destination)
      return target ? write({ ...target, shown: destination, words, line, whole, again }) : whole
    }
    const linkFromTheMap = (whole: string, target: string, fragment: string, itsWords: string | undefined) => {
      const words = itsWords ?? posix.basename(target).replace(/\.md$/, '')
      return write({ rel: relOf(fromRel, { style: 'wiki', target }), asWritten: null, fragment, shown: target, words, line, whole, again: destination => `[${words}](${destination})` })
    }
    const [, opening, label, angled, bare, rest] = A_DEFINITION.exec(text) ?? []
    if (opening !== undefined) return plainLink(text, label, angled ?? bare, destination => `${opening}${destination}${rest}`)
    const relink = (whole: string, mapTarget?: string, mapFragment = '', mapWords?: string, picture = '', words = '', inAngles?: string, plain = '', title = '') =>
      mapTarget === undefined ? plainLink(whole, words, inAngles ?? plain, destination => `${picture}[${words}](${destination}${title})`) : linkFromTheMap(whole, mapTarget, mapFragment, mapWords)
    return text
      .split(A_CODE_SPAN)
      .map((part, at) => (at % 2 === 1 ? part : part.replace(A_LINK, relink)))
      .join('')
  })
}

function targetOf(fromRel: string, destination: string) {
  if (destination === '' || destination.startsWith('#') || AN_ADDRESS.test(destination)) return null
  const [path, ...after] = destination.split('#')
  const asWritten = posix.normalize(decoded(path))
  return { rel: posix.isAbsolute(asWritten) ? asWritten : posix.normalize(posix.join(posix.dirname(fromRel), asWritten)), asWritten, fragment: after.length > 0 ? `#${after.join('#')}` : '' }
}

function decoded(path: string) {
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

function ledTo(estate: Estate, research: Research, { file, to }: Page, { kept, gone }: Places, link: Link) {
  if (gone.has(link.rel)) return `${link.words} ${LEFT_OUT}`
  const place = kept.get(link.rel)
  if (place === undefined) throw refusal(estate, research, file, link)
  const inTheCopy = posix.relative(posix.dirname(to), place)
  return link.asWritten === inTheCopy ? link.whole : link.again(`${inTheCopy.replace(NOT_PLAIN_IN_A_LINK, sign => encodeURIComponent(sign).replace('(', '%28').replace(')', '%29'))}${link.fragment}`)
}

function refusal({ mapDir }: Estate, { dirRel }: Research, file: MapFile, { rel, shown, line }: Pick<Link, 'rel' | 'shown' | 'line'>) {
  const ofTheResearch = rel.startsWith(`${dirRel}/`)
  const there = entryAt(posix.isAbsolute(rel) ? rel : join(mapDir, rel))
  if (there?.isFile() && ofTheResearch && rel.endsWith('.md')) return new PluginError(`${NOTHING}: ${rel} cannot be read`)
  const why = !there ? 'which is not there' : ofTheResearch ? 'which is no Markdown file, so the copy would not hold it' : 'which is outside the research'
  return new PluginError(`${NOTHING}: ${file.rel}:${line} links ${shown}, ${why}`)
}

function entryAt(path: string) {
  try {
    return statSync(path, { throwIfNoEntry: false })
  } catch {
    return undefined
  }
}

function refuseLinks(estate: Estate, research: Research, { file, to, lines }: Page, copied: Set<string>) {
  for (const { text, line } of prose(lines)) {
    for (const link of parseLinks(text)) {
      if (link.style === 'path' && copied.has(posix.normalize(posix.join(posix.dirname(to), link.target)))) continue
      throw refusal(estate, research, file, { rel: relOf(file.rel, link), shown: link.target, line })
    }
  }
}

function withoutItem(text: string) {
  return text.replace(THE_HEAD, head => head.replace(A_LINE_OF_THE_HEAD, line => (line.indexOf(':') > 0 && line.slice(0, line.indexOf(':')).trim() === 'item' ? '' : line)))
}

function asText(file: MapFile, to: string, text: string): Copy {
  return { to, rel: file.rel, from: file.path, text, bytes: Buffer.byteLength(text) }
}

function refuseOneNameTwice(copies: Copy[]) {
  const whateverTheCase = (name: string) => name.normalize('NFC').toLowerCase()
  const files = new Map<string, Copy>()
  const folders = new Map<string, Copy>()
  for (const copy of copies) {
    const name = whateverTheCase(copy.to)
    const first = files.get(name)
    if (first && first.to === copy.to) throw new PluginError(`${NOTHING}: ${first.rel} and ${copy.rel} would both be written as ${copy.to}`)
    if (first) throw new PluginError(`${NOTHING}: ${first.rel} and ${copy.rel} would be written as ${first.to} and ${copy.to}, which are one name on a disk that does not tell the cases of letters apart`)
    files.set(name, copy)
    for (let folder = posix.dirname(name); folder !== '.'; folder = posix.dirname(folder)) if (!folders.has(folder)) folders.set(folder, copy)
  }
  for (const [name, copy] of files) {
    const inside = folders.get(name)
    if (inside) throw new PluginError(`${NOTHING}: ${copy.rel} would be written as ${copy.to}, and ${inside.rel} into a folder of that name`)
  }
}

function restsOnlyOn(fact: Fact, left: Set<string>) {
  const lines = fact.nested.filter(({ text }) => RESTS_ON.test(text))
  const files = linksIn(fact.rel, lines.map(({ text }) => text))
  const stays = lines.some(({ text }) => A_FULL_ADDRESS.test(text) || citedIn(text, 0).some(cited => cited.first !== null) || A_FACT_NAMED.test(text.replace(A_LINK, '').replace(/`[^`]*`/g, '')))
  return files.length > 0 && files.every(link => left.has(link.rel)) && !stays
}

function write({ folder, written }: Asked, copies: Copy[]) {
  const wasThereAndEmpty = lstatSync(folder, { throwIfNoEntry: false }) !== undefined
  const made: string[] = []
  try {
    for (const { to, from, text } of copies) {
      const path = join(folder, ...to.split('/'))
      const firstFolderMade = mkdirSync(dirname(path), { recursive: true })
      if (firstFolderMade !== undefined) made.push(firstFolderMade)
      if (text === null) copyFileSync(from, path, constants.COPYFILE_EXCL)
      else writeFileSync(path, text, { flag: 'wx' })
    }
  } catch (error) {
    const ofThisRun = wasThereAndEmpty ? readdirSync(folder).map(name => join(folder, name)) : made.slice(0, 1)
    for (const path of ofThisRun) rmSync(path, { recursive: true, force: true })
    throw new PluginError(`${written} could not be written (${codeOf(error)}), and nothing of the copy is left there`)
  }
}
