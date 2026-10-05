import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Env } from './cli.mts'

export interface Session {
  delivered: string[]
  active: string | null
}

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
  } catch {
    // an answer repeated later costs less than an answer withheld now
  }
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
