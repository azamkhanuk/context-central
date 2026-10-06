import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { FETCH_WORDS, PULL_REQUESTS, TICKETS, accountFault, holding, kindOf, listed, referenceOf, whyNotStarted } from '../connections.mts'
import { PluginError, UsageError } from '../errors.mts'
import { requireEstate } from '../estate.mts'
import { findWorkItem } from '../nodes.mts'
import { presetNamed } from '../presets.mts'
import { formatBytes, localDate } from '../text.mts'
import type { Io } from '../cli.mts'
import type { Connection } from '../connections.mts'
import type { Estate } from '../estate.mts'
import type { WorkItem } from '../nodes.mts'
import type { Laid, Preset, Reading } from '../presets.mts'

interface Asked {
  reference: string
  repo: string | undefined
}

export const summary = 'Read a ticket or a pull request through its connection and save it in full: fetch ticket|pr <reference> --item <item>; --check tries a connection and saves nothing'

const USAGE = 'expected: fetch ticket|pr <reference> --item <item> [--connection <name>] [--repo <repo>], or --check in place of --item to try the connection and save nothing'
const REFERENCE = /^[^\s\p{Cc}-][^\s\p{Cc}]*$/u
const ONE_WORD = /^[^\s\p{Cc}]+$/u
const NEW_WORD = 'ticket'
const WORDS: Record<string, { word: string; label: string }> = { [TICKETS]: { word: 'ticket', label: 'Ticket' }, [PULL_REQUESTS]: { word: 'pr', label: 'Pull request' } }

export function run(args: string[], io: Io) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { item: { type: 'string' }, repo: { type: 'string' }, connection: { type: 'string' }, check: { type: 'boolean' } },
  })
  const [typed, given] = positionals
  const kind = Object.hasOwn(FETCH_WORDS, typed ?? '') ? FETCH_WORDS[typed] : null
  const readsItsOwn = kind === TICKETS && values.item !== undefined
  if (!kind || positionals.length > 2 || Boolean(values.check) === (values.item !== undefined) || (!given && !readsItsOwn)) throw new UsageError(USAGE)
  if ([given, values.repo].some(value => value !== undefined && !REFERENCE.test(value))) throw new UsageError('a reference and a repo are each one word that does not start with a dash')
  const estate = requireEstate(io)
  const item = values.item === undefined ? null : findWorkItem(estate, values.item)
  if (values.item !== undefined && !item) throw new PluginError(`no work item "${values.item}"`)
  const asked = { reference: given ?? ownTicket(estate, item), repo: values.repo }
  const connection = chosen(estate, kind, typed, asked.reference, values.connection)
  const { preset, reading } = readingOf(connection, kind, asked)
  const printed = started(preset, reading, connection, io)
  const { day } = localDate(io.env)
  const laid = laidOut(preset, reading, printed, day) ?? asPrinted(connection, kind, asked, printed, day)
  if (!item) return io.out(`ok: connection ${connection.name} read ${WORDS[kind].word} ${laid.id} (${formatBytes(Buffer.byteLength(printed))})`)
  const sourcesAbs = join(estate.mapDir, item.dirRel, 'sources')
  mkdirSync(sourcesAbs, { recursive: true })
  const name = `${nextNumber(sourcesAbs)}-${day}-${typed}-${safe(laid.id)}-full-text.md`
  writeFileSync(join(sourcesAbs, name), laid.text, { flag: 'wx' })
  io.out(laid.digest)
  io.out(`saved: ${item.dirRel}/sources/${name} (${formatBytes(Buffer.byteLength(laid.text))})`)
}

function ownTicket(estate: Estate, item: WorkItem | null) {
  if (!item) throw new UsageError(USAGE)
  const ticket = item.ticket ?? (referenceOf(holding(listed(estate.config.connections), TICKETS), item.id) ? item.id : null)
  if (!ticket) throw new PluginError(`${item.id} has no ticket; name the reference to read`)
  if (!REFERENCE.test(ticket)) throw new PluginError(`"${ticket}" cannot be put into a command: a reference is one word that does not start with a dash`)
  return ticket
}

