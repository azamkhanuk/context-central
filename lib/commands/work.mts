import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, posix } from 'node:path'
import { parseArgs } from 'node:util'
import { listed, ticketOf } from '../connections.mts'
import { PluginError, UsageError } from '../errors.mts'
import { requireEstate } from '../estate.mts'
import { EVIDENCE_DIR, findWorkItem, inFlight, leftOut, listWorkItems, makeFolder, underNotNodes } from '../nodes.mts'
import { pointedTo } from '../resolve.mts'
import { stateTemplate } from '../templates.mts'
import { formatBytes, localDate, plural, setFrontmatter } from '../text.mts'
import type { Env, Io } from '../cli.mts'
import type { Estate } from '../estate.mts'
import type { EntryFile, FileGroup, MapFile, WorkItem } from '../nodes.mts'

interface Action {
  flags: string[]
  needsItem?: boolean
}

type Size = Pick<FileGroup<MapFile>, 'count' | 'bytes'>

interface Listed {
  id: string
  title: string
  status: string
  ticket: string | null
  entry: Pick<EntryFile, 'rel' | 'kind' | 'bytes'> | null
  notes: number
  deep: Size
  evidence: Size
}

export const summary = 'Work items: new <item>, list, done <item>, reopen <item>, adopt <item> or --all'

const ITEM_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const FOLDERS = ['notes', 'sources', EVIDENCE_DIR]
const TICKET = /^[^\s"\p{Cc}-][^\s"\p{Cc}]*$/u
const ACTIONS: Record<string, Action> = {
  new: { flags: ['title', 'ticket'] },
  list: { flags: ['json', 'all'] },
  done: { flags: [], needsItem: true },
  reopen: { flags: [], needsItem: true },
  adopt: { flags: ['all'] },
}

export function run(args: string[], io: Io) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { title: { type: 'string' }, ticket: { type: 'string' }, json: { type: 'boolean' }, all: { type: 'boolean' } },
  })
  const [action, id] = positionals
  if (!Object.hasOwn(ACTIONS, action ?? '')) throw new UsageError('expected one of: new <item>, list, done <item>, reopen <item>, adopt <item> or --all')
  if (ACTIONS[action].needsItem && !id) throw new UsageError(`expected an item: work ${action} <item>`)
  const misplaced = Object.keys(values).find(flag => !ACTIONS[action].flags.includes(flag))
  if (misplaced) throw new UsageError(`--${misplaced} does not go with ${action}`)
  const estate = requireEstate(io)
  if (action === 'new') return create(estate, id, values, io)
  if (action === 'list') return list(estate, values, io)
  if (action === 'adopt') return adopt(estate, id, values.all, io)
  return setStatus(estate, id, action === 'done' ? 'done' : 'active', io)
}

function create(estate: Estate, id: string, { title, ticket }: { title?: string; ticket?: string }, io: Io) {
  if (!id || !ITEM_NAME.test(id)) throw new UsageError('an item name is letters, digits, dots, dashes and underscores, for example PROJ-12 or portal-split')
  if (ticket !== undefined && !TICKET.test(ticket)) throw new UsageError('a ticket is one word with no double quote in it and no dash at its start, for example PROJ-12, #41 or a link')
  if (findWorkItem(estate, id)) throw new PluginError(`${id} already exists`)
  const dirRel = `${estate.config.workDir}/${id}`
  refuseUnlisted(estate, dirRel)
  for (const folder of FOLDERS) makeFolder(estate.mapDir, `${dirRel}/${folder}`)
  writeFileSync(join(estate.mapDir, dirRel, 'STATE.md'), stateTemplate(id, title ?? id, ticketOf(listed(estate.config.connections), { id, ticket: ticket ?? null })), { flag: 'wx' })
  io.out(`${dirRel}/STATE.md`)
}

function adopt(estate: Estate, id: string | undefined, all: boolean | undefined, io: Io) {
  if (Boolean(id) === Boolean(all)) throw new UsageError('expected an item or --all: work adopt <item>, or work adopt --all')
  if (!id) return adoptAll(estate, io)
  const item = findWorkItem(estate, id)
  if (!item) throw new PluginError(`no work item "${id}"`)
  io.out(adopted(estate, item, io.env))
}

