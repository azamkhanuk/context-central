import { copyFileSync, constants, statSync } from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { PluginError, UsageError } from '../errors.mts'
import { requireEstate } from '../estate.mts'
import { EVIDENCE_DIR, findWorkItem, folderToSaveIn, makeFolder } from '../nodes.mts'
import { formatBytes, localDate } from '../text.mts'
import type { Io } from '../cli.mts'

export const summary = "Copy a file that is not text into a work item's evidence folder: evidence add <file> --item <item> [--as <what>]"

const EXTENSION = /^\.[a-z0-9]+$/i
const DATED = /^(\d{4}-\d{2}-\d{2})(?!\d)(.*)$/s

export function run(args: string[], io: Io) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { item: { type: 'string' }, as: { type: 'string' } } })
  const [action, given] = positionals
  if (action !== 'add' || !given || positionals.length !== 2 || !values.item) throw new UsageError('expected: evidence add <file> --item <item> [--as <what>]')
  const estate = requireEstate(io)
  const from = resolve(io.cwd, given)
  const size = sizeOf(from, given)
  const item = findWorkItem(estate, values.item)
  if (!item) throw new PluginError(`no work item "${values.item}"`)
  const extension = EXTENSION.test(extname(from)) ? extname(from) : ''
  const folder = `${folderToSaveIn(estate, item)}/${EVIDENCE_DIR}`
  const rel = `${folder}/${dated(values.as ?? basename(from, extension), localDate(io.env).day)}${extension.toLowerCase()}`
  makeFolder(estate.mapDir, folder)
  copy(from, join(estate.mapDir, rel), rel)
  io.out(`saved: ${rel} (${formatBytes(size)})`)
}

function sizeOf(path: string, given: string) {
  const stat = statSync(path, { throwIfNoEntry: false })
  if (!stat) throw new PluginError(`no file at ${given}`)
  if (!stat.isFile()) throw new PluginError(`${given} is a folder, not a file`)
  return stat.size
}

function dated(words: string, today: string) {
  const [, written, rest] = DATED.exec(words) ?? []
  const [day, named] = written && onTheCalendar(written) ? [written, rest] : [today, words]
  const what = cleaned(named)
  if (!what) throw new PluginError(`nothing is left of the name "${words}" once it is cleaned; give the words with --as`)
  return `${day}-${what}`
}

function onTheCalendar(day: string) {
  const date = new Date(`${day}T00:00:00Z`)
  // Date rolls 2025-02-30 over to March instead of refusing it, so the day must come back as written.
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(day)
}

function cleaned(words: string) {
  return words
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
}

function copy(from: string, to: string, rel: string) {
  try {
    copyFileSync(from, to, constants.COPYFILE_EXCL)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    throw new PluginError(`${rel} already exists; give other words with --as`)
  }
}
