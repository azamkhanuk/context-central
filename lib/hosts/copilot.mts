import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { withoutBom } from '../text.mts'
import type { Env } from '../cli.mts'

export interface CopilotInstall {
  id: string
  installPath: string
  enabled: boolean
}

export const COPILOTS_OWN_INSTRUCTIONS = '.github/copilot-instructions.md'
export const COPILOTS_OWN_SERVERS = '.github/mcp.json'
const BRINGS_FILES_IN = [COPILOTS_OWN_INSTRUCTIONS, 'AGENTS.md', 'CLAUDE.md']
const LOADS_AT_A_ROOT = [...BRINGS_FILES_IN, '.claude/CLAUDE.md', 'GEMINI.md']
const RULES = ['.claude', 'rules']
const INSTRUCTIONS = ['.github', 'instructions']
const LOADS_UNDER = [/^\.claude\/rules\/.+\.md$/]
const SCOPED_AT_A_ROOT = [/^\.github\/instructions\/.+\.instructions\.md$/]
const SCOPED_IN_AN_ADDED_FOLDER = [/^[^/]+\.instructions\.md$/, ...SCOPED_AT_A_ROOT]
const EVERY_FILE = ['**', '**/*']
const HEAD_BYTES = 4096
const ONE_WORD = /^[^\s\p{Cc}]+$/u

export const COPILOT = {
  title: 'the Copilot command line',
  namesToItsHooks: 'COPILOT_PLUGIN_ROOT',
  setsForACommand: 'COPILOT_CLI',
}

export function copilotHome(env: Env) {
  return env.COPILOT_HOME || join(env.HOME ?? homedir(), '.copilot')
}

export function copilotInstalls(env: Env): CopilotInstall[] {
  const { installedPlugins } = recordIn(join(copilotHome(env), 'config.json'))
  if (!Array.isArray(installedPlugins)) return []
  return installedPlugins.flatMap((install: unknown) => {
    const { name, marketplace, cache_path: installPath, enabled } = (install && typeof install === 'object' ? install : {}) as { [key: string]: unknown }
    if (!oneWord(name) || typeof installPath !== 'string' || !installPath) return []
    return [{ id: oneWord(marketplace) ? `${name}@${marketplace}` : name, installPath, enabled: enabled !== false }]
  })
}

// A file is counted from the folder a session starts in or from the root of its repository, with forward slashes.
export function copilotLoadsAtAStart(fromRoot: string, file: string) {
  return LOADS_AT_A_ROOT.includes(fromRoot) || LOADS_UNDER.some(pattern => pattern.test(fromRoot)) || (SCOPED_AT_A_ROOT.some(pattern => pattern.test(fromRoot)) && appliesToEveryFile(file))
}

export function foldersAddedToCopilot(env: Env) {
  return (env.COPILOT_CUSTOM_INSTRUCTIONS_DIRS ?? '').split(',').map(folder => folder.trim()).filter(Boolean)
}

export function copilotLoadsFromAnAddedFolder(fromFolder: string, file: string) {
  return SCOPED_IN_AN_ADDED_FOLDER.some(pattern => pattern.test(fromFolder)) && appliesToEveryFile(file)
}

export interface CopilotLoads {
  files: { path: string; source: string; bringsFilesIn: boolean }[]
  scoped: number
}

// Named files are looked for in the repository's root, the folder a session starts in and each folder between, and rules and instructions files in the first two.
export function copilotLoadsIn(dir: string, env: Env): CopilotLoads {
  const home = copilotHome(env)
  const root = repositoryRoot(dir)
  const folders = root === null ? [dir] : between(root, dir)
  const where = (folder: string) => (folder === root ? 'repository' : 'folder')
  const own = everyFileOrScoped(markdownUnder(join(home, 'instructions'), '.instructions.md'))
  const inFolders = folders.map(folder => ({
    named: LOADS_AT_A_ROOT.map(name => ({ path: join(folder, ...name.split('/')), source: where(folder), bringsFilesIn: BRINGS_FILES_IN.includes(name) })).filter(file => isFile(file.path)),
    rules: folder === root || folder === dir ? markdownUnder(join(folder, ...RULES), '.md') : [],
    instructions: everyFileOrScoped(folder === root || folder === dir ? markdownUnder(join(folder, ...INSTRUCTIONS), '.instructions.md') : []),
    where: where(folder),
  }))
  const plain = (path: string, source: string) => ({ path, source, bringsFilesIn: false })
  return {
    files: [
      ...[join(home, 'copilot-instructions.md')].filter(isFile).map(path => plain(path, 'user')),
      ...own.everyFile.map(path => plain(path, 'user instructions')),
      ...inFolders.flatMap(found => [...found.named, ...found.rules.map(path => plain(path, `${found.where} rule`)), ...found.instructions.everyFile.map(path => plain(path, `${found.where} instructions`))]),
    ],
    scoped: own.scoped + inFolders.reduce((sum, found) => sum + found.instructions.scoped, 0),
  }
}

export function repositoryRoot(dir: string): string | null {
  if (existsSync(join(dir, '.git'))) return dir
  return dirname(dir) === dir ? null : repositoryRoot(dirname(dir))
}

function between(root: string, dir: string): string[] {
  return dir === root || dirname(dir) === dir ? [dir] : [...between(root, dirname(dir)), dir]
}

function everyFileOrScoped(paths: string[]) {
  const everyFile = paths.filter(appliesToEveryFile)
  return { everyFile, scoped: paths.length - everyFile.length }
}

function markdownUnder(dir: string, ending: string): string[] {
  if (!isFolder(dir)) return []
  return readdirSync(dir)
    .sort()
    .flatMap(name => {
      const path = join(dir, name)
      if (isFolder(path)) return markdownUnder(path, ending)
      return isFile(path) && name.endsWith(ending) ? [path] : []
    })
}

function isFolder(path: string) {
  return existsSync(path) && statSync(path).isDirectory()
}

function isFile(path: string) {
  return existsSync(path) && statSync(path).isFile()
}

// An instructions file that names the files it applies to is put before the model only once one of them is worked on.
function appliesToEveryFile(file: string) {
  const [, head] = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(startOf(file)) ?? []
  const [, applies] = /^applyTo:\s*(.*?)\s*$/m.exec(head ?? '') ?? []
  return applies === undefined || EVERY_FILE.includes(applies.replace(/^(['"])(.*)\1$/, '$2'))
}

function startOf(file: string) {
  try {
    const opened = openSync(file, 'r')
    try {
      const bytes = Buffer.alloc(HEAD_BYTES)
      return withoutBom(bytes.toString('utf8', 0, readSync(opened, bytes, 0, bytes.length, 0)))
    } finally {
      closeSync(opened)
    }
  } catch {
    return ''
  }
}

function oneWord(value: unknown): value is string {
  return typeof value === 'string' && ONE_WORD.test(value)
}

// The host opens its record with comment lines, which JSON does not take.
function recordIn(file: string): { installedPlugins?: unknown } {
  try {
    const written = withoutBom(readFileSync(file, 'utf8')).split('\n').filter(line => !line.trimStart().startsWith('//')).join('\n')
    const record = JSON.parse(written) as unknown
    return record && typeof record === 'object' ? record : {}
  } catch {
    return {}
  }
}
