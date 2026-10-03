import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { parseArgs } from 'node:util'
import { PluginError } from '../errors.mjs'
import { coverage, loadEstate } from '../estate.mjs'
import { buildIndex } from '../index-text.mjs'
import { describeFile, expandImports } from '../instructions.mjs'
import { claudeConfigDir } from '../machine.mjs'
import { formatBytes, parseFrontmatter, plural } from '../text.mjs'

export const summary = 'Show what a session started in a folder loads at launch from instruction files'

const CLAUDE_FILES = ['CLAUDE.md', join('.claude', 'CLAUDE.md'), 'CLAUDE.local.md']
const FALLBACK_FILES = ['AGENTS.md']
const DEFAULT_LINE_LIMIT = 200

export function run(args, io) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { json: { type: 'boolean' } } })
  const dir = resolve(io.cwd, positionals[0] ?? '.')
  if (!isFolder(dir)) throw new PluginError(`${dir} is not a folder`)
  const report = measure(dir, io.env)
  io.out(values.json ? JSON.stringify(report, null, 2) : describe(report, io.env.HOME ?? homedir()).join('\n'))
}

function measure(dir, env) {
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
    plugin: estate ? { indexChars: buildIndex(estate, { absolute: true }).length } : null,
  }
}

function sized(file, lineLimit) {
  const { bytes, lines } = describeFile(file.path)
  return { path: file.path, bytes, lines, ...file, over: lines > lineLimit }
}

function coveringEstate(dir) {
  const estate = loadEstate(dir)
  return estate && coverage(estate, dir) ? estate : null
}

function ancestorFiles(dir) {
  const folders = ancestors(dir)
  const found = present(folders.flatMap(folder => CLAUDE_FILES.map(name => join(folder, name))))
  return found.length > 0 ? found : present(folders.flatMap(folder => FALLBACK_FILES.map(name => join(folder, name))))
}

function ancestors(dir) {
  const parent = dirname(dir)
  return parent === dir ? [dir] : [...ancestors(parent), dir]
}

function present(paths) {
  return paths.filter(isFile)
}

function withImports(paths, source, env) {
  return paths.flatMap(path => [{ path, source }, ...expandImports(path, env).map(found => ({ path: found.path, source: 'import', importedBy: found.importedBy }))])
}

function oncePerPath(files) {
  const seen = new Set()
  return files.filter(file => !seen.has(file.path) && seen.add(file.path))
}

function rules(dir) {
  const paths = isFolder(dir) ? markdownUnder(dir) : []
  const scoped = paths.filter(path => 'paths' in parseFrontmatter(readFileSync(path, 'utf8')).data)
  return { atLaunch: paths.filter(path => !scoped.includes(path)), scoped: scoped.length }
}

function markdownUnder(dir) {
  return readdirSync(dir)
    .sort()
    .flatMap(name => {
      const path = join(dir, name)
      if (isFolder(path)) return markdownUnder(path)
      return isFile(path) && name.endsWith('.md') ? [path] : []
    })
}

function isFolder(path) {
  return existsSync(path) && statSync(path).isDirectory()
}

function isFile(path) {
  return existsSync(path) && statSync(path).isFile()
}

function nearestHundred(number) {
  return Math.round(number / 100) * 100
}

function describe(report, home) {
  const shown = path => withTilde(path, home)
  const lines = [`Loaded at launch for a session started in ${shown(report.dir)}:`, ...report.files.map(file => describeLine(file, report.lineLimit, shown))]
  const { bytes, files, tokens } = report.total
  lines.push(`Total: ${formatBytes(bytes)} in ${plural(files, 'file')}, about ${grouped(tokens.low)} to ${grouped(tokens.high)} tokens`)
  if (report.notLoaded.pathScopedRules > 0) lines.push(`Not loaded until used: ${plural(report.notLoaded.pathScopedRules, 'path-scoped rule')}`)
  if (report.plugin) lines.push(`Plugin hooks add: index ${grouped(report.plugin.indexChars)} characters at session start`)
  return lines
}

function describeLine(file, lineLimit, shown) {
  const source = file.importedBy ? `import of ${shown(file.importedBy)}` : file.source
  const over = file.over ? ` over ${lineLimit} lines` : ''
  return `${formatBytes(file.bytes).padStart(9)}${String(file.lines).padStart(5)} ${file.lines === 1 ? 'line' : 'lines'}  ${shown(file.path)} (${source})${over}`
}

function withTilde(path, home) {
  if (path === home) return '~'
  return path.startsWith(home + sep) ? `~${path.slice(home.length)}` : path
}

function grouped(number) {
  return number.toLocaleString('en-GB')
}
