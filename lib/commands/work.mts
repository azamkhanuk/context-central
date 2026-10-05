import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { PluginError, UsageError } from '../errors.mts'
import { requireEstate } from '../estate.mts'
import { EVIDENCE_DIR, findWorkItem, inFlight, listWorkItems } from '../nodes.mts'
import { stateTemplate } from '../templates.mts'
import { formatBytes, plural, setFrontmatter } from '../text.mts'
import type { Io } from '../cli.mts'
import type { Estate } from '../estate.mts'
import type { EntryFile, FileGroup, MapFile } from '../nodes.mts'

interface Action {
  flags: string[]
  needsItem?: boolean
}

type Size = Pick<FileGroup<MapFile>, 'count' | 'bytes'>

interface Listed {
  id: string
  title: string
  status: string
  entry: Pick<EntryFile, 'rel' | 'kind' | 'bytes'> | null
  notes: number
  deep: Size
  evidence: Size
}

export const summary = 'Work items: new <item>, list, done <item>, reopen <item>'

const ITEM_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const ACTIONS: Record<string, Action> = {
  new: { flags: ['title'] },
  list: { flags: ['json', 'all'] },
  done: { flags: [], needsItem: true },
  reopen: { flags: [], needsItem: true },
}

export function run(args: string[], io: Io) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { title: { type: 'string' }, json: { type: 'boolean' }, all: { type: 'boolean' } },
  })
  const [action, id] = positionals
  if (!Object.hasOwn(ACTIONS, action ?? '')) throw new UsageError('expected one of: new <item>, list, done <item>, reopen <item>')
  if (ACTIONS[action].needsItem && !id) throw new UsageError(`expected an item: work ${action} <item>`)
  const misplaced = Object.keys(values).find(flag => !ACTIONS[action].flags.includes(flag))
  if (misplaced) throw new UsageError(`--${misplaced} does not go with ${action}`)
  const estate = requireEstate(io)
  if (action === 'new') return create(estate, id, values.title, io)
  if (action === 'list') return list(estate, values, io)
  return setStatus(estate, id, action === 'done' ? 'done' : 'active', io)
}

function create(estate: Estate, id: string, title: string | undefined, io: Io) {
  if (!id || !ITEM_NAME.test(id)) throw new UsageError('an item name is letters, digits, dots, dashes and underscores, for example PROJ-12 or portal-split')
  if (findWorkItem(estate, id)) throw new PluginError(`${id} already exists`)
  const dirRel = `${estate.config.workDir}/${id}`
  for (const folder of ['notes', 'sources', EVIDENCE_DIR]) mkdirSync(join(estate.mapDir, dirRel, folder), { recursive: true })
  writeFileSync(join(estate.mapDir, dirRel, 'STATE.md'), stateTemplate(id, title ?? id))
  io.out(`${dirRel}/STATE.md`)
}

function list(estate: Estate, { json, all }: { json?: boolean; all?: boolean }, io: Io) {
  const items = listWorkItems(estate)
    .filter(item => all || inFlight(item))
    .map((item): Listed => ({
      id: item.id,
      title: item.title,
      status: item.status,
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
