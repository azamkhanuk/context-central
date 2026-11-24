import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { PluginError, UsageError } from '../errors.mts'
import { CONFIG_FILE, CONFIG_MARKER, INNER_DIR, estateAt, findEstate, validateConfig } from '../estate.mts'
import { locked, readThere, readWhole, standsAt, writeWhole } from '../lock.mts'
import { evidenceIgnoreRule, gitattributesTemplate, gitignoreTemplate, glossaryTemplate, hubTemplate, mapBlock, BLOCK_START, settingsTemplate } from '../templates.mts'
import { withoutBom } from '../text.mts'
import { checkoutAround, checkoutsUnder, holds, trackedThere } from '../worktree.mts'
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
const ROOT_HUB = 'CLAUDE.md'
const ANOTHER_HOSTS_HUB = 'AGENTS.md'
const CLAUDES_OWN = [ROOT_HUB, OWN_HUB, '.claude']
const GITS_OWN = '.git'
const KEPT_OUT = 'so a plain map there could not be kept out of git; set the map up with /context-central:onboard'

export function run(args: string[], io: Io) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { from: { type: 'string' }, plain: { type: 'boolean' }, hub: { type: 'string' }, 'dry-run': { type: 'boolean' }, 'print-settings': { type: 'boolean' } },
  })
  if (values['print-settings']) return void io.out(JSON.stringify(settingsTemplate(), null, 2))
  if (Boolean(values.plain) === Boolean(values.from)) throw new UsageError('expected --from <answers.json> or --plain, one and not both, or --print-settings')
  if (values.hub !== undefined && !values.plain) throw new UsageError('--hub names the hub of a plain map, so it goes with --plain')
  const given = resolve(io.cwd, positionals[0] ?? '.')
  const { dir, answers, first } = values.from ? { dir: given, answers: readAnswers(resolve(io.cwd, values.from)), first: [] } : plain(given, io.env, values.hub === undefined ? undefined : hubNamed(values.hub))
  const planned = [...first, ...steps(dir, answers)]
  refuseAHubTheMapLaysDown(planned, answers.layout)
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

function plain(given: string, env: Env, asked: string | undefined): Plan {
  const around = checkoutAround(given)
  if (around && !around.main) throw new PluginError(`${join(around.root, '.git')} is a file that names no work tree, so a plain map there could not be kept out of git; set the map up with /context-central:onboard`)
  const dir = around?.main ?? given
  const name = basename(dir)
  const ours = around ? join(dir, INNER_DIR, CONFIG_FILE) : join(dir, CONFIG_FILE)
  const found = findEstate(given, env)
  if (found && found.configPath !== ours) throw new PluginError(`a map already covers this folder: ${found.configPath}`)
  const held = found ? estateAt(found).config.hub : null
  if (held !== null && asked !== undefined && asked !== held) throw new PluginError(`this folder's map has its hub at ${held} already, and init --plain does not move it: --hub "${asked}" names another`)
  const hub = held ?? asked ?? hubFound(dir, around !== null)
  const landing = landingOf(dir, hub)
  if (!found) outOfGit(dir, landing, around !== null, env)
  if (!around) return { dir, answers: { layout: 'root', config: { name, ...(hub === ROOT_HUB ? {} : { hub }), repos: checkoutsUnder(dir), connections: {} } }, first: [] }
  const keptOutOfGit = [`${INNER_DIR}/`, ...(hub.toLowerCase().startsWith(`${INNER_DIR}/`) ? [] : [excludeLine(hub)])]
  const keptOut = { rel: '.git/info/exclude', content: keptOutOfGit.map(line => `${line}\n`).join(''), lines: keptOutOfGit }
  return { dir, answers: { layout: 'inner', config: { name, hub, repos: [{ name, path: '.' }], connections: {} } }, first: found ? [] : [keptOut] }
}

