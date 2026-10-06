import { isObject, patterns, strings } from './checks.mts'
import { accountsOf, isOnlyAScript, onPath } from './machine.mts'
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

export interface Reference {
  text: string
  at: number
  connection: Connection
  id: string
  repo: string | null
}

interface Candidate {
  reference: Reference
  rank: number[]
}

const compiled = new WeakMap<ConnectionEntry, RegExp[]>()

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
const LINK = /^[a-z][a-z0-9+.-]*:\/\//i
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
    if (typeof way === 'string' && way) add(kind, { holds: kind, how: way })
    else if (typeof way === 'object' && way !== null) add(kind, { holds: kind, route: way })
  }
  return Object.fromEntries(found)
}

export function unaskedOn(written: OldSettings): Connection[] {
  if (written.connections !== undefined) return []
  return PRESETS.filter(preset => preset.onOldMaps?.unasked).flatMap(preset => Object.keys(preset.kinds).map(kind => ({ name: preset.name, entry: { holds: kind, preset: preset.name } })))
}

export function listed(connections: Connections): Connection[] {
  return Object.entries(connections).map(([name, entry]) => ({ name, entry }))
}

export function holding(connections: Connection[], kind: string) {
  return connections.filter(connection => connection.entry.holds === kind)
}

export function referencesIn(connections: Connection[], text: string): Reference[] {
  const found: Candidate[] = connections.flatMap((connection, order) =>
    patternsOf(connection).flatMap(pattern =>
      [...text.matchAll(pattern)]
        .filter(match => match[0] !== '')
        .map(match => ({
          reference: { text: match[0], at: match.index, connection, id: match.groups?.id ?? match[0], repo: match.groups?.repo ?? null },
          rank: [-match[0].length, order, match.groups?.id === undefined ? 1 : 0],
        })),
    ),
  )
  const kept: Reference[] = []
  for (const { reference } of found.map((candidate, index) => ({ ...candidate, rank: [...candidate.rank, index] })).sort((a, b) => (before(a.rank, b.rank) ? -1 : 1))) {
    if (!kept.some(other => overlap(other, reference))) kept.push(reference)
  }
  return kept.sort((a, b) => a.at - b.at)
}

export function referenceOf(connections: Connection[], text: string) {
  const whole = text.trim()
  return referencesIn(connections, whole).find(found => found.at === 0 && found.text.length === whole.length) ?? null
}

export function sameReference(a: Reference, b: Reference) {
  const inOneRepo = a.repo === null || b.repo === null || a.repo.toLowerCase() === b.repo.toLowerCase()
  return a.connection.name === b.connection.name && a.id.toLowerCase() === b.id.toLowerCase() && inOneRepo
}

export function isLink(reference: Reference) {
  return LINK.test(reference.text)
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
    fetch: here ? `context-central fetch ${word} "<reference>" --item <item>` : null,
    missing: reads && !here ? preset.program : null,
  }
}

export function whyNotStarted(preset: Preset, env: Env, { hint = true }: { hint?: boolean } = {}) {
  if (isOnlyAScript(preset.program, env)) return `${preset.program} is a .cmd or .bat file, which the plugin cannot start`
  return `${preset.program} is not on PATH${hint && preset.hint ? `; ${preset.hint}` : ''}`
}

export function accountFault({ entry }: Connection, env: Env) {
  const preset = presetNamed(entry.preset)
  if (!entry.account || !preset?.accounts || !onPath(preset.program, env)) return null
  const active = accountsOf(preset, env)
    .filter(account => account.active)
    .map(account => account.user.toLowerCase())
  return active.includes(entry.account.toLowerCase()) ? null : preset.accounts.fix(entry.account)
}

function patternsOf(connection: Connection) {
  const held = compiled.get(connection.entry)
  if (held) return held
  const patterns = [...(connection.entry.references ?? []), ...(kindOf(connection)?.references(connection.entry) ?? [])].flatMap(source => {
    try {
      return [new RegExp(`(?<!\\w)(?:${source})(?!\\w)`, 'gi')]
    } catch {
      return []
    }
  })
  compiled.set(connection.entry, patterns)
  return patterns
}

function overlap(a: Reference, b: Reference) {
  return a.at < b.at + b.text.length && b.at < a.at + a.text.length
}

function before(a: number[], b: number[]) {
  const at = a.findIndex((value, index) => value !== b[index])
  return at !== -1 && a[at] < b[at]
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
