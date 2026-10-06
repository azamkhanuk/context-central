import { isObject, patterns, strings } from './checks.mts'
import { onPath } from './machine.mts'
import { PRESETS, presetNamed } from './presets.mts'
import type { Fail } from './checks.mts'
import type { Env } from './cli.mts'
import type { Kind, Preset } from './presets.mts'

export interface ConnectionEntry {
  holds: string
  references?: string[]
  preset?: string
  server?: string
  commands?: Record<string, string[]>
  how?: string
  account?: string
  repos?: string[]
  [other: string]: unknown
}

export type Connections = Record<string, ConnectionEntry>

export interface Connection {
  name: string
  entry: ConnectionEntry
}

export type Way = 'fetch' | 'server' | 'command' | 'route' | 'hand'

export interface Reach {
  by: Way
  fetch: string | null
  missing: string | null
}

interface OldSettings {
  connections?: unknown
  tracker?: unknown
  codeHost?: unknown
  sources?: unknown
}

export const TICKETS = 'tickets'
export const PULL_REQUESTS = 'pull-requests'
export const FETCH_WORDS: Record<string, string> = { ticket: TICKETS, issue: TICKETS, pr: PULL_REQUESTS }

const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const TEXT_KEYS = ['preset', 'server', 'how', 'account']
const NO_TRACKER = 'none'
const WORD_TO_FETCH: Record<string, string> = { [TICKETS]: 'ticket', [PULL_REQUESTS]: 'pr' }

export function readConnections(value: unknown, repos: string[], fail: Fail): Connections {
  if (!isObject(value)) fail('"connections" must be a map from a name to an entry')
  return Object.fromEntries(Object.entries(value).map(([name, entry]) => [name, readEntry(name, entry, repos, fail)]))
}

export function connectionsOfOldMap({ tracker, codeHost, sources }: OldSettings, keyPatterns: string[]): Connections {
  const found: [string, ConnectionEntry][] = []
  const add = (name: string, entry: ConnectionEntry) => found.push([found.some(([taken]) => taken === name) ? `${name}-${entry.holds}` : name, entry])
  const written = isObject(tracker) ? tracker : {}
  const trackerType = typeof written.type === 'string' && written.type !== NO_TRACKER ? written.type : null
  if (trackerType || keyPatterns.length > 0) add(trackerType ?? 'tracker', { holds: TICKETS, references: keyPatterns, ...presetKey(presetNamed(trackerType)), ...without(written, ['type', 'keyPatterns']) })
  if (isObject(codeHost)) add(...codeHostConnection(codeHost))
  for (const [kind, way] of isObject(sources) ? Object.entries(sources) : []) {
    if (typeof way === 'string' ? way : way !== null && way !== undefined) add(kind, typeof way === 'string' ? { holds: kind, how: way } : { holds: kind, route: way })
  }
  return Object.fromEntries(found)
}

export function unaskedOn(written: OldSettings, recorded: Connections): Connection[] {
  if (written.connections !== undefined) return []
  const isRecorded = (preset: Preset, kind: string) => Object.values(recorded).some(entry => entry.preset === preset.name && entry.holds === kind)
  return PRESETS.filter(preset => preset.onOldMaps?.unasked).flatMap(preset =>
    Object.keys(preset.kinds)
      .filter(kind => !isRecorded(preset, kind))
      .map(kind => ({ name: preset.name, entry: { holds: kind, preset: preset.name } })),
  )
}

export function listed(connections: Connections): Connection[] {
  return Object.entries(connections).map(([name, entry]) => ({ name, entry }))
}

export function kindOf({ entry }: Connection): Kind | null {
  const preset = presetNamed(entry.preset)
  return preset && Object.hasOwn(preset.kinds, entry.holds) ? preset.kinds[entry.holds] : null
}

export function reachOf(connection: Connection, env: Env): Reach {
  const { entry } = connection
  const preset = presetNamed(entry.preset)
  const word = Object.hasOwn(WORD_TO_FETCH, entry.holds) ? WORD_TO_FETCH[entry.holds] : null
  const reads = preset !== null && word !== null && Boolean(kindOf(connection)?.read)
  const here = reads && onPath(preset.program, env) !== null
  return {
    by: here ? 'fetch' : entry.server ? 'server' : entry.commands ? 'command' : entry.route !== undefined ? 'route' : 'hand',
    fetch: here ? `context-central fetch ${word} <reference> --item <item>` : null,
    missing: reads && !here ? preset.program : null,
  }
}

function readEntry(name: string, entry: unknown, repos: string[], fail: Fail): ConnectionEntry {
  if (!NAME.test(name)) fail(`"connections": "${name}" is not a name; use letters, digits, dots, dashes and underscores`)
  const at = `connections.${name}`
  if (!isObject(entry)) fail(`"${at}" must be an object`)
  if (typeof entry.holds !== 'string' || !entry.holds) fail(`"${at}.holds" must be text`)
  for (const key of TEXT_KEYS) {
    if (entry[key] !== undefined && (typeof entry[key] !== 'string' || !entry[key])) fail(`"${at}.${key}" must be text`)
  }
  if (entry.references !== undefined) patterns(entry.references, `${at}.references`, fail)
  if (entry.commands !== undefined) checkCommands(entry.commands, `${at}.commands`, fail)
  if (entry.repos !== undefined) {
    const unknown = strings(entry.repos, `${at}.repos`, fail).find(repo => !repos.includes(repo))
    if (unknown) fail(`"${at}.repos" names "${unknown}", which is not a registered repo`)
  }
  return entry as ConnectionEntry
}

function checkCommands(commands: unknown, at: string, fail: Fail) {
  if (!isObject(commands)) fail(`"${at}" must be a map from an action to a command`)
  for (const [action, words] of Object.entries(commands)) strings(words, `${at}.${action}`, fail)
}

function codeHostConnection(codeHost: Record<string, unknown>): [string, ConnectionEntry] {
  const type = typeof codeHost.type === 'string' && codeHost.type ? codeHost.type : null
  const preset = presetNamed(type) ?? PRESETS.find(candidate => accountOn(codeHost, candidate) !== null) ?? null
  const account = preset ? accountOn(codeHost, preset) : null
  const entry = { holds: PULL_REQUESTS, ...presetKey(preset), ...(account ? { account } : {}), ...without(codeHost, ['type', preset?.onOldMaps?.accountKey]) }
  return [type ?? preset?.name ?? 'code-host', entry]
}

function accountOn(codeHost: Record<string, unknown>, preset: Preset) {
  const key = preset.onOldMaps?.accountKey
  const account = key ? codeHost[key] : undefined
  return typeof account === 'string' && account ? account : null
}

function presetKey(preset: Preset | null) {
  return preset ? { preset: preset.name } : {}
}

function without(written: Record<string, unknown>, keys: (string | undefined)[]) {
  return Object.fromEntries(Object.entries(written).filter(([key]) => !keys.includes(key)))
}
