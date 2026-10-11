import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, posix, relative, sep } from 'node:path'
import { CONFIG_FILE } from './estate.mts'
import { glossaryPath, glossaryRepo } from './glossary.mts'
import { holds, inTree } from './worktree.mts'
import type { Estate } from './estate.mts'

type Drafted = { [rel: string]: string }

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
