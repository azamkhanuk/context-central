import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { PluginError, UsageError } from '../errors.mts'
import { CONFIG_FILE, CONFIG_MARKER, INNER_DIR, findEstate, validateConfig } from '../estate.mts'
import { locked, readWhole, standsAt, writeWhole } from '../lock.mts'
import { manifestPath } from '../manifest.mts'
import { evidenceIgnoreRule, gitattributesTemplate, gitignoreTemplate, glossaryTemplate, hubTemplate, mapBlock, BLOCK_START, settingsTemplate } from '../templates.mts'
import { withoutBom } from '../text.mts'
import { checkoutAround, checkoutsUnder } from '../worktree.mts'
import type { Env, Io } from '../cli.mts'
import type { Layout, Settings } from '../estate.mts'
import type { InMap } from '../templates.mts'

interface Answers {
  layout: Layout
  git?: unknown
  config: Record<string, unknown>
}

interface Step {
  rel: string
  content?: string
  append?: string
  lines?: string[]
}

interface Plan {
  dir: string
  answers: Answers
  first: Step[]
}

export const summary = 'Write a new map from an answers file, or a plain one with --plain; or print the settings that enable the plugin'

const LAYOUTS: Layout[] = ['root', 'inner']
const OWN_HUB = 'CLAUDE.local.md'
const KEPT_OUT_OF_GIT = [`${INNER_DIR}/`, OWN_HUB]

export function run(args: string[], io: Io) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { from: { type: 'string' }, plain: { type: 'boolean' }, 'dry-run': { type: 'boolean' }, 'print-settings': { type: 'boolean' } },
  })
  if (values['print-settings']) return void io.out(JSON.stringify(settingsTemplate(pluginRepo(io.env)), null, 2))
  if (Boolean(values.plain) === Boolean(values.from)) throw new UsageError('expected --from <answers.json> or --plain, one and not both, or --print-settings')
  const given = resolve(io.cwd, positionals[0] ?? '.')
  const { dir, answers, first } = values.from ? { dir: given, answers: readAnswers(resolve(io.cwd, values.from)), first: [] } : plain(given, io.env)
  const planned = [...first, ...steps(dir, answers)]
  const done: string[] = values.plain ? [`plain map at ${dir}:`] : []
  const carryAll = (dryRun: boolean) => planned.forEach(step => done.push(carryOut(dir, step, dryRun)))
  try {
    if (values['dry-run']) carryAll(true)
    else locked(madeFolder(answers.layout === 'inner' ? join(dir, INNER_DIR) : dir), () => carryAll(false))
  } finally {
    for (const line of done) io.out(line)
  }
}

function madeFolder(path: string) {
  mkdirSync(path, { recursive: true })
  return path
}

function plain(given: string, env: Env): Plan {
  const around = checkoutAround(given)
  if (around && !around.main) throw new PluginError(`${join(around.root, '.git')} is a file that names no work tree, so a plain map there could not be kept out of git; set the map up with /context-central:onboard`)
  const dir = around?.main ?? given
  const name = basename(dir)
  const ours = around ? join(dir, INNER_DIR, CONFIG_FILE) : join(dir, CONFIG_FILE)
  const found = findEstate(given, env)
  if (found && found.configPath !== ours) throw new PluginError(`a map already covers this folder: ${found.configPath}`)
  if (!around) return { dir, answers: { layout: 'root', config: { name, repos: checkoutsUnder(dir) } }, first: [] }
  const keptOut = { rel: '.git/info/exclude', content: KEPT_OUT_OF_GIT.map(line => `${line}\n`).join(''), lines: KEPT_OUT_OF_GIT }
  return { dir, answers: { layout: 'inner', config: { name, hub: OWN_HUB, repos: [{ name, path: '.' }] } }, first: found ? [] : [keptOut] }
}

