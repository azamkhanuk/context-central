import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { PluginError, UsageError } from '../errors.mts'
import { requireEstate } from '../estate.mts'
import { decisionTemplate, nodeTemplate } from '../templates.mts'
import { localDate } from '../text.mts'
import type { Io } from '../cli.mts'
import type { Estate } from '../estate.mts'

interface Flags {
  values: { new?: string; title?: string }
  positionals: string[]
}

export const summary = 'Log a line: note <text>. Start a node: note --new <kind>/<name> [--title <title>]'

const NODE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const NUMBERED = /^(\d+)-(.+)\.md$/
const FIRST_FLAG = /^--(new|title)(=.*)?$/s

export function run(args: string[], io: Io) {
  const { values, positionals }: Flags = FIRST_FLAG.test(args[0] ?? '') ? flags(args) : { values: {}, positionals: args.slice(args[0] === '--' ? 1 : 0) }
  const estate = requireEstate(io)
  if (values.new === undefined) return log(estate, oneLine(positionals), io)
  if (positionals.length > 0) throw new UsageError('give either text to log or --new <kind>/<name>, not both')
  return create(estate, values.new, values.title, io)
}

function flags(args: string[]) {
  return parseArgs({ args, allowPositionals: true, options: { new: { type: 'string' }, title: { type: 'string' } } })
}

function oneLine(words: string[]) {
  return words.join(' ').replace(/\s+/g, ' ').trim().replace(/^- /, '')
}

function log(estate: Estate, text: string, io: Io) {
  if (!text) throw new UsageError('expected the text to log, or --new <kind>/<name>')
  const { month, day } = localDate(io.env)
  const rel = `log/${month}.md`
  const path = join(estate.mapDir, rel)
  const before = existsSync(path) ? readFileSync(path, 'utf8') : ''
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, underDay(before.trim() ? before : `# ${month}\n`, day, `- ${text}`))
  io.out(rel)
}

function underDay(text: string, day: string, entry: string) {
  const lines = text.trimEnd().split('\n')
  const heading = lines.findIndex(line => line.trimEnd() === `## ${day}`)
  if (heading === -1) return `${lines.join('\n')}\n\n## ${day}\n\n${entry}\n`
  const following = lines.findIndex((line, index) => index > heading && line.startsWith('## '))
  let end = following === -1 ? lines.length : following
  while (lines[end - 1].trim() === '') end -= 1
  const gap = end === heading + 1 ? [''] : []
  lines.splice(end, 0, ...gap, entry)
  return `${lines.join('\n')}\n`
}

function create(estate: Estate, target: string, title: string | undefined, io: Io) {
  const kinds = estate.config.nodeDirs.filter(dir => dir !== estate.config.workDir && dir !== 'log')
  const [kind, named = '', ...rest] = target.split('/')
  const name = named.replace(/\.md$/, '')
  if (!kinds.includes(kind) || !name || rest.length > 0 || !NODE_NAME.test(name)) {
    throw new UsageError(`expected --new <kind>/<name>, where the kind is one of: ${kinds.join(', ')}`)
  }
  const { rel, text } = kind === 'decisions' ? decision(estate, name, title || name) : node(kind, name, title || name)
  const path = join(estate.mapDir, rel)
  if (existsSync(path)) throw new PluginError(`${rel} already exists`)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text, { flag: 'wx' })
  io.out(rel)
}

function node(kind: string, name: string, title: string) {
  return { rel: `${kind}/${name}.md`, text: nodeTemplate(kind, title) }
}

function decision(estate: Estate, slug: string, title: string) {
  if (/^\d{4}-/.test(slug)) throw new UsageError('name the decision without a number; it is given the next one')
  const recorded = decisions(estate)
  const same = recorded.find(entry => entry.slug === slug)
  if (same) throw new PluginError(`decisions/${same.file} already exists`)
  const number = String(Math.max(0, ...recorded.map(entry => entry.number)) + 1).padStart(4, '0')
  return { rel: `decisions/${number}-${slug}.md`, text: decisionTemplate(number, title) }
}

function decisions(estate: Estate) {
  const dir = join(estate.mapDir, 'decisions')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .map(file => ({ file, match: NUMBERED.exec(file) }))
    .filter(entry => entry.match)
    .map(({ file, match }) => ({ file, number: Number(match![1]), slug: match![2] }))
}
