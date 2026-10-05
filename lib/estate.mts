import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { ConfigError, PluginError } from './errors.mts'
import { withoutBom } from './text.mts'

export const CONFIG_FILE = 'estate.json'
export const INNER_DIR = '.context-central'

export const DEFAULT_NODE_DIRS = ['repos', 'areas', 'concepts', 'edges', 'decisions', 'docs', 'log', 'work']

export const CONFIG_MARKER = '"contextCentral"'

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

export function findEstate(startDir) {
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

export function loadEstate(startDir) {
  const found = findEstate(startDir)
  return found && { ...found, config: readConfig(found.configPath) }
}

export function requireEstate(io) {
  const estate = loadEstate(io.cwd)
  if (!estate) throw new PluginError(`no context map found from ${io.cwd}. Run "context-central init" or /context-central:onboard.`)
  return estate
}

export function coverage(estate, dir) {
  const rel = relative(estate.estateRoot, resolve(dir))
  if (rel.startsWith('..') || isAbsolute(rel)) return null
  if (rel === '') return 'root'
  const under = path => rel === fromPosix(path) || rel.startsWith(fromPosix(path) + sep)
  if (estate.config.leftAlone.some(under)) return null
  if (estate.layout === 'inner') return 'inside'
  const repo = estate.config.repos.find(candidate => under(candidate.path))
  if (repo) return `repo:${repo.name}`
  return estate.config.nodeDirs.some(under) ? 'node' : null
}

export function keyRegexes(config) {
  return config.tracker.keyPatterns.map(source => new RegExp(`\\b(?:${source})\\b`, 'gi'))
}

function candidates(dir) {
  const here = join(dir, CONFIG_FILE)
  return [
    basename(dir) === INNER_DIR ? { layout: 'inner', configPath: here, estateRoot: dirname(dir) } : { layout: 'root', configPath: here, estateRoot: dir },
    { layout: 'inner', configPath: join(dir, INNER_DIR, CONFIG_FILE), estateRoot: dir },
  ]
}

// Other tools write files named estate.json; only one carrying the marker is a map.
function isPluginConfig(path) {
  if (!existsSync(path)) return false
  try {
    return readFileSync(path, 'utf8').includes(CONFIG_MARKER)
  } catch {
    return false
  }
}

function readConfig(path) {
  let raw
  try {
    raw = JSON.parse(withoutBom(readFileSync(path, 'utf8')))
  } catch (error) {
    throw new ConfigError(`${path}: not valid JSON (${error.message})`)
  }
  return validateConfig(raw, path)
}

export function validateConfig(raw, label) {
  return normalise(raw, message => {
    throw new ConfigError(`${label}: ${message}`)
  })
}

function normalise(raw, fail) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('the config must be a JSON object')
  if (raw.contextCentral !== SCHEMA) fail(`"contextCentral" is ${JSON.stringify(raw.contextCentral)}; this version reads ${SCHEMA}`)
  if (typeof raw.name !== 'string' || !raw.name) fail('"name" must be a non-empty string')
  const tracker = raw.tracker ?? {}
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
    repos: list(raw.repos ?? [], 'repos', fail).map(repo => normaliseRepo(repo, fail)),
    tracker: { type: 'none', ...tracker, keyPatterns: keyPatterns(tracker.keyPatterns ?? [], fail) },
    evidence: evidence(raw.evidence, fail),
    budgets: { ...DEFAULT_BUDGETS, ...(raw.budgets ?? {}) },
  }
}

function normaliseRepo(repo, fail) {
  const entry = typeof repo === 'string' ? { name: repo } : repo
  if (!entry || typeof entry.name !== 'string' || !entry.name) fail('each entry in "repos" needs a "name"')
  return { path: entry.name, ...entry }
}

function keyPatterns(value, fail) {
  const sources = strings(value, 'tracker.keyPatterns', fail)
  for (const source of sources) {
    try {
      new RegExp(source)
    } catch {
      fail(`tracker.keyPatterns: "${source}" is not a valid regular expression`)
    }
  }
  return sources
}

function evidence(value = {}, fail) {
  const commit = value?.commit === undefined ? false : value.commit
  if (value === null || typeof value !== 'object' || Array.isArray(value) || typeof commit !== 'boolean') fail('"evidence.commit" must be true or false')
  return { ...value, commit }
}

function text(value, name, fail) {
  if (typeof value !== 'string' || !value) fail(`"${name}" must be text`)
  return value
}

function strings(value, name, fail) {
  const items = list(value, name, fail)
  if (items.some(item => typeof item !== 'string' || item === '')) fail(`"${name}" must be a list of non-empty strings`)
  return items
}

function list(value, name, fail) {
  if (!Array.isArray(value)) fail(`"${name}" must be a list`)
  return value
}

function fromPosix(path) {
  return path.split('/').join(sep)
}