function hubNamed(asked: string) {
  const parts = asked.split('/')
  if (/^([/\\]|[A-Za-z]:)/.test(asked) || asked.includes('\\') || parts.some(part => part === '' || part === '.' || part === '..')) throw new UsageError(`--hub "${asked}": a hub is a file counted from the estate root, with forward slashes, and no part that is empty, "." or ".."`)
  if (parts.some(part => part.toLowerCase() === GITS_OWN)) throw new UsageError(`--hub "${asked}": a hub cannot lie in a folder named .git, which is git's own`)
  return asked
}

interface Landing {
  path: string
  landing: string
  spelled: string
}

function landingOf(dir: string, hub: string): Landing {
  const path = join(dir, hub)
  const landing = realPlace(path)
  if (landing === null) throw new PluginError(`${path} is a link that leads nowhere, so the hub cannot be written there`)
  if (!nearestThere(landing).isDirectory()) throw new PluginError(`${path} lies under a file, so the hub cannot be written there`)
  if (entryAt(landing)?.isDirectory()) throw new PluginError(`${path} is a folder, so the hub cannot be written there`)
  const home = realpathSync.native(dir)
  if (!holds(home, landing)) throw new PluginError(`${path} leads to ${landing}, outside ${dir}, so the hub cannot be written there`)
  return { path, landing, spelled: join(home, hub) }
}

function outOfGit(dir: string, { path, landing, spelled }: Landing, inCheckout: boolean, env: Env) {
  const { root, tracked } = trackedThere(landing, env)
  if (tracked === true) throw new PluginError(landing === spelled ? `${path} is tracked by git, ${KEPT_OUT}` : `${path} would be written as ${landing}, which git tracks, ${KEPT_OUT}`)
  if (root !== null && (!inCheckout || root !== realpathSync.native(dir))) throw new PluginError(`${path} lies in the checkout ${root}, where git would show it, ${KEPT_OUT}`)
}

function realPlace(path: string): string | null {
  if (existsSync(path)) return realpathSync.native(path)
  if (entryAt(path, true)) return null
  const above = dirname(path)
  if (above === path) return path
  const place = realPlace(above)
  return place === null ? null : join(place, basename(path))
}

function nearestThere(path: string): NonNullable<ReturnType<typeof entryAt>> {
  const above = dirname(path)
  return entryAt(above) ?? (above === path ? statSync(above) : nearestThere(above))
}

function entryAt(path: string, link = false) {
  try {
    return (link ? lstatSync : statSync)(path, { throwIfNoEntry: false })
  } catch {
    return undefined
  }
}

function excludeLine(hub: string) {
  return hub === OWN_HUB ? hub : `/${hub.replace(/[*?[]/g, char => `\\${char}`).replace(/ +$/, spaces => spaces.replace(/ /g, '\\ '))}`
}

function refuseAHubTheMapLaysDown(planned: Step[], layout: Layout) {
  const hub = planned.find(step => step.append !== undefined)?.rel
  const own = [...(layout === 'inner' ? [INNER_DIR] : []), ...planned.filter(step => step.append === undefined).map(step => step.rel.replace(/\/+$/, ''))]
  if (hub !== undefined && own.some(rel => rel.toLowerCase() === hub.toLowerCase())) throw new PluginError(`"${hub}" names a file or a folder that init lays down for the map itself, so it cannot be the hub`)
}

function hubFound(dir: string, inCheckout: boolean) {
  const anotherHostsAlone = Boolean(entryAt(join(dir, ANOTHER_HOSTS_HUB))?.isFile()) && !CLAUDES_OWN.some(name => existsSync(join(dir, name)))
  if (!anotherHostsAlone) return inCheckout ? OWN_HUB : ROOT_HUB
  return inCheckout ? `${INNER_DIR}/hub.md` : ANOTHER_HOSTS_HUB
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
  if (!readThere(path).includes(CONFIG_MARKER)) throw new PluginError(`${configRel} exists and is not a context-central config`)
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
  const text = readThere(path)
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
