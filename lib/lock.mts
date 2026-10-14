import { randomBytes } from 'node:crypto'
import { accessSync, chmodSync, constants, copyFileSync, lstatSync, mkdirSync, readFileSync, readlinkSync, realpathSync, renameSync, rmSync, rmdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { PluginError } from './errors.mts'

const LOCK = '.context-central.lock'
const WAIT_MS = 5000
const STALE_MS = 30000
const PAUSE_MS = 20
const LET_GO_TRIES = 25
const HELD = `the map is being written by another command, and still was after ${WAIT_MS / 1000} seconds, so nothing was written; run this again`
// With these a system says that a folder another process is removing is not gone yet.
const NOT_YET = ['EPERM', 'EBUSY']
const nap = new Int32Array(new SharedArrayBuffer(4))

export function locked<T>(mapDir: string, change: () => T): T {
  const lock = join(mapDir, LOCK)
  const until = performance.now() + WAIT_MS
  for (;;) {
    const refused = refusalOf(lock)
    if (!refused) break
    if (stale(lock) && tookOver(lock)) continue
    if (performance.now() >= until) throw refused.code === 'EEXIST' ? new PluginError(HELD) : refused
    pause()
  }
  try {
    return change()
  } finally {
    gone(lock)
  }
}

export function readWhole(path: string) {
  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    if (error instanceof Error && !error.message.includes(path)) error.message += ` '${path}'`
    throw error
  }
}

export function standsAt(path: string) {
  try {
    return lstatSync(path, { throwIfNoEntry: false }) !== undefined
  } catch {
    return false
  }
}

export function writeWhole(path: string, text: string, mode = 0o666) {
  landWhole(path, beside => writeFileSync(beside, text, { flag: 'wx', mode }))
}

export function copyWhole(from: string, path: string) {
  landWhole(path, beside => copyFileSync(from, beside, constants.COPYFILE_EXCL))
}

function landWhole(path: string, write: (beside: string) => void) {
  const held = statSync(path, { throwIfNoEntry: false })
  if (held) accessSync(path, constants.W_OK)
  const place = held ? realpathSync(path) : ledTo(path)
  const beside = join(dirname(place), `.context-central.${randomBytes(4).toString('hex')}.tmp`)
  try {
    write(beside)
    if (held) chmodSync(beside, held.mode & 0o7777)
    renameSync(beside, place)
  } finally {
    rmSync(beside, { force: true })
  }
}

function ledTo(path: string): string {
  const link = lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink() ? readlinkSync(path) : null
  return link === null ? path : ledTo(resolve(realpathSync(dirname(path)), link))
}

// A stale folder is removed only under a breaker of its own: on a look alone, two takers each remove what the other has just made.
function tookOver(folder: string) {
  const breaker = `${folder}.break`
  if (stale(breaker)) tookOver(breaker)
  if (refusalOf(breaker)) return false
  try {
    if (stale(folder)) gone(folder)
  } finally {
    gone(breaker)
  }
  return true
}

function refusalOf(folder: string) {
  try {
    mkdirSync(folder)
    return null
  } catch (error) {
    const refusal = error as NodeJS.ErrnoException
    if (refusal.code !== 'EEXIST' && !notYet(refusal)) throw error
    return refusal
  }
}

function stale(folder: string) {
  try {
    const held = statSync(folder, { throwIfNoEntry: false })
    return held !== undefined && Date.now() - held.mtimeMs >= STALE_MS
  } catch (error) {
    if (!notYet(error)) throw error
    return false
  }
}

function gone(folder: string) {
  for (let triesLeft = LET_GO_TRIES; ; triesLeft -= 1) {
    try {
      return rmdirSync(folder)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      if (triesLeft === 0 || !notYet(error)) throw error
      pause()
    }
  }
}

function notYet(error: unknown) {
  return NOT_YET.includes((error as NodeJS.ErrnoException).code ?? '')
}

function pause() {
  Atomics.wait(nap, 0, 0, PAUSE_MS + Math.floor(Math.random() * PAUSE_MS))
}
