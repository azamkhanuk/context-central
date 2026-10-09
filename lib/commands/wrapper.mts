import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { requireEstate } from '../estate.mts'
import { cmdLauncherTemplate, launcherAttributesTemplate, launcherTemplate } from '../templates.mts'
import type { Io } from '../cli.mts'

export const summary = 'Print a launcher for running the CLI from a terminal; --write saves it in the map, with one for cmd'

const SAVED = [
  { rel: 'bin/context-central', content: launcherTemplate, mode: 0o755, launcher: true },
  { rel: 'bin/context-central.cmd', content: cmdLauncherTemplate, mode: 0o644, launcher: true },
  { rel: 'bin/.gitattributes', content: launcherAttributesTemplate, mode: 0o644, launcher: false },
]
const DIFFERS = ' (differs from the one this release writes: delete it and run this again to renew it)'

export function run(args: string[], io: Io) {
  const { values } = parseArgs({ args, options: { write: { type: 'boolean' } } })
  if (!values.write) return void io.out(launcherTemplate().trimEnd())
  const { mapDir } = requireEstate(io)
  for (const file of SAVED) io.out(save(mapDir, file))
}

function save(mapDir: string, { rel, content, mode, launcher }: (typeof SAVED)[number]) {
  const path = join(mapDir, rel)
  if (existsSync(path)) return `kept ${rel}${launcher && !holds(path, content()) ? DIFFERS : ''}`
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content(), { flag: 'wx' })
  chmodSync(path, mode)
  return `created ${rel}`
}

function holds(path: string, text: string) {
  try {
    return readFileSync(path, 'utf8') === text
  } catch {
    return false
  }
}