function chosen(estate: Estate, kind: string, typed: string, reference: string, named: string | undefined) {
  const recorded = holding(listed(estate.config.connections), kind)
  const candidates = [...recorded, ...holding(estate.unasked, kind)]
  if (named !== undefined) return theOneNamed([...listed(estate.config.connections), ...estate.unasked], kind, named)
  const claiming = candidates.find(candidate => referenceOf([candidate], reference))
  const asBefore = candidates.find(candidate => presetNamed(candidate.entry.preset)?.onOldMaps?.unasked)
  const fallback = !estate.oldMap ? only(recorded) : typed === NEW_WORD ? (only(recorded) ?? asBefore) : (asBefore ?? only(candidates))
  const one = claiming ?? fallback
  if (one) return one
  if (candidates.length === 0) throw new PluginError(`no connection holds ${kind}`)
  throw new PluginError(`more than one connection holds ${kind}: ${candidates.map(candidate => candidate.name).join(', ')}; name one with --connection`)
}

function only(connections: Connection[]) {
  return connections.length === 1 ? connections[0] : undefined
}

function theOneNamed(every: Connection[], kind: string, named: string) {
  const same = every.filter(candidate => candidate.name === named)
  const connection = same.find(candidate => candidate.entry.holds === kind) ?? same[0]
  if (!connection) throw new PluginError(`no connection "${named}"`)
  if (connection.entry.holds !== kind) throw new PluginError(`connection ${named} holds ${connection.entry.holds}, not ${kind}`)
  return connection
}

function readingOf(connection: Connection, kind: string, { reference, repo }: Asked) {
  const preset = presetNamed(connection.entry.preset)
  const read = kindOf(connection)?.read
  if (!preset || !read) throw new PluginError(`connection ${connection.name} is not read by fetch: it has no preset that reads ${kind}.${instead(connection)}`)
  const id = referenceOf([connection], reference)?.id ?? reference
  const reading = read({ reference, id, repo, entry: connection.entry })
  const odd = reading.args.find(arg => !ONE_WORD.test(arg))
  if (odd !== undefined) throw new PluginError(`connection ${connection.name} gives the command "${odd}", which is not one word`)
  return { preset, reading }
}

function instead({ entry }: Connection) {
  if (entry.server) return ` A session reads it through the server ${entry.server}.`
  if (entry.commands) return " A session reads it with the estate's own command."
  if (entry.route !== undefined) return ' A session reads it by the route written down.'
  return entry.how ? ` By hand: ${entry.how}` : ''
}

function started(preset: Preset, reading: Reading, connection: Connection, io: Io) {
  const result = spawnSync(preset.program, reading.args, { cwd: io.cwd, env: io.env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if ((result.error as NodeJS.ErrnoException | undefined)?.['code'] === 'ENOENT') {
    throw new PluginError(`connection ${connection.name} is not read by fetch here: ${whyNotStarted(preset, io.env)}.${instead(connection)}`)
  }
  if (result.error) throw new PluginError(`${preset.program} failed: ${result.error.message}`)
  if (result.status !== 0) {
    const fault = accountFault(connection, io.env)
    throw new PluginError(`${preset.program} failed: ${firstLine(result.stderr) || `exit ${result.status}`}${fault ? `; ${fault}` : ''}`)
  }
  return result.stdout
}

function laidOut(preset: Preset, reading: Reading, printed: string, day: string): Laid | null {
  if (!reading.layout) return null
  try {
    return reading.layout(printed, day)
  } catch (error) {
    throw new PluginError(`${preset.program} failed: its answer could not be read (${(error as Error).message})`)
  }
}

function asPrinted(connection: Connection, kind: string, { reference }: Asked, printed: string, day: string): Laid {
  const id = referenceOf([connection], reference)?.id ?? reference
  const head = [`# ${WORDS[kind].label} ${id}`, [`Connection: ${connection.name}`, `Reference: ${reference}`, `Fetched: ${day}`].map(fact => `- ${fact}`).join('\n')]
  return { id, digest: `${WORDS[kind].word} ${id} read through ${connection.name}`, text: [...head, printed.replace(/\r\n/g, '\n').trimEnd()].join('\n\n').concat('\n') }
}

function nextNumber(sourcesAbs: string) {
  const taken = readdirSync(sourcesAbs).map(name => Number(/^(\d{2})-/.exec(name)?.[1] ?? 0))
  return String(Math.max(0, ...taken) + 1).padStart(2, '0')
}

function safe(id: string) {
  return id.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'unnamed'
}

function firstLine(text: string | null) {
  return (text ?? '').trim().split('\n')[0]
}
