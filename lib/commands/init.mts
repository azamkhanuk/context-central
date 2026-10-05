import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { PluginError, UsageError } from '../errors.mts'
import { CONFIG_FILE, CONFIG_MARKER, INNER_DIR, validateConfig } from '../estate.mts'
import { evidenceIgnoreRule, gitattributesTemplate, gitignoreTemplate, glossaryTemplate, hubTemplate, mapBlock, BLOCK_START, settingsTemplate } from '../templates.mts'
import { withoutBom } from '../text.mts'
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
}

export const summary = 'Write a new map from an answers file, or print the settings that enable the plugin'

const LAYOUTS: Layout[] = ['root', 'inner']
const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

export function run(args: string[], io: Io) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { from: { type: 'string' }, 'dry-run': { type: 'boolean' }, 'print-settings': { type: 'boolean' } },
  })
  if (values['print-settings']) return void io.out(JSON.stringify(settingsTemplate(pluginRepo(io.env)), null, 2))
  if (!values.from) throw new UsageError('expected --from <answers.json>, or --print-settings')
  const dir = resolve(io.cwd, positionals[0] ?? '.')
  const answers = readAnswers(resolve(io.cwd, values.from))
  for (const step of steps(dir, answers)) io.out(carryOut(dir, step, values['dry-run']))
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
    { rel: inMap('glossary.md'), content: glossaryTemplate() },
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

function carryOut(dir: string, step: Step, dryRun: boolean | undefined) {
  const path = join(dir, step.rel)
  const action = actionFor(path, step)
  if (action === 'keep') return `kept ${step.rel}`
  if (dryRun) return `would ${action} ${step.rel}`
  if (action === 'update') appendFileSync(path, `${separator(path)}${step.append}`)
  else if (step.content === undefined) mkdirSync(path, { recursive: true })
  else writeNew(path, step.content)
  return `${action}d ${step.rel}`
}

function actionFor(path: string, step: Step) {
  if (!existsSync(path)) return 'create'
  return step.append && !readFileSync(path, 'utf8').includes(BLOCK_START) ? 'update' : 'keep'
}

function separator(path: string) {
  const text = readFileSync(path, 'utf8')
  if (text === '' || text.endsWith('\n\n')) return ''
  return text.endsWith('\n') ? '\n' : '\n\n'
}

function writeNew(path: string, content: string) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, { flag: 'wx' })
}

function pluginRepo(env: Env) {
  const manifest = join(env.CONTEXT_CENTRAL_PLUGIN_ROOT ?? PLUGIN_ROOT, '.claude-plugin', 'plugin.json')
  if (!existsSync(manifest)) throw new PluginError(`${manifest} is missing, so the marketplace repository is not known`)
  const { repository } = readJson(manifest, 'plugin manifest') as { repository?: string | { url?: string } }
  const url = typeof repository === 'string' ? repository : repository?.url
  const match = /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(url ?? '')
  if (!match) throw new PluginError(`${manifest}: "repository" is not a GitHub address`)
  return `${match[1]}/${match[2]}`
}
