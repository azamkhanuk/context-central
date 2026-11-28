import { parseArgs } from 'node:util'
import { UsageError } from '../errors.mts'
import { hostFor, titleOf } from '../host.mts'
import type { Io } from '../cli.mts'

export const summary = 'Say which host the command runs under'

export function run(args: string[], io: Io) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { json: { type: 'boolean' } } })
  if (positionals.length > 0) throw new UsageError('host takes no word after it: it says which host it runs under')
  const host = hostFor(io.env)
  if (values.json) return void io.out(JSON.stringify({ host, title: titleOf(host) }, null, 2))
  io.out(`Host: ${titleOf(host)}`)
}
