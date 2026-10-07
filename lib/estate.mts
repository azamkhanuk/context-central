import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { list, patterns, strings, text } from './checks.mts'
import { connectionsOfOldMap, readConnections, unaskedOn } from './connections.mts'
import { ConfigError, PluginError } from './errors.mts'
import { withoutBom } from './text.mts'
import type { Fail } from './checks.mts'
import type { Io } from './cli.mts'
import type { Connection, Connections } from './connections.mts'

export const CONFIG_FILE = 'estate.json'
export const INNER_DIR = '.context-central'

export const DEFAULT_NODE_DIRS = ['repos', 'areas', 'concepts', 'edges', 'decisions', 'docs', 'standards', 'log', 'work']

export const CONFIG_MARKER = '"contextCentral"'

export const NODE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

const STANDARDS_DIR = 'standards'

const SCHEMA = 1
const DEFAULT_BUDGETS = {
  hubLines: 200,
  stateChars: 10000,
  indexChars: 2000,
  nodeBytes: 20000,
  resolveMax: 6,
  hookTextChars: 600,
  resumeNoticeTokens: 100000,
  evidenceBytes: 1024 * 1024,
}

export type Layout = 'root' | 'inner'

export type Budgets = typeof DEFAULT_BUDGETS

export interface Repo {
  name: string
  path: string
  role?: unknown
  standards?: string[]
  checks?: string[]
}

export interface Tracker {
  type: string
  keyPatterns: string[]
}

export interface EvidenceSettings {
  commit: boolean
}

export type WriteRules = string | unknown[] | Record<string, unknown>

export interface Settings {
  contextCentral: number
  name: string
  title: string
  hub: string
  nodeDirs: string[]
  notNodes: string[]
  leftAlone: string[]
  workDir: string
  deepDirs: string[]
  deepPatterns: string[]
  legacyHooks: string[]
  repos: Repo[]
  tracker: Tracker
  connections: Connections
  evidence: EvidenceSettings
  budgets: Budgets
  codeHost?: unknown
  writeRules?: WriteRules
}

type WrittenRepo = Pick<Repo, 'name'> & Partial<Pick<Repo, 'path' | 'role'>> & { standards?: unknown; checks?: unknown }

interface WrittenSettings {
  contextCentral: number
  name: string
  title?: unknown
  hub?: unknown
  nodeDirs?: unknown
  notNodes?: unknown
  leftAlone?: unknown
  workDir?: unknown
  deepDirs?: unknown
  deepPatterns?: unknown
  legacyHooks?: unknown
  repos?: unknown
  tracker?: { type?: string; keyPatterns?: unknown }
  connections?: unknown
  sources?: unknown
  evidence?: { commit?: unknown } | null
  budgets?: Partial<Budgets>
  codeHost?: unknown
  writeRules?: WriteRules
}

export interface StandardsFile {
  rel: string
  path: string
  state: 'file' | 'folder' | 'missing'
  note: boolean
}

export interface MapLocation {
  layout: Layout
  configPath: string
  estateRoot: string
  mapDir: string
}

export interface Estate extends MapLocation {
  config: Settings
  oldMap: boolean
  unasked: Connection[]
}

export type Coverage = 'root' | 'inside' | 'node' | `repo:${string}`

