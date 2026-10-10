import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { clock } from './text.mts'
import type { Env } from './cli.mts'

export interface Session {
  delivered: string[]
  active: string | null
}

const KEPT_MS = 14 * 24 * 60 * 60 * 1000

export function loadSession(env: Env, id: unknown): Session {
  const file = recordPath(env, id)
  if (!file) return { delivered: [], active: null }
  try {
    const held = JSON.parse(readFileSync(file, 'utf8')) as Partial<Session>
    return { delivered: Array.isArray(held.delivered) ? held.delivered : [], active: typeof held.active === 'string' ? held.active : null }
  } catch {
    return { delivered: [], active: null }
  }
}

export function saveSession(env: Env, id: unknown, record: Session) {
  const file = recordPath(env, id)
  if (!file) return
  try {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, `${JSON.stringify(record)}\n`)
    if (!env.CONTEXT_CENTRAL_STATE_DIR) sweep(file, clock(env).getTime() - KEPT_MS)
  } catch {
    // an answer repeated later costs less than an answer withheld now
  }
}

export function touchSession(env: Env, id: unknown) {
  const file = recordPath(env, id)
  if (!file) return
  try {
    utimesSync(file, clock(env), clock(env))
  } catch {
    // a session that has been given nothing yet has no record to keep
  }
}

function sweep(saved: string, before: number) {
  const dir = dirname(saved)
  for (const name of readdirSync(dir)) {
    const file = join(dir, name)
    if (file === saved || !name.endsWith('.json')) continue
    try {
      if (statSync(file).mtimeMs < before) rmSync(file)
    } catch {
      // one record that will not go must not keep the ones after it
    }
  }
}

export function forgetDelivered(env: Env, id: unknown, keep: (key: string) => boolean) {
  const file = recordPath(env, id)
  if (!file || !existsSync(file)) return
  const held = loadSession(env, id)
  saveSession(env, id, { delivered: held.delivered.filter(keep), active: held.active })
}

export function resetSession(env: Env, id: unknown) {
  const file = recordPath(env, id)
  if (file) rmSync(file, { force: true })
}

function recordPath(env: Env, id: unknown) {
  if (typeof id !== 'string' || !id) return null
  const dir = env.CONTEXT_CENTRAL_STATE_DIR || join(tmpdir(), 'context-central')
  return join(dir, `${id.replace(/[^A-Za-z0-9_-]/g, '_')}.json`)
}
