import type { Env } from './cli.mts'

export type Frontmatter = Record<string, string | undefined>

export interface Parsed {
  data: Frontmatter
  body: string
}

type Fence = { run: string, depth: number }

const BOM = '\uFEFF'
const FENCE = /^[ \t]*(`{3,}|~{3,})(.*)$/
const INDENT_AND_QUOTE_MARKS = /^[ \t>]*/
const QUOTE_MARK = /> ?/g
const FRONTMATTER = /^(\uFEFF?---\r?\n)([\s\S]*?)(\r?\n)---(?:\r?\n)?/

export function withoutBom(text: string) {
  return text.startsWith(BOM) ? text.slice(1) : text
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

export function plural(count: number, noun: string, many = `${noun}s`) {
  return `${count} ${count === 1 ? noun : many}`
}

export function parseFrontmatter(text: string): Parsed {
  const match = FRONTMATTER.exec(text)
  if (!match) return { data: {}, body: withoutBom(text) }
  const data: Frontmatter = {}
  for (const line of match[2].split(/\r?\n/)) {
    const colon = line.indexOf(':')
    if (colon < 1) continue
    data[line.slice(0, colon).trim()] = unquote(line.slice(colon + 1).trim())
  }
  return { data, body: text.slice(match[0].length) }
}

export function setFrontmatter(text: string, key: string, value: string) {
  const line = `${key}: ${value}`
  const match = FRONTMATTER.exec(text)
  if (!match) return newBlock(text, line)
  const [, opening, block, closingEol] = match
  const lines = block.split('\n')
  const at = lines.findIndex(held => held.includes(':') && held.slice(0, held.indexOf(':')).trimEnd() === key)
  if (at !== -1) lines[at] = lines[at].endsWith('\r') ? `${line}\r` : line
  const changed = at === -1 ? `${block}${closingEol}${line}` : lines.join('\n')
  return `${opening}${changed}${text.slice(opening.length + block.length)}`
}

function newBlock(text: string, line: string) {
  const eol = endingOf(text)
  const mark = text.startsWith(BOM) ? BOM : ''
  return `${mark}---${eol}${line}${eol}---${eol}${text.slice(mark.length)}`
}

function endingOf(text: string) {
  return text.includes('\r\n') ? '\r\n' : '\n'
}

export function firstHeading(body: string) {
  return /^#\s+(.+?)\s*$/m.exec(body)?.[1] ?? null
}

export function headings(body: string) {
  return [...body.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)].map(match => match[1])
}

export function withoutCode(text: string) {
  return text.replace(/^ *(```|~~~)[\s\S]*?^ *\1[^\n]*$/gm, '').replace(/`[^`\n]*`/g, '')
}

export function fenced(lines: string[]): boolean[] {
  let fence: Fence | null = null
  return lines.map(line => {
    const depth = (INDENT_AND_QUOTE_MARKS.exec(line)?.[0].match(QUOTE_MARK) ?? []).length
    const open = fence !== null && depth < fence.depth ? null : fence
    fence = fenceAfter(unquoted(line), depth, open)
    return open !== null || fence !== null
  })
}

export function unquoted(line: string) {
  return line.replace(INDENT_AND_QUOTE_MARKS, lead => lead.replace(QUOTE_MARK, ''))
}

function fenceAfter(line: string, depth: number, open: Fence | null): Fence | null {
  const [, run, rest] = FENCE.exec(line) ?? []
  if (!run) return open
  if (open === null) return run.startsWith('`') && rest.includes('`') ? null : { run, depth }
  return depth === open.depth && run[0] === open.run[0] && run.length >= open.run.length && rest.trim() === '' ? null : open
}

export function truncate(text: string, max: number, suffix = '') {
  if (text.length <= max) return text
  const room = text.slice(0, max - suffix.length)
  const lastBreak = room.lastIndexOf('\n')
  return (lastBreak > 0 ? room.slice(0, lastBreak) : room) + suffix
}

export function clock(env: Env) {
  return env.CONTEXT_CENTRAL_NOW ? new Date(env.CONTEXT_CENTRAL_NOW) : new Date()
}

export function localDate(env: Env) {
  const now = clock(env)
  const pad = (number: number) => String(number).padStart(2, '0')
  const month = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
  return { month, day: `${month}-${pad(now.getDate())}` }
}

function unquote(value: string) {
  const quoted = /^(["'])(.*)\1$/.exec(value)
  return quoted ? quoted[2] : value
}
