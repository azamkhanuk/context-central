import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { parseArgs } from 'node:util'
import { PluginError } from '../errors.mts'
import { coverage, loadEstate } from '../estate.mts'
import { buildIndex } from '../index-text.mts'
import { describeFile, expandImports } from '../instructions.mts'
import { claudeConfigDir } from '../machine.mts'
import { formatBytes, parseFrontmatter, plural } from '../text.mts'
import type { Env, Io } from '../cli.mts'

interface Loaded {
  path: string
  source: string
  importedBy?: string
}

interface Measured extends Loaded {
  bytes: number
  lines: number
  over: boolean
}

type Report = ReturnType<typeof measure>

export const summary = 'Show what a session started in a folder loads at launch from instruction files'

const CLAUDE_FILES = ['CLAUDE.md', join('.claude', 'CLAUDE.md'), 'CLAUDE.local.md']
const FALLBACK_FILES = ['AGENTS.md']
const DEFAULT_LINE_LIMIT = 200

export function run(args: string[], io: Io) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { json: { type: 'boolean' } } })
  const dir = resolve(io.cwd, positionals[0] ?? '.')
  if (!isFolder(dir)) throw new PluginError(`${dir} is not a folder`)
  const report = measure(dir, io.env)
  io.out(values.json ? JSON.stringify(report, null, 2) : describe(report, io.env.HOME ?? homedir()).join('\n'))
}

function measure(dir: string, env: Env) {
  const configDir = claudeConfigDir(env)
  const estate = coveringEstate(dir)
  const lineLimit = estate?.config.budgets.hubLines ?? DEFAULT_LINE_LIMIT
  const userRules = rules(join(configDir, 'rules'))
  const projectRules = rules(join(dir, '.claude', 'rules'))
  const files = oncePerPath([
    ...withImports(present([join(configDir, 'CLAUDE.md')]), 'user', env),
    ...userRules.atLaunch.map(path => ({ path, source: 'user rule' })),
    ...withImports(ancestorFiles(dir), 'ancestor', env),
    ...projectRules.atLaunch.map(path => ({ path, source: 'project rule' })),
  ]).map(file => sized(file, lineLimit))
  const bytes = files.reduce((sum, file) => sum + file.bytes, 0)
  return {
    dir,
    files,
    lineLimit,
    total: { bytes, files: files.length, tokens: { low: nearestHundred(bytes / 4), high: nearestHundred(bytes / 2.7) } },
    notLoaded: { pathScopedRules: userRules.scoped + projectRules.scoped },
    plugin: estate ? { indexChars: buildIndex(estate, { absolute: true, startDir: dir }).length } : null,
  }
}

function sized({ path, ...rest }: Loaded, lineLimit: number): Measured {
  const { bytes, lines } = describeFile(path)
  return { path, bytes, lines, ...rest, over: lines > lineLimit }
}

function coveringEstate(dir: string) {
  const estate = loadEstate(dir)
  return estate && coverage(estate, dir) ? estate : null
}

function ancestorFiles(dir: string) {
  const folders = ancestors(dir)
  const found = present(folders.flatMap(folder => CLAUDE_FILES.map(name => join(folder, name))))
  return found.length > 0 ? found : present(folders.flatMap(folder => FALLBACK_FILES.map(name => join(folder, name))))
}

function ancestors(dir: string): string[] {
  const parent = dirname(dir)
  return parent === dir ? [dir] : [...ancestors(parent), dir]
}

function present(paths: string[]) {
  return paths.filter(isFile)
}

function withImports(paths: string[], source: string, env: Env): Loaded[] {
  return paths.flatMap(path => [{ path, source }, ...expandImports(path, env).map(found => ({ path: found.path, source: 'import', importedBy: found.importedBy }))])
}

function oncePerPath(files: Loaded[]) {
  const seen = new Set<string>()
  return files.filter(file => !seen.has(file.path) && seen.add(file.path))
}

function rules(dir: string) {
  const paths = isFolder(dir) ? markdownUnder(dir) : []
  const scoped = paths.filter(path => 'paths' in parseFrontmatter(readFileSync(path, 'utf8')).data)
  return { atLaunch: paths.filter(path => !scoped.includes(path)), scoped: scoped.length }
}

function markdownUnder(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap(name => {
      const path = join(dir, name)
      if (isFolder(path)) return markdownUnder(path)
      return isFile(path) && name.endsWith('.md') ? [path] : []
    })
}

function isFolder(path: string) {
  return existsSync(path) && statSync(path).isDirectory()
}

function isFile(path: string) {
  return existsSync(path) && statSync(path).isFile()
}

function nearestHundred(number: number) {
  return Math.round(number / 100) * 100
}

function describe(report: Report, home: string) {
  const shown = (path: string) => withTilde(path, home)
  const lines = [`Loaded at launch for a session started in ${shown(report.dir)}:`, ...report.files.map(file => describeLine(file, report.lineLimit, shown))]
  const { bytes, files, tokens } = report.total
  lines.push(`Total: ${formatBytes(bytes)} in ${plural(files, 'file')}, about ${grouped(tokens.low)} to ${grouped(tokens.high)} tokens`)
  if (report.notLoaded.pathScopedRules > 0) lines.push(`Not loaded until used: ${plural(report.notLoaded.pathScopedRules, 'path-scoped rule')}`)
  if (report.plugin) lines.push(`Plugin hooks add: index ${grouped(report.plugin.indexChars)} characters at session start`)
  return lines
}

function describeLine(file: Measured, lineLimit: number, shown: (path: string) => string) {
  const source = file.importedBy ? `import of ${shown(file.importedBy)}` : file.source
  const over = file.over ? ` over ${lineLimit} lines` : ''
  return `${formatBytes(file.bytes).padStart(9)}${String(file.lines).padStart(5)} ${file.lines === 1 ? 'line' : 'lines'}  ${shown(file.path)} (${source})${over}`
}

function withTilde(path: string, home: string) {
  if (path === home) return '~'
  return path.startsWith(home + sep) ? `~${path.slice(home.length)}` : path
}

function grouped(number: number) {
  return number.toLocaleString('en-GB')
}
