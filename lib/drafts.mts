import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, rmdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, posix, relative, sep } from 'node:path'
import { ConfigError, PluginError } from './errors.mts'
import { CONFIG_FILE, validateConfig } from './estate.mts'
import { glossaryPath, glossaryRepo } from './glossary.mts'
import { makeFolder } from './nodes.mts'
import { withoutBom } from './text.mts'
import { holds, inTree } from './worktree.mts'
import type { Estate } from './estate.mts'

export interface Taken {
  took: string[]
  kept: { rel: string; why: string }[]
}

type Drafted = { [rel: string]: string }

type Verdict = 'took' | 'same' | { kept: string }

const RECORD = '.drafted.json'

export function draftsDir({ workTree, layout, mapDir }: Estate) {
  return workTree && layout === 'inner' && mapDir !== workTree.main && holds(workTree.main, mapDir) ? inTree(workTree, mapDir) : null
}

export function inMap(estate: Estate, given: string) {
  const folder = isAbsolute(given) ? [draftsDir(estate), estate.mapDir].find(held => held !== null && holds(held, given)) : estate.mapDir
  if (!folder) return null
  const rel = posix.normalize((isAbsolute(given) ? relative(folder, given) : given).split(sep).join('/'))
  return isMapFile(estate, rel) ? rel : null
}

export function mapFiles(estate: Estate) {
  return { files: [CONFIG_FILE, ...ownGlossary(estate)], folders: estate.config.nodeDirs.map(dir => dir.replace(/\/+$/, '')) }
}

export function drafted(estate: Estate, rel: string) {
  const drafts = draftsDir(estate)
  const ours = join(estate.mapDir, rel)
  if (!drafts) return ours
  const draft = join(drafts, rel)
  if (isFile(ours) && !statSync(draft, { throwIfNoEntry: false })) {
    mkdirSync(dirname(draft), { recursive: true })
    copyFileSync(ours, draft)
    writeRecord(drafts, { ...readRecord(drafts), [rel]: hashOf(ours) })
  }
  return draft
}

export function waitingIn(estate: Estate, dir: string) {
  return draftsIn(dir).filter(rel => !sameAsOurs(estate, dir, rel))
}

export function take(estate: Estate, over: string[]): Taken {
  const drafts = draftsDir(estate)
  const waiting = drafts ? draftsIn(drafts) : []
  const unmet = over.find(rel => !waiting.includes(rel))
  if (unmet) throw new PluginError(`no draft of ${unmet} waits here`)
  const taken: Taken = { took: [], kept: [] }
  if (!drafts || waiting.length === 0) return taken
  const record = readRecord(drafts)
  for (const rel of waiting) {
    const verdict = settle(estate, drafts, rel, record[rel], over.includes(rel))
    if (typeof verdict === 'object') {
      taken.kept.push({ rel, why: verdict.kept })
      continue
    }
    if (verdict === 'took') taken.took.push(rel)
    rmSync(join(drafts, rel))
    delete record[rel]
  }
  tidy(drafts, record)
  return taken
}

function settle(estate: Estate, drafts: string, rel: string, base: string | undefined, forced: boolean): Verdict {
  const draft = join(drafts, rel)
  const ours = join(estate.mapDir, rel)
  const held = isFile(ours)
  if (sameAsOurs(estate, drafts, rel)) return 'same'
  if (!isMapFile(estate, rel)) return { kept: 'not a file of the map' }
  const fault = rel === CONFIG_FILE ? settingsFault(draft) : null
  if (fault) return { kept: fault }
  if (held && !forced && base !== hashOf(ours)) return { kept: `${base ? "the map's file changed after this was drafted" : 'the map holds this file and the draft was not made from it'}; compare it with ${ours}, then run context-central take --over ${rel}` }
  try {
    makeFolder(estate.mapDir, posix.dirname(rel))
  } catch (error) {
    if (!(error instanceof PluginError)) throw error
    return { kept: error.message }
  }
  copyFileSync(draft, ours)
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
  return files.includes(rel) || (!rel.endsWith('/') && folders.some(folder => rel.startsWith(`${folder}/`)))
}

function ownGlossary(estate: Estate) {
  const glossary = glossaryPath(estate)
  return glossaryRepo(estate) === null && glossary !== estate.mapDir && holds(estate.mapDir, glossary) ? [relative(estate.mapDir, glossary).split(sep).join('/')] : []
}

function readRecord(drafts: string): Drafted {
  try {
    return JSON.parse(readFileSync(join(drafts, RECORD), 'utf8')) as Drafted
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
