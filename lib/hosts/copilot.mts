import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { withoutBom } from '../text.mts'
import type { Env } from '../cli.mts'
import type { Step } from './claude-code.mts'

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
  setsForACommand: 'COPILOT_AGENT_SESSION_ID',
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

// A file is counted from its folder with forward slashes. A folder between the repository's root and the start folder gives its named files alone.
export function copilotLoadsAtAStart(fromFolder: string, file: string, between: boolean) {
  if (LOADS_AT_A_ROOT.includes(fromFolder)) return true
  return !between && (LOADS_UNDER.some(pattern => pattern.test(fromFolder)) || (SCOPED_AT_A_ROOT.some(pattern => pattern.test(fromFolder)) && appliesToEveryFile(file)))
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

export function copilotLoadsIn(dir: string, env: Env): CopilotLoads {
  const home = copilotHome(env)
  const root = repositoryRoot(dir)
  const folders = foldersToTheStart(dir)
  const where = (folder: string) => (folder === root ? 'repository' : 'folder')
  const own = everyFileOrScoped(markdownUnder(join(home, 'instructions'), '.instructions.md'))
  const inFolders = folders.map(folder => ({
    named: LOADS_AT_A_ROOT.map(name => ({ path: join(folder, ...name.split('/')), source: where(folder), bringsFilesIn: BRINGS_FILES_IN.includes(name) })).filter(file => isFile(file.path)),
    rules: folder === root || folder === dir ? markdownUnder(join(folder, ...RULES), '.md') : [],
    instructions: everyFileOrScoped(folder === root || folder === dir ? markdownUnder(join(folder, ...INSTRUCTIONS), '.instructions.md') : []),
    where: where(folder),
  }))
  const added = everyFileOrScoped(foldersAddedToCopilot(env).flatMap(folder => [...instructionsIn(folder), ...markdownUnder(join(folder, ...INSTRUCTIONS), '.instructions.md')]))
  const plain = (path: string, source: string) => ({ path, source, bringsFilesIn: false })
  return {
    files: [
      ...[join(home, 'copilot-instructions.md')].filter(isFile).map(path => plain(path, 'user')),
      ...own.everyFile.map(path => plain(path, 'user instructions')),
      ...inFolders.flatMap(found => [...found.named, ...found.rules.map(path => plain(path, `${found.where} rule`)), ...found.instructions.everyFile.map(path => plain(path, `${found.where} instructions`))]),
      ...added.everyFile.map(path => plain(path, 'added folder instructions')),
    ],
    scoped: own.scoped + added.scoped + inFolders.reduce((sum, found) => sum + found.instructions.scoped, 0),
  }
}

export function repositoryRoot(dir: string): string | null {
  if (existsSync(join(dir, '.git'))) return dir
  return dirname(dir) === dir ? null : repositoryRoot(dirname(dir))
}

export function foldersToTheStart(dir: string): string[] {
  const root = repositoryRoot(dir)
  return root === null ? [dir] : between(root, dir)
}

function between(root: string, dir: string): string[] {
  return dir === root || dirname(dir) === dir ? [dir] : [...between(root, dirname(dir)), dir]
}

function instructionsIn(folder: string) {
  if (!isFolder(folder)) return []
  return readdirSync(folder).sort().filter(name => name.endsWith('.instructions.md')).map(name => join(folder, name)).filter(isFile)
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

export const COPILOTS_STEPS: Step[] = [
  {
    heading: 'Servers this session holds',
    paragraphs: [
      "Run `copilot mcp list`, which prints the MCP servers Copilot is set up with, grouped by where each comes from. In this session's own tool list a server's tool is named `<server>-<tool>`, so a tool whose name starts with a server's name and a dash belongs to that server.",
    ],
  },
  {
    heading: 'The hub',
    paragraphs: [
      "Add `\"hub\"` to the draft's config, since the hub a config names none for is a file of another host. Where the map sits at an estate root or is kept in git, the hub is `.github/copilot-instructions.md`, the file Copilot's own `init` writes and loads at a session's start: where it is there already, `init` adds the map's block to it and changes nothing else in it. Where the map sits inside a repo and is kept out of git, the hub is `.context-central/hub.md`, which Copilot does not load, so the plugin's session-start hook gives its text. Where the estate already keeps its routing in `AGENTS.md`, name that file instead.",
    ],
  },
  {
    heading: 'Allowing a tool',
    paragraphs: [
      "Copilot keeps no file of rules for a person to write, so write none. Say the two ways it stops asking before one of the read tools just used runs. The first is to answer its prompt with \"Yes, and don't ask again\", which it saves for this repository in the person's own Copilot folder. The second is to start it with `--allow-tool`, once for each rule: a server's tool is written `<server>(<tool>)`, and a command `shell(<command>:*)`. For the plugin's own command the rule is `shell(context-central:*)` where the command is on the PATH, and where a skill runs it by its file, `shell(node:*)` with `--add-dir` and the plugin's folder.",
    ],
  },
  {
    heading: 'Settings',
    paragraphs: [
      'Run `context-central init --print-settings` and show the JSON, which names the marketplace and turns the plugin on. Ask where it goes: `.github/copilot/settings.json` (shared with everyone who uses the map) or `.github/copilot/settings.local.json` (this machine only, which git shows until the person has git leave it out). Either sits at the root of the repository sessions start in, or in the folder itself where that is no repository: the estate root or, for layout `inner`, the repo that holds `.context-central/`. Write it only on a yes, merging into the keys already in that file.',
      "Then say what decides whether the plugin loads. Copilot reads a repository's settings only once its folder has been trusted, and then installs a plugin they turn on where it is missing and turns it on in that repository alone: in a run with nobody there, `copilot -p`, in a folder nobody has trusted, nothing of the repository loads, and `--trust-folder` trusts it for that run. For layout `root`, a session started inside a repo is not given the plugin by the estate root's settings. Offer the two ways round: install it for the person, with `copilot plugin marketplace add azamkhanuk/claude-plugins` where `copilot plugin marketplace list` has no `azamkhanuk` yet and then `copilot plugin install context-central@azamkhanuk`, or put the same JSON in each registered repo as well, written as above and asking for each whether shared or for this machine only. A copy installed for the person loads in every folder. A release reaches a copy by itself only where the person's own settings, `~/.copilot/settings.json`, give the marketplace's entry `\"autoUpdate\": true`, and a repository's settings do not count for that: say so, and leave that file to the person. Without it `copilot plugin update context-central@azamkhanuk` fetches a release. A launcher finds the copy Copilot installed, and with none `CONTEXT_CENTRAL_CLI` names the plugin's `bin/context-central` file.",
    ],
  },
  {
    heading: "Settings a session at the map's root will not load",
    paragraphs: [
      "Layout `root` only. A session started at the estate root loads none of the repos' own settings. Read each registered repo's `.github/copilot/settings.json`, `.github/copilot/settings.local.json`, `.mcp.json` and `.github/mcp.json`, and list every setting and every MCP server name found, by repo. Offer to copy them up into the estate root's `.github/copilot/settings.json` and `.mcp.json`; copy only what the person picks.",
    ],
  },
]