function adoptAll(estate: Estate, io: Io) {
  const older = listWorkItems(estate).filter(item => item.entry && item.entry.kind !== 'state')
  if (older.length === 0) return void io.out('No older items.')
  let refused = 0
  for (const item of older) {
    try {
      io.out(adopted(estate, item, io.env))
    } catch (error) {
      if (!(error instanceof PluginError)) throw error
      io.err(`context-central work: ${error.message}`)
      refused += 1
    }
  }
  return refused > 0 ? 1 : 0
}

function adopted(estate: Estate, item: WorkItem, env: Env) {
  const already = `${item.id} has a state file already`
  if (item.entry?.kind === 'state') return already
  refuseUnlisted(estate, item.dirRel)
  const stateRel = `${item.dirRel}/STATE.md`
  const inTheWay = namesIn(join(estate.mapDir, item.dirRel)).find(name => name !== 'STATE.md' && name.toLowerCase() === 'state.md')
  if (inTheWay) throw new PluginError(`${item.dirRel}/${inTheWay} has the state file's name in another letter case, so nothing was written: rename it, then adopt the item again`)
  for (const folder of FOLDERS) makeFolder(estate.mapDir, `${item.dirRel}/${folder}`)
  const fromFolder = (rel: string) => posix.relative(item.dirRel, rel)
  const from = { status: item.status, day: localDate(env).day, older: item.entry ? fromFolder(item.entry.rel) : null, linked: item.entry ? pointedTo(estate, item.entry).map(fromFolder) : [] }
  try {
    writeFileSync(join(estate.mapDir, stateRel), stateTemplate(item.id, item.title, ticketOf(listed(estate.config.connections), item), from), { flag: 'wx' })
  } catch (error) {
    if (findWorkItem(estate, item.id)?.entry?.kind === 'state') return already
    throw new PluginError(`${stateRel} could not be written: ${(error as Error).message}`)
  }
  return stateRel
}

function refuseUnlisted(estate: Estate, dirRel: string) {
  if (!leftOut(estate.config, dirRel)) return
  const why = underNotNodes(estate.config, dirRel) ? 'is under a notNodes entry' : 'is a name kept for a file that is not work'
  throw new PluginError(`${dirRel} ${why}, so a work item made there would never be listed`)
}

function namesIn(dir: string) {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

function list(estate: Estate, { json, all }: { json?: boolean; all?: boolean }, io: Io) {
  const recorded = listed(estate.config.connections)
  const items = listWorkItems(estate)
    .filter(item => all || inFlight(item))
    .map((item): Listed => ({
      id: item.id,
      title: item.title,
      status: item.status,
      ticket: ticketOf(recorded, item),
      entry: item.entry && { rel: item.entry.rel, kind: item.entry.kind, bytes: item.entry.bytes },
      notes: item.files.length,
      deep: { count: item.deep.count, bytes: item.deep.bytes },
      evidence: { count: item.evidence.count, bytes: item.evidence.bytes },
    }))
  if (json) return io.out(JSON.stringify(items, null, 2))
  if (items.length === 0) return io.out('No work in flight.')
  for (const item of items) io.out(describe(item, all))
}

function describe(item: Listed, showStatus: boolean | undefined) {
  const evidence = item.evidence.count > 0 ? `, ${plural(item.evidence.count, 'evidence file')} (${formatBytes(item.evidence.bytes)})` : ''
  const behind = `${plural(item.notes, 'note')}, ${plural(item.deep.count, 'deep file')} (${formatBytes(item.deep.bytes)})${evidence}`
  const status = showStatus ? ` | ${item.status}` : ''
  return `${item.id} | ${item.title} | ${item.entry?.rel ?? 'no entry file'}${status} | ${behind}`
}

function setStatus(estate: Estate, id: string, status: string, io: Io) {
  const item = findWorkItem(estate, id)
  if (!item) throw new PluginError(`no work item "${id}"`)
  if (!item.entry) throw new PluginError(`${item.id} has no entry file to mark`)
  writeFileSync(item.entry.path, setFrontmatter(readFileSync(item.entry.path, 'utf8'), 'status', status))
  io.out(`${item.id}: ${status}`)
}
