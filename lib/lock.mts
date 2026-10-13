import { randomBytes } from 'node:crypto'
import { accessSync, chmodSync, constants, copyFileSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, rmdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { PluginError } from './errors.mts'

const LOCK = '.context-central.lock'
const WAIT_MS = 5000
const STALE_MS = 30000
const PAUSE_MS = 20
const nap = new Int32Array(new SharedArrayBuffer(4))

export function locked<T>(mapDir: string, change: () => T): T {
  const lock = join(mapDir, LOCK)
  const until = performance.now() + WAIT_MS
  while (!made(lock)) {
    if (stale(lock) && tookOver(lock)) continue
    if (performance.now() >= until) throw new PluginError(`the map is being written by another command, and still was after ${WAIT_MS / 1000} seconds, so nothing was written; run this again`)
    Atomics.wait(nap, 0, 0, PAUSE_MS + Math.floor(Math.random() * PAUSE_MS))
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

export function writeWhole(path: string, text: string, mode = 0o666) {
  landWhole(path, beside => writeFileSync(beside, text, { flag: 'wx', mode }))
}

export function copyWhole(from: string, path: string) {
  landWhole(path, beside => copyFileSync(from, beside, constants.COPYFILE_EXCL))
}

function landWhole(path: string, write: (beside: string) => void) {
  const held = statSync(path, { throwIfNoEntry: false })
  if (held) accessSync(path, constants.W_OK)
  const place = held ? realpathSync(path) : path
  const beside = join(dirname(place), `.context-central.${randomBytes(4).toString('hex')}.tmp`)
  try {
    write(beside)
    if (held) chmodSync(beside, held.mode & 0o7777)
    renameSync(beside, place)
  } finally {
    rmSync(beside, { force: true })
  }
}

function tookOver(lock: string) {
  const breaker = `${lock}.break`
  if (stale(breaker)) gone(breaker)
  if (!made(breaker)) return false
  try {
    if (stale(lock)) gone(lock)
  } finally {
    gone(breaker)
  }
  return true
}

function made(folder: string) {
  try {
    mkdirSync(folder)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    return false
  }
}

function stale(folder: string) {
  const held = statSync(folder, { throwIfNoEntry: false })
  return held !== undefined && Date.now() - held.mtimeMs >= STALE_MS
}

function gone(folder: string) {
  try {
    rmdirSync(folder)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}
