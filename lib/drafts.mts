import { createHash } from 'node:crypto'
import { copyFileSync, readFileSync, readdirSync, rmSync, rmdirSync, statSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, posix, relative, sep } from 'node:path'
import { ConfigError, PluginError } from './errors.mts'
import { CONFIG_FILE, validateConfig } from './estate.mts'
import { glossaryPath, glossaryRepo } from './glossary.mts'
import { makeFolder } from './nodes.mts'
import { withoutBom } from './text.mts'
import { gitTracks, holds } from './worktree.mts'
import type { Env } from './cli.mts'
import type { Estate } from './estate.mts'
import type { WorkTree } from './worktree.mts'

export interface Taken {
  took: string[]
  kept: { rel: string; why: string }[]
}

type Drafted = { [rel: string]: string }

type Verdict = 'took' | 'same' | { kept: string }

const RECORD = '.drafted.json'

export function draftsDir({ layout, mapDir, workTree }: Estate, env: Env, tree: WorkTree | null = workTree) {
  if (!tree || layout !== 'inner' || mapDir === tree.main || !holds(tree.main, mapDir)) return null
  const dir = join(tree.root, relative(tree.main, mapDir))
  return gitTracks(tree.root, dir, env) ? null : dir
}

export function inMap(estate: Estate, drafts: string | null, given: string) {
  const folder = isAbsolute(given) ? [drafts, estate.mapDir].find(held => held !== null && holds(held, given)) : estate.mapDir
  if (!folder || given.split(/[\\/]/).includes('..')) return null
  const rel = posix.normalize((isAbsolute(given) ? relative(folder, given) : given).split(sep).join('/'))
  return isMapFile(estate, rel) && !statSync(join(estate.mapDir, rel), { throwIfNoEntry: false })?.isDirectory() ? rel : null
}

export function mapFiles(estate: Estate) {
  const { nodeDirs, workDir } = estate.config
  return { files: [CONFIG_FILE, ...ownGlossary(estate)], folders: [...new Set([...nodeDirs, workDir].map(dir => dir.replace(/\/+$/, '')))] }
}

export function drafted(estate: Estate, drafts: string | null, rel: string) {
  const ours = join(estate.mapDir, rel)
  if (!drafts) return ours
  if (isFile(drafts)) throw new PluginError(`${drafts} is a file, not a folder, so no draft can be made there`)
  const draft = join(drafts, rel)
  const record = readRecord(drafts)
  if (isFile(ours) && (!statSync(draft, { throwIfNoEntry: false }) || (untouched(draft, record[rel]) && hashOf(ours) !== record[rel]))) {
    makeFolder(drafts, posix.dirname(rel))
    copyFileSync(ours, draft)
    writeRecord(drafts, { ...record, [rel]: hashOf(ours) })
  }
  return draft
}

export function waitingIn(estate: Estate, dir: string) {
  const record = readRecord(dir)
  return draftsIn(dir).filter(rel => !sameAsOurs(estate, dir, rel) && !untouched(join(dir, rel), record[rel]))
}

export function take(estate: Estate, drafts: string | null, over: string[]): Taken {
  const waiting = drafts ? draftsIn(drafts) : []
  const unmet = over.find(rel => !waiting.includes(rel))
  if (unmet) throw new PluginError(`no draft of ${unmet} waits here`)
  const taken: Taken = { took: [], kept: [] }
  if (!drafts || !statSync(drafts, { throwIfNoEntry: false })?.isDirectory()) return taken
  const record = readRecord(drafts)
  for (const rel of waiting) {
    const verdict = settle(estate, drafts, rel, record[rel], over.includes(rel))
    if (typeof verdict === 'object') {
      taken.kept.push({ rel, why: verdict.kept })
      continue
    }
    if (verdict === 'took') taken.took.push(rel)
    rmSync(join(drafts, rel))
  }
  tidy(drafts, Object.fromEntries(Object.entries(record).filter(([rel]) => isFile(join(drafts, rel)))))
  return taken
}

