import { constants, copyFileSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, posix } from 'node:path'
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
  moved: Set<string>
  gone: Set<string>
}

const READING_FILE = 'reading.md'
const LEFT_OUT = '(left out of this copy)'
const A_CODE_SPAN = /(`[^`\n]*`)/
const A_LINK = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]|\[((?:[^[\]]|\[[^[\]]*\])*)\]\((?!\w+:)[^)\s#]+\.md(#[^)]*)?\)/g
const THE_HEAD = /^﻿?---\r?\n[\s\S]*?\r?\n---/
const AN_ITEM_LINE = /^item:.*\r?\n/m
const A_SOURCE_LINE = /^- Source:/
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
  const pages = research.files.filter(file => reading || file.rel !== readingRel).map(file => ({ file, to: file.rel.slice(dirRel.length + 1), lines: readFileSync(file.path, 'utf8').split('\n') }))
  const linked = new Set(pages.flatMap(({ file, lines }) => prose(lines).flatMap(({ text }) => parseLinks(text).map(link => relOf(file.rel, link)))))
  const sources = [...research.sources.map(source => ({ source, to: source.rel.slice(dirRel.length + 1) })), ...itemSources(estate, research).filter(({ source }) => linked.has(source.rel))]
  const left = leftOut(research, sources.map(({ source }) => source), kinds, without)
  const taken = sources.filter(({ source }) => !left.has(source.rel))
  const places: Places = {
    kept: new Map([...pages.map(({ file, to }) => [file.rel, to] as const), ...taken.map(({ source, to }) => [source.rel, to] as const)]),
    moved: new Set(taken.filter(({ source }) => !source.rel.startsWith(`${dirRel}/`)).map(({ source }) => source.rel)),
    gone: new Set([...left, ...(reading ? [] : [readingRel])]),
  }
  const texts = pages.map(page => ({ ...page, lines: rewritten(page, places) }))
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
      restOnLeftOut: stands.filter(fact => restsOn(fact, left)).map(fact => fact.number),
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

function rewritten({ file, to, lines }: { file: MapFile; to: string; lines: string[] }, { kept, moved, gone }: Places) {
  const inAFence = fenced(lines)
  const relink = (whole: string, wikiTarget: string | undefined, wikiWords: string | undefined, words: string | undefined, fragment = '') => {
    const [link] = parseLinks(whole)
    if (!link) return whole
    const rel = relOf(file.rel, link)
    const said = words ?? wikiWords ?? posix.basename(wikiTarget ?? '').replace(/\.md$/, '')
    if (gone.has(rel)) return `${said} ${LEFT_OUT}`
    const place = kept.get(rel)
    if (place === undefined || (link.style === 'path' && !moved.has(rel))) return whole
    return `[${said}](${posix.relative(posix.dirname(to), place)}${fragment})`
  }
  return lines.map((line, index) =>
    inAFence[index]
      ? line
      : line
          .split(A_CODE_SPAN)
          .map((part, at) => (at % 2 === 1 ? part : part.replace(A_LINK, relink)))
          .join(''),
  )
}

function refuseLinks(estate: Estate, { dirRel }: Research, { file, to, lines }: { file: MapFile; to: string; lines: string[] }, copied: Set<string>) {
  for (const { text, line } of prose(lines)) {
    for (const link of parseLinks(text)) {
      if (link.style === 'path' && copied.has(posix.normalize(posix.join(posix.dirname(to), link.target)))) continue
      const rel = relOf(file.rel, link)
      const there = statSync(join(estate.mapDir, rel), { throwIfNoEntry: false })?.isFile() ?? false
      if (there && rel.startsWith(`${dirRel}/`)) throw new PluginError(`${NOTHING}: ${rel} cannot be read`)
      throw new PluginError(`${NOTHING}: ${file.rel}:${line} links ${link.target}, which is ${there ? 'outside the research' : 'not there'}`)
    }
  }
}

function withoutItem(text: string) {
  return text.replace(THE_HEAD, head => head.replace(AN_ITEM_LINE, ''))
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

function restsOn(fact: Fact, left: Set<string>) {
  const sources = fact.nested.filter(({ text }) => A_SOURCE_LINE.test(text)).map(({ text }) => parseLinks(text).map(link => relOf(fact.rel, link)))
  return sources.length > 0 && sources.every(rels => rels.length > 0 && rels.every(rel => left.has(rel)))
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
