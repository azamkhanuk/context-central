import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { parseArgs } from 'node:util'
import { PluginError, UsageError } from '../errors.mts'
import { NODE_NAME, requireEstate } from '../estate.mts'
import { makeFolder, underNotNodes } from '../nodes.mts'
import { decisionTemplate, nodeTemplate } from '../templates.mts'
import { localDate } from '../text.mts'
import type { Io } from '../cli.mts'
import type { Estate } from '../estate.mts'

interface Flags {
  values: { new?: string; title?: string }
  positionals: string[]
}

export const summary = 'Log a line: note <text>. Start a node: note --new <kind>/<name> [--title <title>]'

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
  makeFolder(estate.mapDir, 'log')
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
  const expected = `expected --new <kind>/<name>, where the kind is one of: ${kinds.join(', ')}`
  const [kind, ...parts] = target.replace(/\.md$/, '').split('/')
  const name = parts.at(-1)
  if (!kinds.includes(kind) || name === undefined) throw new UsageError(expected)
  const broken = brokenRule(estate, kind, parts)
  if (broken) throw new UsageError(`${broken}: ${expected}`)
  const { rel, text } = kind === 'decisions' ? decision(estate, name, title || name) : node(kind, parts.join('/'), title || name)
  if (underNotNodes(estate.config, rel)) throw new UsageError(`${rel} is under a notNodes entry: ${expected}`)
  const path = join(estate.mapDir, rel)
  if (existsSync(path)) throw new PluginError(`${rel} already exists`)
  makeFolder(estate.mapDir, posix.dirname(rel))
  writeFileSync(path, text, { flag: 'wx' })
  io.out(rel)
}

function brokenRule(estate: Estate, kind: string, parts: string[]) {
  const odd = parts.find(part => !NODE_NAME.test(part))
  if (odd !== undefined) return `"${odd}" is not a name`
  if (parts.length > 1 && kind === 'decisions') return 'a decision takes no folder'
  if (parts.length > 1 && kind === 'standards') return 'a standards note takes no folder'
  const deep = parts.slice(0, -1).find(part => estate.config.deepDirs.includes(part))
  return deep === undefined ? null : `"${deep}" is kept for the deep tier`
}

function node(kind: string, name: string, title: string) {
  return { rel: `${kind}/${name}.md`, text: nodeTemplate(kind, title, name) }
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
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return []
  return readdirSync(dir)
    .map(file => ({ file, match: NUMBERED.exec(file) }))
    .filter(entry => entry.match)
    .map(({ file, match }) => ({ file, number: Number(match![1]), slug: match![2] }))
}