function settle(estate: Estate, drafts: string, rel: string, base: string | undefined, forced: boolean): Verdict {
  const draft = join(drafts, rel)
  const ours = join(estate.mapDir, rel)
  const held = isFile(ours)
  if (sameAsOurs(estate, drafts, rel) || untouched(draft, base)) return 'same'
  if (!isMapFile(estate, rel)) return { kept: 'not a file of the map' }
  if (statSync(ours, { throwIfNoEntry: false })?.isDirectory()) return { kept: 'the map holds a folder at this path' }
  const fault = rel === CONFIG_FILE ? settingsFault(draft) : null
  if (fault) return { kept: fault }
  if (held && !forced && base !== hashOf(ours)) return { kept: `${base ? "the map's file changed after this was drafted" : 'the map holds this file and the draft was not made from it'}; compare it with ${ours}, then run context-central take --over ${rel}` }
  try {
    makeFolder(estate.mapDir, posix.dirname(rel))
    copyFileSync(draft, ours)
  } catch (error) {
    if (error instanceof PluginError) return { kept: error.message }
    const { code } = error as NodeJS.ErrnoException
    if (!code) throw error
    return { kept: `it could not be written into the map (${code})` }
  }
  return 'took'
}

function settingsFault(draft: string) {
  try {
    validateConfig(JSON.parse(withoutBom(readFileSync(draft, 'utf8'))), CONFIG_FILE)
    return null
  } catch (error) {
    if (error instanceof SyntaxError) return `not valid JSON (${error.message})`
    if (!(error instanceof ConfigError)) throw error
    return error.message.replace(`${CONFIG_FILE}: `, '')
  }
}

function sameAsOurs(estate: Estate, drafts: string, rel: string) {
  const ours = join(estate.mapDir, rel)
  return isFile(ours) && readFileSync(join(drafts, rel)).equals(readFileSync(ours))
}

function untouched(draft: string, base: string | undefined) {
  return base !== undefined && isFile(draft) && hashOf(draft) === base
}

function draftsIn(dir: string, below = ''): string[] {
  if (!statSync(join(dir, below), { throwIfNoEntry: false })?.isDirectory()) return []
  return readdirSync(join(dir, below), { withFileTypes: true })
    .filter(entry => !entry.name.startsWith('.'))
    .flatMap(entry => {
      const rel = below ? `${below}/${entry.name}` : entry.name
      return entry.isDirectory() ? draftsIn(dir, rel) : entry.isFile() ? [rel] : []
    })
    .sort()
}

function tidy(drafts: string, record: Drafted) {
  if (Object.keys(record).length > 0) writeRecord(drafts, record)
  else rmSync(join(drafts, RECORD), { force: true })
  prune(drafts)
}

function prune(dir: string) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) if (entry.isDirectory() && !entry.name.startsWith('.')) prune(join(dir, entry.name))
  if (readdirSync(dir).length === 0) rmdirSync(dir)
}

function isMapFile(estate: Estate, rel: string) {
  const { files, folders } = mapFiles(estate)
  const hidden = rel.split('/').some(part => part.startsWith('.'))
  return files.includes(rel) || (!hidden && !rel.endsWith('/') && folders.some(folder => rel.startsWith(`${folder}/`)))
}

function ownGlossary(estate: Estate) {
  const glossary = glossaryPath(estate)
  return glossaryRepo(estate) === null && glossary !== estate.mapDir && holds(estate.mapDir, glossary) ? [relative(estate.mapDir, glossary).split(sep).join('/')] : []
}

function readRecord(drafts: string): Drafted {
  try {
    const held = JSON.parse(readFileSync(join(drafts, RECORD), 'utf8')) as unknown
    return held && typeof held === 'object' && !Array.isArray(held) ? (held as Drafted) : {}
  } catch {
    return {}
  }
}

function writeRecord(drafts: string, record: Drafted) {
  writeFileSync(join(drafts, RECORD), `${JSON.stringify(record, null, 2)}\n`)
}

function hashOf(path: string) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function isFile(path: string) {
  return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false
}