function readAnswers(path: string) {
  const answers = readJson(path, 'answers file') as Answers
  if (!isObject(answers)) throw new PluginError('answers file: expected an object with "layout" and "config"')
  if (!LAYOUTS.includes(answers.layout)) throw new PluginError('answers file: "layout" must be "root" or "inner"')
  if (!isObject(answers.config)) throw new PluginError('answers file: "config" must be an object holding the estate.json content')
  if (typeof answers.config.name !== 'string' || !answers.config.name) throw new PluginError('answers file: "config" needs a "name"')
  return answers
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readJson(path: string, what: string): unknown {
  try {
    return JSON.parse(withoutBom(readFileSync(path, 'utf8')))
  } catch (error) {
    throw new PluginError(`${what} ${path} cannot be read as JSON (${(error as Error).message})`)
  }
}

function steps(dir: string, { layout, git, config: answered }: Answers): Step[] {
  const inMap: InMap = rel => (layout === 'inner' ? `${INNER_DIR}/${rel}` : rel)
  const configRel = inMap(CONFIG_FILE)
  const written = Object.assign({ contextCentral: 1 }, answered, { contextCentral: 1 })
  const config = existingConfig(dir, configRel) ?? validateConfig(written, 'answers file: "config"')
  return [
    { rel: configRel, content: `${JSON.stringify(written, null, 2)}\n` },
    ...config.nodeDirs.map(nodeDir => ({ rel: `${inMap(nodeDir)}/` })),
    { rel: config.hub, content: hubTemplate(config, inMap), append: mapBlock(config, inMap) },
    ...(config.glossary ? [] : [{ rel: inMap('glossary.md'), content: glossaryTemplate() }]),
    ...(git ? (layout === 'root' ? gitSteps(config) : innerGitSteps(config, inMap)) : []),
  ]
}

function existingConfig(dir: string, configRel: string) {
  const path = join(dir, configRel)
  if (!existsSync(path)) return null
  if (!readFileSync(path, 'utf8').includes(CONFIG_MARKER)) throw new PluginError(`${configRel} exists and is not a context-central config`)
  return validateConfig(readJson(path, 'config'), configRel)
}

function gitSteps(config: Settings): Step[] {
  return [
    { rel: '.gitignore', content: gitignoreTemplate(config) },
    { rel: '.gitattributes', content: gitattributesTemplate() },
  ]
}

function innerGitSteps(config: Settings, inMap: InMap): Step[] {
  return config.evidence.commit ? [] : [{ rel: inMap('.gitignore'), content: `${evidenceIgnoreRule(config.workDir)}\n` }]
}

function carryOut(dir: string, step: Step, dryRun: boolean) {
  const path = join(dir, step.rel)
  const there = standsAt(path)
  const lacks = there ? lacking(path, step) : null
  const action = !there ? 'create' : lacks === null ? 'keep' : 'update'
  if (action === 'keep') return `kept ${step.rel}`
  if (dryRun) return `would ${action} ${step.rel}`
  if (lacks !== null) addTo(path, lacks)
  else if (step.content === undefined) mkdirSync(path, { recursive: true })
  else writeNew(path, step.content)
  return `${action}d ${step.rel}`
}

function lacking(path: string, { append, lines }: Step) {
  if (!append && !lines) return null
  const text = readFileSync(path, 'utf8')
  if (lines) return lines.filter(line => !text.split(/\r?\n/).includes(line)).map(line => `${line}\n`).join('') || null
  return append && !text.includes(BLOCK_START) ? append : null
}

function addTo(path: string, block: string) {
  const text = readWhole(path) ?? ''
  writeWhole(path, `${text}${separator(text)}${block}`)
}

function separator(text: string) {
  if (text === '' || text.endsWith('\n\n')) return ''
  return text.endsWith('\n') ? '\n' : '\n\n'
}

function writeNew(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true })
  writeWhole(path, content)
}

function pluginRepo(env: Env) {
  const manifest = manifestPath(env)
  if (!existsSync(manifest)) throw new PluginError(`${manifest} is missing, so the marketplace repository is not known`)
  const { repository } = readJson(manifest, 'plugin manifest') as { repository?: string | { url?: string } }
  const url = typeof repository === 'string' ? repository : repository?.url
  const match = /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(url ?? '')
  if (!match) throw new PluginError(`${manifest}: "repository" is not a GitHub address`)
  return `${match[1]}/${match[2]}`
}
