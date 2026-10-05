import { existsSync } from 'node:fs'
import { hubPath, inFlight, listWorkItems } from './nodes.mts'
import type { Estate } from './estate.mts'

const LAST_LINE = "A work item's state file records where it stands and what is next. context-central resolve <item> lists the notes behind it. Evidence that is not text sits in the item's evidence/ folder, named in a note."

export function indexData(estate: Estate) {
  const items = listWorkItems(estate)
    .filter(inFlight)
    .map(item => ({ id: item.id, title: item.title, entry: item.entry?.rel ?? null, path: item.entry?.path ?? null }))
  return { title: estate.config.title, mapDir: estate.mapDir, hub: hubPath(estate), items }
}

export function buildIndex(estate: Estate, { absolute = false }: { absolute?: boolean } = {}) {
  const { title, mapDir, hub, items } = indexData(estate)
  const head = [`Context map "${title}": ${mapDir}`, `Hub: ${hub}${existsSync(hub) ? '' : ' (missing)'}`]
  if (items.length === 0) return [...head, 'No work in flight.'].join('\n')
  const rows = items.map(item => `- ${item.id} | ${item.title} | ${(absolute ? item.path : item.entry) ?? 'no entry file'}`)
  const withRows = (shown: number) => [...head, `Work in flight (${rows.length}):`, ...rows.slice(0, shown), ...restRow(rows.length - shown), LAST_LINE].join('\n')
  let shown = rows.length
  while (shown > 0 && withRows(shown).length > estate.config.budgets.indexChars) shown -= 1
  return withRows(shown)
}

function restRow(hidden: number) {
  return hidden > 0 ? [`- and ${hidden} more: context-central work list`] : []
}
