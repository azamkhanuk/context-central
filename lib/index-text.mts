import { existsSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { listed } from './connections.mts'
import { repoAt, standardsFiles } from './estate.mts'
import { hubPath, inFlight, listWorkItems } from './nodes.mts'
import type { Connection } from './connections.mts'
import type { Estate } from './estate.mts'

const LAST_LINE = "A work item's state file records where it stands and what is next. context-central resolve <item> lists the notes behind it. Evidence that is not text sits in the item's evidence/ folder, named in a note."
const HOW_TO_ASK = 'context-central connections says how this machine reaches each.'
const CONNECTIONS_CHARS = 400

export interface IndexRepo {
  name: string
  note: string
  path: string
  standards: string | null
  standardsPath: string | null
}

export function indexData(estate: Estate, startDir?: string) {
  const items = listWorkItems(estate)
    .filter(inFlight)
    .map(item => ({ id: item.id, title: item.title, entry: item.entry?.rel ?? null, path: item.entry?.path ?? null }))
  const connections = listed(estate.config.connections).map(({ name, entry }) => ({ name, holds: entry.holds }))
  return { title: estate.config.title, mapDir: estate.mapDir, hub: hubPath(estate), repo: repoAround(estate, startDir), connections, items }
}

export function buildIndex(estate: Estate, { absolute = false, startDir = undefined }: { absolute?: boolean; startDir?: string } = {}) {
  const { title, mapDir, hub, repo, items } = indexData(estate, startDir)
  const head = [`Context map "${title}": ${mapDir}`, `Hub: ${hub}${existsSync(hub) ? '' : ' (missing)'}`, ...(repo ? [repoLine(repo, absolute)] : []), ...connectionsLine(listed(estate.config.connections))]
  if (items.length === 0) return [...head, 'No work in flight.'].join('\n')
  const rows = items.map(item => `- ${item.id} | ${item.title} | ${(absolute ? item.path : item.entry) ?? 'no entry file'}`)
  const withRows = (shown: number) => [...head, `Work in flight (${rows.length}):`, ...rows.slice(0, shown), ...restRow(rows.length - shown), LAST_LINE].join('\n')
  let shown = rows.length
  while (shown > 0 && withRows(shown).length > estate.config.budgets.indexChars) shown -= 1
  return withRows(shown)
}

function repoAround(estate: Estate, startDir: string | undefined): IndexRepo | null {
  const repo = startDir === undefined ? null : repoAt(estate, startDir)
  if (!repo) return null
  const note = `repos/${repo.name}.md`
  const path = join(estate.mapDir, note)
  if (!statSync(path, { throwIfNoEntry: false })?.isFile()) return null
  const standards = standardsFiles(estate, repo).find(file => file.note) ?? null
  return { name: repo.name, note, path, standards: standards && relative(estate.mapDir, standards.path).split(sep).join('/'), standardsPath: standards?.path ?? null }
}

function repoLine({ name, note, path, standards, standardsPath }: IndexRepo, absolute: boolean) {
  const also = standards ? `; standards: ${absolute ? standardsPath : standards}` : ''
  return `Repo ${name}: ${absolute ? path : note}${also}`
}

function connectionsLine(connections: Connection[]) {
  if (connections.length === 0) return []
  const line = (describe: (connection: Connection) => string) => `Connections: ${connections.map(describe).join('; ')}. ${HOW_TO_ASK}`
  const short = ({ name, entry }: Connection) => `${name} holds ${entry.holds}`
  const fitting = [line(connection => `${short(connection)}${waysRecorded(connection)}`), line(short)].find(text => text.length <= CONNECTIONS_CHARS)
  return [fitting ?? `Connections: ${connections.length} are recorded. context-central connections lists them and says how this machine reaches each.`]
}

function waysRecorded({ entry }: Connection) {
  const ways = [
    ...(entry.preset ? [`preset ${entry.preset}`] : []),
    ...(entry.server ? [`server ${entry.server}`] : []),
    ...(entry.commands ? ['its own command'] : []),
    ...(entry.route !== undefined ? ['a route written down'] : []),
    ...(entry.account ? [`as ${entry.account}`] : []),
  ]
  return ways.length > 0 ? ` (${ways.join(', ')})` : ''
}

function restRow(hidden: number) {
  return hidden > 0 ? [`- and ${hidden} more: context-central work list`] : []
}
