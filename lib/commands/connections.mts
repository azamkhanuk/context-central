import { parseArgs } from 'node:util'
import { listed, reachOf } from '../connections.mts'
import { requireEstate } from '../estate.mts'
import { PRESETS } from '../presets.mts'
import type { Io } from '../cli.mts'
import type { Connection, Reach, Way } from '../connections.mts'
import type { Preset } from '../presets.mts'

interface Found {
  connection: Connection
  reach: Reach
}

export const summary = 'List the connections and how this machine reaches each; --presets lists the vendors the plugin knows'

const NONE = 'No connection is recorded. The plugin works without one. One is recommended, so that a session can read the ticket or the pull request behind the work.'
const NO_PRESETS = 'No preset is carried.'
const WAYS: Record<Way, (found: Found) => string> = {
  fetch: ({ reach }) => `by fetch: ${reach.fetch}`,
  server: ({ connection }) => `by a session, through the server ${connection.entry.server}`,
  command: () => "by a session, with the estate's own command",
  route: () => 'by a session, by the route written down',
  hand: ({ connection }) => (connection.entry.how ? `by hand: ${connection.entry.how}` : 'by hand'),
}

export function run(args: string[], io: Io) {
  const { values } = parseArgs({ args, options: { json: { type: 'boolean' }, presets: { type: 'boolean' } } })
  if (values.presets) return io.out(PRESETS.length > 0 ? PRESETS.map(describePreset).join('\n') : NO_PRESETS)
  const found = listed(requireEstate(io).config.connections).map(connection => ({ connection, reach: reachOf(connection, io.env) }))
  if (values.json) return io.out(JSON.stringify(found.map(asJson), null, 2))
  io.out(found.length > 0 ? found.map(describe).join('\n') : NONE)
}

function asJson({ connection: { name, entry }, reach }: Found) {
  return { name, holds: entry.holds, ...reach, entry }
}

function describe(found: Found) {
  const { connection, reach } = found
  const missing = reach.missing ? ` (not by fetch here: ${reach.missing} is not on PATH)` : ''
  const account = connection.entry.account ? [`as ${connection.entry.account}`] : []
  return [connection.name, connection.entry.holds, `${WAYS[reach.by](found)}${missing}`, ...account].join(' | ')
}

function describePreset({ name, program, kinds }: Preset) {
  const reads = Object.keys(kinds).filter(kind => kinds[kind].read)
  return [name, `holds ${Object.keys(kinds).join(', ')}`, `starts ${program}`, ...(reads.length > 0 ? [`reads ${reads.join(', ')}`] : [])].join(' | ')
}
