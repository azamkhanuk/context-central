import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { requireEstate } from '../estate.mts'
import { cmdLauncherTemplate, launcherAttributesTemplate, launcherTemplate } from '../templates.mts'

export const summary = 'Print a launcher for running the CLI from a terminal; --write saves it in the map, with one for cmd'

const SAVED = [
  { rel: 'bin/context-central', content: launcherTemplate, mode: 0o755 },
  { rel: 'bin/context-central.cmd', content: cmdLauncherTemplate, mode: 0o644 },
  { rel: 'bin/.gitattributes', content: launcherAttributesTemplate, mode: 0o644 },
]

export function run(args, io) {
  const { values } = parseArgs({ args, options: { write: { type: 'boolean' } } })
  if (!values.write) return void io.out(launcherTemplate().trimEnd())
  const { mapDir } = requireEstate(io)
  for (const file of SAVED) io.out(`${save(join(mapDir, file.rel), file)} ${file.rel}`)
}

function save(path, { content, mode }) {
  if (existsSync(path)) return 'kept'
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content(), { flag: 'wx' })
  chmodSync(path, mode)
  return 'created'
}
