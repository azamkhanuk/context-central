import { parseArgs } from 'node:util'
import { UsageError } from '../errors.mts'
import { hostFor, stepsOf, titleOf } from '../host.mts'
import type { Io } from '../cli.mts'

export const summary = 'Say which host the command runs under, and what differs there in setting a map up'

export function run(args: string[], io: Io) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { json: { type: 'boolean' } } })
  if (positionals.length > 0) throw new UsageError('host takes no word after it: it says which host it runs under')
  const host = hostFor(io.env)
  const steps = stepsOf(host).map(({ heading, paragraphs }) => ({ heading, text: paragraphs.join('\n\n') }))
  if (values.json) return void io.out(JSON.stringify({ host, title: titleOf(host), steps }, null, 2))
  io.out([`Host: ${titleOf(host)}`, ...steps.map(step => `${step.heading}:\n${step.text}`)].join('\n\n'))
}
