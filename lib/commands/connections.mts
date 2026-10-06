import { parseArgs } from 'node:util'
import { REFERENCE, chosenAmong, listed, reachOf, ticketOf, whyNotStarted } from '../connections.mts'
import { PluginError, UsageError } from '../errors.mts'
import { requireEstate } from '../estate.mts'
import { findWorkItem } from '../nodes.mts'
import { PRESETS, presetNamed } from '../presets.mts'
import type { Env, Io } from '../cli.mts'
import type { Connection, Reach, Way } from '../connections.mts'
import type { Estate } from '../estate.mts'
import type { Preset } from '../presets.mts'

interface Found {
  connection: Connection
  reach: Reach
  unasked: boolean
}

interface Named {
  word: string
  reference: string
}

export const summary = 'List the connections and how this machine reaches each; --ticket or --pr <reference>, or --item <item>, lists only the one it belongs to; --presets lists the vendors the plugin knows'

const USAGE = 'expected: connections [--ticket <reference> | --pr <reference> | --item <item>] [--json], or connections --presets [--json]'
const WORDS = ['ticket', 'pr'] as const
const OWN_TICKET = 'ticket'
const NONE = 'No connection is recorded. The plugin works without one. One is recommended, so that a session can read the ticket or the pull request behind the work.'
const NO_PRESETS = 'No preset is carried.'
const UNASKED = 'not recorded in this map: its preset applies unasked'
const WAYS: Record<Way, (found: Found) => string> = {
  fetch: ({ reach }) => `by fetch: ${reach.fetch}`,
  server: ({ connection }) => `by a session, through the server ${connection.entry.server}`,
  command: () => "by a session, with the estate's own command",
  route: () => 'by a session, by the route written down',
  hand: ({ connection }) => (connection.entry.how ? `by hand: ${connection.entry.how}` : 'by hand'),
}

export function run(args: string[], io: Io) {
  const { values } = parseArgs({ args, options: { json: { type: 'boolean' }, presets: { type: 'boolean' }, ticket: { type: 'string' }, pr: { type: 'string' }, item: { type: 'string' } } })
  const named = WORDS.flatMap(word => (values[word] === undefined ? [] : [{ word, reference: values[word] }]))
  const asksForOne = named.length + (values.item === undefined ? 0 : 1)
  if (asksForOne > 1 || (values.presets && asksForOne > 0)) throw new UsageError(USAGE)
  if (named.some(({ reference }) => !REFERENCE.test(reference))) throw new UsageError('a reference is one word that does not start with a dash')
  if (values.presets) return io.out(values.json ? JSON.stringify(PRESETS.map(presetAsJson), null, 2) : PRESETS.length > 0 ? PRESETS.map(describePreset).join('\n') : NO_PRESETS)
  const estate = requireEstate(io)
  const asked = values.item !== undefined ? [theOneOf(estate, ownTicket(estate, values.item))] : named.length > 0 ? [theOneOf(estate, named[0])] : listed(estate.config.connections)
  const found = asked.map(connection => ({ connection, reach: reachOf(connection, io.env), unasked: estate.unasked.includes(connection) }))
  if (values.json) return io.out(JSON.stringify(found.map(asJson), null, 2))
  io.out(found.length > 0 ? found.map(one => describe(one, io.env)).join('\n') : NONE)
}

function ownTicket(estate: Estate, name: string): Named {
  const item = findWorkItem(estate, name)
  if (!item) throw new PluginError(`no work item "${name}"`)
  const reference = ticketOf(listed(estate.config.connections), item)
  if (!reference) throw new PluginError(`${item.id} has no ticket`)
  return { word: OWN_TICKET, reference }
}

function theOneOf(estate: Estate, { word, reference }: Named) {
  const { one, kind, candidates } = chosenAmong({ recorded: listed(estate.config.connections), unasked: estate.unasked, oldMap: estate.oldMap }, word, reference)
  if (one) return one
  if (candidates.length === 0) throw new PluginError(`no connection holds ${kind}`)
  throw new PluginError(`more than one connection holds ${kind} and none claims "${reference}": ${candidates.map(candidate => candidate.name).join(', ')}`)
}

function asJson({ connection: { name, entry }, reach, unasked }: Found) {
  return { name, holds: entry.holds, ...reach, entry, ...(unasked ? { unasked } : {}) }
}

function describe(found: Found, env: Env) {
  const { connection, reach, unasked } = found
  const preset = presetNamed(connection.entry.preset)
  const missing = reach.missing && preset ? ` (not by fetch here: ${whyNotStarted(preset, env, { hint: false })})` : ''
  const account = connection.entry.account ? [`as ${connection.entry.account}`] : []
  return [connection.name, connection.entry.holds, `${WAYS[reach.by](found)}${missing}`, ...account, ...(unasked ? [UNASKED] : [])].join(' | ')
}

function describePreset({ name, program, kinds, takes = {} }: Preset) {
  const reads = readBy(kinds)
  const taken = Object.entries(takes).map(([parameter, what]) => `${parameter}: ${what}`)
  return [name, `holds ${Object.keys(kinds).join(', ')}`, `starts ${program}`, ...(reads.length > 0 ? [`reads ${reads.join(', ')}`] : []), ...(taken.length > 0 ? [`takes ${taken.join('; ')}`] : [])].join(' | ')
}

function presetAsJson({ name, program, kinds, takes = {} }: Preset) {
  return { name, holds: Object.keys(kinds), program, reads: readBy(kinds), takes }
}

function readBy(kinds: Preset['kinds']) {
  return Object.keys(kinds).filter(kind => kinds[kind].read)
}
