import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { PluginError, UsageError } from '../errors.mjs'
import { formatBytes, plural } from '../text.mjs'

export const summary = 'Part of a file: slice <file> --toc | --heading <text> | --lines <a>-<b> | --grep <regex>'

const MODES = ['toc', 'heading', 'lines', 'grep']
const HEADING = /^(#{1,6})\s+(.+?)\s*$/
const FENCE = /^\s*(`{3,}|~{3,})(.*)$/

export function run(args, io) {
  const { values, positionals } = flags(args)
  const [file] = positionals
  const chosen = MODES.filter(mode => values[mode] !== undefined)
  if (positionals.length !== 1 || chosen.length !== 1) {
    throw new UsageError('expected <file> and exactly one of --toc, --heading <text>, --lines <a>-<b>, --grep <regex>')
  }
  const maxBytes = wholeNumber(values['max-bytes'], '--max-bytes', 1)
  const lines = readLines(resolve(io.cwd, file), file)
  const { what, shown } = SLICERS[chosen[0]](lines, values, file)
  const { text, cut } = limit(shown, maxBytes)
  const header = `${file}: ${what} (${formatBytes(Buffer.byteLength(text))} of ${formatBytes(sizeOf(lines))})`
  const notice = cut ? `[cut at ${maxBytes} bytes; narrow the slice]\n` : ''
  io.out(`${header}\n${text}${notice}`.slice(0, -1))
}

function flags(args) {
  return parseArgs({
    args,
    allowPositionals: true,
    options: {
      toc: { type: 'boolean' },
      heading: { type: 'string' },
      lines: { type: 'string' },
      grep: { type: 'string' },
      context: { type: 'string', default: '2' },
      'max-bytes': { type: 'string', default: '20000' },
    },
  })
}

const SLICERS = {
  toc(lines) {
    const found = headings(lines)
    return {
      what: plural(found.length, 'heading'),
      shown: found.map(heading => `${heading.line} ${heading.hashes} ${heading.text} (${formatBytes(sizeOf(section(lines, found, heading)))})`),
    }
  },
  heading(lines, { heading: wanted }, file) {
    const found = headings(lines)
    const match = found.find(heading => `${heading.hashes} ${heading.text}`.toLowerCase().includes(wanted.trim().toLowerCase()))
    if (!match) throw new PluginError(`no heading in ${file} contains "${wanted}"`)
    const shown = section(lines, found, match)
    return { what: `${match.hashes} ${match.text}, lines ${match.line}-${match.line + shown.length - 1}`, shown }
  },
  lines(lines, { lines: range }, file) {
    const match = /^(\d+)-(\d+)$/.exec(range)
    const [first, last] = match ? [Number(match[1]), Number(match[2])] : []
    if (!match || first < 1 || last < first) throw new UsageError('--lines takes a range such as 10-40')
    if (first > lines.length) throw new PluginError(`${file} has ${plural(lines.length, 'line')}`)
    const end = Math.min(last, lines.length)
    return { what: `lines ${first}-${end}`, shown: lines.slice(first - 1, end) }
  },
  grep(lines, { grep: source, context }, file) {
    const pattern = regex(source)
    const around = wholeNumber(context, '--context', 0)
    const hits = lines.flatMap((line, index) => (pattern.test(line) ? [index] : []))
    if (hits.length === 0) throw new PluginError(`no line in ${file} matches /${source}/`)
    const shown = groups(hits, around, lines.length).flatMap(([from, to], index) => [
      ...(index > 0 ? ['--'] : []),
      ...lines.slice(from, to + 1).map((line, offset) => `${from + offset + 1}: ${line}`),
    ])
    return { what: `${plural(hits.length, 'match', 'matches')} for /${source}/`, shown }
  },
}

function readLines(path, file) {
  if (!statSync(path, { throwIfNoEntry: false })?.isFile()) throw new PluginError(`${file}: no such file`)
  const lines = readFileSync(path, 'utf8').split('\n')
  if (lines.at(-1) === '') lines.pop()
  return lines
}

function headings(lines) {
  const found = []
  const body = afterFrontmatter(lines)
  let fence = ''
  lines.forEach((line, index) => {
    if (index < body) return
    const [, mark = '', rest = ''] = FENCE.exec(line) ?? []
    if (fence) {
      if (mark.startsWith(fence) && !rest.trim()) fence = ''
      return
    }
    fence = mark
    const match = !fence && HEADING.exec(line)
    if (match) found.push({ line: index + 1, level: match[1].length, hashes: match[1], text: match[2] })
  })
  return found
}

function afterFrontmatter(lines) {
  if (lines[0]?.trimEnd() !== '---') return 0
  return lines.findIndex((line, index) => index > 0 && line.trimEnd() === '---') + 1
}

function section(lines, found, heading) {
  const next = found.find(other => other.line > heading.line && other.level <= heading.level)
  return lines.slice(heading.line - 1, next ? next.line - 1 : lines.length)
}

function groups(hits, around, total) {
  const merged = []
  for (const hit of hits) {
    const from = Math.max(0, hit - around)
    const to = Math.min(total - 1, hit + around)
    const last = merged.at(-1)
    if (last && from <= last[1] + 1) last[1] = to
    else merged.push([from, to])
  }
  return merged
}

function limit(shown, maxBytes) {
  const whole = Buffer.from(shown.map(line => `${line}\n`).join(''))
  if (whole.length <= maxBytes) return { text: whole.toString(), cut: false }
  const room = whole.subarray(0, maxBytes).toString().replace(/\uFFFD+$/, '')
  const lastBreak = room.lastIndexOf('\n')
  return { text: lastBreak === -1 ? `${room}\n` : room.slice(0, lastBreak + 1), cut: true }
}

function sizeOf(lines) {
  return lines.reduce((sum, line) => sum + Buffer.byteLength(line) + 1, 0)
}

function regex(source) {
  try {
    return new RegExp(source)
  } catch {
    throw new UsageError(`--grep: "${source}" is not a valid regular expression`)
  }
}

function wholeNumber(value, flag, least) {
  if (!/^\d+$/.test(value) || Number(value) < least) throw new UsageError(`${flag} takes a whole number, ${least} or more`)
  return Number(value)
}
