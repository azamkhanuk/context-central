import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { requireEstate } from '../estate.mjs'
import { launcherTemplate } from '../templates.mjs'

export const summary = 'Print a launcher for running the CLI from a terminal; --write saves it in the map'

const LAUNCHER = 'bin/context-central'

export function run(args, io) {
  const { values } = parseArgs({ args, options: { write: { type: 'boolean' } } })
  if (!values.write) return void io.out(launcherTemplate().trimEnd())
  io.out(`${save(join(requireEstate(io).mapDir, LAUNCHER))} ${LAUNCHER}`)
}

function save(path) {
  if (existsSync(path)) return 'kept'
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, launcherTemplate(), { flag: 'wx' })
  chmodSync(path, 0o755)
  return 'created'
}
