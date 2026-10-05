import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

export function loadSession(env, id) {
  const file = recordPath(env, id)
  if (!file) return { delivered: [], active: null }
  try {
    const held = JSON.parse(readFileSync(file, 'utf8'))
    return { delivered: Array.isArray(held.delivered) ? held.delivered : [], active: typeof held.active === 'string' ? held.active : null }
  } catch {
    return { delivered: [], active: null }
  }
}

export function saveSession(env, id, record) {
  const file = recordPath(env, id)
  if (!file) return
  try {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, `${JSON.stringify(record)}\n`)
  } catch {
    // an answer repeated later costs less than an answer withheld now
  }
}

export function resetSession(env, id) {
  const file = recordPath(env, id)
  if (file) rmSync(file, { force: true })
}

function recordPath(env, id) {
  if (typeof id !== 'string' || !id) return null
  const dir = env.CONTEXT_CENTRAL_STATE_DIR || join(tmpdir(), 'context-central')
  return join(dir, `${id.replace(/[^A-Za-z0-9_-]/g, '_')}.json`)
}