export function findEstate(startDir: string): MapLocation | null {
  let dir = resolve(startDir)
  for (;;) {
    for (const { layout, configPath, estateRoot } of candidates(dir)) {
      if (isPluginConfig(configPath)) return { layout, configPath, estateRoot, mapDir: dirname(configPath) }
    }
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

export function loadEstate(startDir: string): Estate | null {
  const found = findEstate(startDir)
  if (!found) return null
  const written = readWritten(found.configPath)
  const config = validateConfig(written, found.configPath)
  const { connections } = written as WrittenSettings
  return { ...found, config, oldMap: connections === undefined, unasked: unaskedOn({ connections }) }
}

export function requireEstate(io: Io) {
  const estate = loadEstate(io.cwd)
  if (!estate) throw new PluginError(`no context map found from ${io.cwd}. Run "context-central init" or /context-central:onboard.`)
  return estate
}

export function coverage(estate: Estate, dir: string): Coverage | null {
  const rel = relative(estate.estateRoot, resolve(dir))
  if (rel.startsWith('..') || isAbsolute(rel)) return null
  if (rel === '') return 'root'
  const under = (path: string) => rel === fromPosix(path) || rel.startsWith(fromPosix(path) + sep)
  if (estate.config.leftAlone.some(under)) return null
  if (estate.layout === 'inner') return 'inside'
  const repo = estate.config.repos.find(candidate => under(candidate.path))
  if (repo) return `repo:${repo.name}`
  return estate.config.nodeDirs.some(under) ? 'node' : null
}

export function standardsFiles({ estateRoot, mapDir, config }: Estate, repo: Repo): StandardsFile[] {
  const folder = join(mapDir, STANDARDS_DIR)
  const kept = config.nodeDirs.includes(STANDARDS_DIR)
  const namedAfter = (name: string) => join(folder, `${name}.md`)
  const named = namedAfter(repo.name)
  const nameable = NODE_NAME.test(repo.name)
  const byName = kept && nameable && stateOf(named) === 'file' ? [{ rel: relative(estateRoot, named).split(sep).join('/'), path: named }] : []
  const listed = (repo.standards ?? []).map(rel => ({ rel, path: resolve(estateRoot, rel) }))
  const seen = new Set<string>()
  const files = [...byName, ...listed]
    .map(file => ({ ...file, state: stateOf(file.path), real: realPath(file.path) }))
    .filter(file => !seen.has(file.real) && seen.add(file.real))
  const underAnotherName = () => {
    const ofOthers = new Set(config.repos.filter(other => NODE_NAME.test(other.name)).map(other => realPath(namedAfter(other.name))))
    return files.find(file => file.state === 'file' && dirname(file.real) === realPath(folder) && !ofOthers.has(file.real))
  }
  const note = !kept ? undefined : nameable ? byName.map(file => realPath(file.path))[0] : underAnotherName()?.real
  return files.map(({ real, ...file }) => ({ ...file, note: real === note }))
}

function stateOf(path: string): StandardsFile['state'] {
  const stat = statSync(path, { throwIfNoEntry: false })
  if (!stat) return 'missing'
  return stat.isFile() ? 'file' : 'folder'
}

function realPath(path: string) {
  try {
    return realpathSync.native(path)
  } catch {
    return path
  }
}

function candidates(dir: string): Omit<MapLocation, 'mapDir'>[] {
  const here = join(dir, CONFIG_FILE)
  return [
    basename(dir) === INNER_DIR ? { layout: 'inner', configPath: here, estateRoot: dirname(dir) } : { layout: 'root', configPath: here, estateRoot: dir },
    { layout: 'inner', configPath: join(dir, INNER_DIR, CONFIG_FILE), estateRoot: dir },
  ]
}

// Other tools write files named estate.json; only one carrying the marker is a map.
function isPluginConfig(path: string) {
  if (!existsSync(path)) return false
  try {
    return readFileSync(path, 'utf8').includes(CONFIG_MARKER)
  } catch {
    return false
  }
}

function readWritten(path: string): unknown {
  try {
    return JSON.parse(withoutBom(readFileSync(path, 'utf8')))
  } catch (error) {
    throw new ConfigError(`${path}: not valid JSON (${(error as Error).message})`)
  }
}

export function validateConfig(raw: unknown, label: string) {
  return normalise(raw as WrittenSettings | null, message => {
    throw new ConfigError(`${label}: ${message}`)
  })
}

function normalise(raw: WrittenSettings | null, fail: Fail): Settings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('the config must be a JSON object')
  if (raw.contextCentral !== SCHEMA) fail(`"contextCentral" is ${JSON.stringify(raw.contextCentral)}; this version reads ${SCHEMA}`)
  if (typeof raw.name !== 'string' || !raw.name) fail('"name" must be a non-empty string')
  const tracker = raw.connections === undefined ? (raw.tracker ?? {}) : {}
  const keyPatterns = patterns(tracker.keyPatterns ?? [], 'tracker.keyPatterns', fail)
  const repos = list(raw.repos ?? [], 'repos', fail).map(repo => normaliseRepo(repo as string | WrittenRepo | null, fail))
  return {
    ...raw,
    title: text(raw.title ?? raw.name, 'title', fail),
    hub: text(raw.hub ?? 'CLAUDE.md', 'hub', fail),
    nodeDirs: strings(raw.nodeDirs ?? DEFAULT_NODE_DIRS, 'nodeDirs', fail),
    notNodes: strings(raw.notNodes ?? [], 'notNodes', fail),
    leftAlone: strings(raw.leftAlone ?? [], 'leftAlone', fail),
    workDir: text(raw.workDir ?? 'work', 'workDir', fail),
    deepDirs: strings(raw.deepDirs ?? ['sources'], 'deepDirs', fail),
    deepPatterns: strings(raw.deepPatterns ?? ['*-full-text.md'], 'deepPatterns', fail),
    legacyHooks: strings(raw.legacyHooks ?? [], 'legacyHooks', fail),
    repos,
    tracker: { type: 'none', ...tracker, keyPatterns },
    connections: raw.connections === undefined ? connectionsOfOldMap(raw, keyPatterns) : readConnections(raw.connections, repos.map(repo => repo.name), fail),
    evidence: evidence(raw.evidence, fail),
    budgets: { ...DEFAULT_BUDGETS, ...(raw.budgets ?? {}) },
  }
}

function normaliseRepo(repo: string | WrittenRepo | null, fail: Fail): Repo {
  const entry = typeof repo === 'string' ? { name: repo } : repo
  if (!entry || typeof entry.name !== 'string' || !entry.name) fail('each entry in "repos" needs a "name"')
  if (!oneLine(entry.name)) fail('each entry in "repos" needs a "name" on one line')
  const inRepo: Fail = message => fail(`repo "${entry.name}": ${message}`)
  if (entry.path !== undefined && (typeof entry.path !== 'string' || !oneLine(entry.path))) inRepo('"path" must be one line of text')
  return {
    path: entry.name,
    ...entry,
    standards: entry.standards === undefined ? undefined : pathsInEstate(entry.standards, 'standards', inRepo),
    checks: entry.checks === undefined ? undefined : singleLines(entry.checks, 'checks', inRepo),
  }
}

function singleLines(value: unknown, name: string, fail: Fail) {
  const items = strings(value, name, fail)
  if (!items.every(oneLine)) fail(`each entry in "${name}" must be one line of text`)
  return items
}

function oneLine(text: string) {
  return text.trim() !== '' && !/[\u0000-\u0008\u000a-\u001f\u007f\u0085\u2028\u2029]/.test(text)
}

function pathsInEstate(value: unknown, name: string, fail: Fail) {
  const paths = singleLines(value, name, fail)
  const outside = paths.find(path => /^([/\\]|[A-Za-z]:)/.test(path) || path.includes('\\') || path.split('/').includes('..'))
  if (outside !== undefined) fail(`"${name}" holds "${outside}"; a path there is counted from the estate root, with forward slashes and no ".."`)
  return paths
}

function evidence(value: { commit?: unknown } | null = {}, fail: Fail): EvidenceSettings {
  const commit = value?.commit === undefined ? false : value.commit
  if (value === null || typeof value !== 'object' || Array.isArray(value) || typeof commit !== 'boolean') fail('"evidence.commit" must be true or false')
  return { ...value, commit }
}

function fromPosix(path: string) {
  return path.split('/').join(sep)
}
