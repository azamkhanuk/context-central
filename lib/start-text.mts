import { hubNotLoaded } from './host.mts'
import { truncate } from './text.mts'
import type { Env } from './cli.mts'
import type { Estate } from './estate.mts'
import type { Host } from './host.mts'

const START_CHARS = 9500
const CUT = '\n[cut here; the file holds the rest]'

// The index and the hub's text are cut together at the hook's limit, so what is given of the hub is what the text before it leaves room for.
export function startText(text: string, host: Host, estate: Estate, startDir: string, env: Env) {
  const given = hubNotLoaded(host, estate, startDir, env, START_CHARS)
  if (!given) return { whole: truncate(text, START_CHARS, CUT), hubChars: null }
  const lead = `${text}\n\nHub (${given.hub}), which this host does not load by itself:\n`
  const whole = truncate(lead + given.text, START_CHARS, CUT)
  return { whole, hubChars: whole === lead + given.text ? given.text.length : Math.max(0, whole.length - CUT.length - lead.length) }
}
