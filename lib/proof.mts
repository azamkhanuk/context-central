import { arch, platform } from 'node:os'
import { join, relative, resolve, sep } from 'node:path'
import { isObject } from './checks.mts'
import { PluginError } from './errors.mts'
import { repoFolder } from './estate.mts'
import { glossaryPath } from './glossary.mts'
import { locked, readWhole, writeWhole } from './lock.mts'
import { onPath } from './machine.mts'
import { PROOF_FILE, folderAt, folderToSaveIn, hubPath, makeFolder } from './nodes.mts'
import { listResearches } from './research.mts'
import { CMD_LAUNCHER_FILE, LAUNCHER_ATTRIBUTES_FILE, LAUNCHER_FILE } from './templates.mts'
import { localDate } from './text.mts'
import { asked, holds, inTree } from './worktree.mts'
import type { Env } from './cli.mts'
import type { Estate, Repo } from './estate.mts'
import type { WorkItem } from './nodes.mts'

export interface Run {
  repo: string
  check: string
  exit: number
  commit: string
  branch: string | null
  dirty: boolean
  date: string
  system: string
}

export type Lack = 'no run' | 'uncommitted' | 'older' | 'red'

export interface Unproven {
  repo: string
  check: string
  lack: Lack
  exit: number | null
  branch: string | null
  more: number
}

type Answer = { status: number, stdout: string }
type Ask = ((folder: string, args: string[], input?: string) => Answer | null) & { unanswered: Set<string> }

const HEADS = 'refs/heads/'
const A_COMMIT_ID = /^[0-9a-f]{40,64}$/
const NOT_IN_A_BRANCH_NAME = /[\u0000-\u0020\u007f~^:?*[\\]|\.\.|@\{/
const COMPARED_AT_MOST = 20
const DESIGN_FILE = 'DESIGN.md'
const BUILT_AT = /\bBuilt at `?([0-9a-f]{7,64})\b/g
const A_COMMIT = /^([0-9a-f]+) commit \d+$/gm
const GIT_MS = 5000
const SAME = 0
const WORDS: Record<Lack, (lack: Unproven) => string> = {
  'no run': ({ check }) => `no run of "${check}" is recorded`,
  uncommitted: ({ check }) => `"${check}" last ran on changes that were not committed`,
  older: ({ check, branch }) => `"${check}" last ran on code older than the head of ${branch}`,
  red: ({ check, exit, branch }) => `"${check}" exited ${exit} at the head of ${branch}`,
}
const ROW_WORDS: Record<Lack, string> = { 'no run': 'no run recorded', uncommitted: 'run on uncommitted changes', older: 'older than the head', red: 'a check is red at the head' }
const judged = new Map<string, Unproven[]>()
const gaveNoAnswer = new Set<string>()

export function recordRun(estate: Estate, item: WorkItem, repo: Repo, check: string, exit: number, env: Env): Run {
  const dirRel = folderToSaveIn(estate, item)
  const folder = repoFolder(estate, repo)
  const head = headOf(folder, env)
  const changed = head && asked(folder, ['status', '--porcelain', '--untracked-files=normal', '--', '.', ...mapsOwnFiles(estate, folder)], env)
  if (!head || !changed || changed.status !== 0) throw new PluginError(`git gave no answer in ${folder}, so nothing was recorded`)
  const run: Run = { repo: repo.name, check, exit, ...head, dirty: changed.stdout !== '', date: localDate(env).day, system: `${platform()} ${arch()}` }
  locked(estate.mapDir, () => {
    const path = join(makeFolder(estate.mapDir, dirRel), PROOF_FILE)
    const held = readWhole(path) ?? ''
    writeWhole(path, `${held}${held === '' || held.endsWith('\n') ? '' : '\n'}${JSON.stringify(run)}\n`)
  })
  return run
}

export function unproven(estate: Estate, item: WorkItem, env: Env, until = Infinity): Unproven[] {
  const key = `${estate.mapDir}\n${item.id}`
  const known = judged.get(key)
  if (known) return known
  const repos = estate.config.repos.filter(repo => (repo.checks ?? []).length > 0)
  if (repos.length === 0 || !onPath('git', env)) return []
  const runs = runsOf(estate, item)
  const built = builtCommits(estate, item)
  if (runs.length === 0 && built.length === 0) return []
  const ask = asking(env, until)
  const lacks = repos.flatMap(repo => lackIn(estate, repo, runs.filter(run => run.repo === repo.name), built, ask))
  if (performance.now() >= until) return []
  judged.set(key, lacks)
  return lacks
}

export function saidOf(item: WorkItem, lacks: Unproven[]) {
  return `${item.id} ${lacks.map(lack => `in ${lack.repo}: ${WORDS[lack.lack](lack)}${andMore(lack.more)}`).join('; ')}`
}

export function rowWords(lacks: Unproven[]) {
  return lacks.length > 0 ? ROW_WORDS[lacks[0].lack] : null
}

function andMore(more: number) {
  if (more === 0) return ''
  return more === 1 ? ', and 1 more check lacks proof' : `, and ${more} more checks lack proof`
}

function lackIn(estate: Estate, repo: Repo, runs: Run[], built: string[], ask: Ask): Unproven[] {
  const folder = repoFolder(estate, repo)
  if (!folderAt(folder)) return []
  const lacks = lacksOf(estate, repo, folder, runs, built, ask)
  return ask.unanswered.has(folder) ? [] : lacks
}

function lacksOf(estate: Estate, repo: Repo, folder: string, runs: Run[], built: string[], ask: Ask): Unproven[] {
  const checks = [...new Set(repo.checks ?? [])]
  if (runs.length === 0) return builtIn(estate, folder, built, ask) ? [{ repo: repo.name, check: checks[0], lack: 'no run', exit: null, branch: null, more: checks.length - 1 }] : []
  const { branch } = runs[runs.length - 1]
  const head = branch === null ? null : ask(folder, ['show-ref', '--verify', '--hash', `${HEADS}${branch}`])?.stdout.trim()
  if (!head) return []
  const same = new Map<string, boolean>([[head, true]])
  const sameCode = (commit: string) => same.get(commit) ?? (same.set(commit, ask(folder, ['diff', '--quiet', commit, head, '--', '.', ...mapsOwnFiles(estate, folder)])?.status === SAME), same.get(commit)!)
  const lacking = checks.flatMap(check => lackOf(check, runs.filter(run => run.check === check), sameCode))
  return lacking.length === 0 ? [] : [{ repo: repo.name, ...lacking[0], branch, more: lacking.length - 1 }]
}

function lackOf(check: string, runs: Run[], sameCode: (commit: string) => boolean): Pick<Unproven, 'check' | 'lack' | 'exit'>[] {
  if (runs.length === 0) return [{ check, lack: 'no run', exit: null }]
  const clean = runs.filter(run => !run.dirty)
  const compared = [...new Set(clean.map(run => run.commit).reverse())].slice(0, COMPARED_AT_MOST)
  const atHead = clean.findLast(run => compared.includes(run.commit) && sameCode(run.commit))
  if (atHead) return atHead.exit === 0 ? [] : [{ check, lack: 'red', exit: atHead.exit }]
  return [{ check, lack: runs[runs.length - 1].dirty ? 'uncommitted' : 'older', exit: null }]
}

function builtIn(estate: Estate, folder: string, commits: string[], ask: Ask) {
  if (commits.length === 0) return false
  const held = [...(ask(folder, ['cat-file', '--batch-check'], commits.map(commit => `${commit}^{commit}\n`).join(''))?.stdout ?? '').matchAll(A_COMMIT)].map(([, id]) => id)
  if (held.length === 0) return false
  const edge = edgeOfAShallowClone(folder, ask)
  const compared = held.filter(id => !edge.includes(id))
  if (compared.length === 0) return false
  return (ask(folder, ['rev-list', '--no-walk', '--first-parent', ...compared, '--', '.', ...mapsOwnFiles(estate, folder)])?.stdout ?? '').trim() !== ''
}

function edgeOfAShallowClone(folder: string, ask: Ask) {
  const listedIn = ask(folder, ['rev-parse', '--git-path', 'shallow'])?.stdout.trim()
  return listedIn ? linesOf(resolve(folder, listedIn)) : []
}

function asking(env: Env, until: number): Ask {
  const unanswered = new Set<string>()
  const ask = (folder: string, args: string[], input?: string) => {
    const left = Math.floor(Math.min(GIT_MS, until - performance.now()))
    const answer = left < 1 || unanswered.has(folder) || gaveNoAnswer.has(folder) ? null : answerOf(folder, args, env, left, input)
    if (!answer) unanswered.add(folder)
    return answer
  }
  return Object.assign(ask, { unanswered })
}

function answerOf(folder: string, args: string[], env: Env, timeoutMs: number, input: string | undefined): Answer | null {
  try {
    const { status, stdout } = asked(folder, args, env, timeoutMs, input)
    if (status === null) gaveNoAnswer.add(folder)
    return status === null ? null : { status, stdout: stdout ?? '' }
  } catch {
    return null
  }
}

function runsOf(estate: Estate, item: WorkItem): Run[] {
  return linesOf(join(estate.mapDir, item.dirRel, PROOF_FILE)).flatMap(line => {
    const held = parsed(line)
    return isRun(held) ? [held] : []
  })
}

function builtCommits(estate: Estate, item: WorkItem) {
  const files = [...(item.entry?.kind === 'state' ? [item.entry.path] : []), join(estate.mapDir, item.dirRel, DESIGN_FILE)]
  return [...new Set(files.flatMap(file => [...linesOf(file).join('\n').matchAll(BUILT_AT)].map(([, commit]) => commit)))]
}

function linesOf(path: string) {
  try {
    return (readWhole(path) ?? '').split('\n')
  } catch {
    return []
  }
}

function parsed(line: string): unknown {
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}

function isRun(held: unknown): held is Run {
  if (!isObject(held)) return false
  const { repo, check, exit, commit, branch, dirty, date, system } = held
  const named = branch === null || (typeof branch === 'string' && branch !== '' && !NOT_IN_A_BRANCH_NAME.test(branch))
  return [repo, check, date, system].every(field => typeof field === 'string') && typeof commit === 'string' && A_COMMIT_ID.test(commit) && typeof exit === 'number' && named && typeof dirty === 'boolean'
}

function headOf(folder: string, env: Env) {
  const { status, stdout } = asked(folder, ['rev-parse', 'HEAD', '--symbolic-full-name', 'HEAD'], env)
  const [commit, ref] = (stdout ?? '').split('\n')
  return status === 0 && commit && ref ? { commit, branch: ref.startsWith(HEADS) ? ref.slice(HEADS.length) : null } : null
}

function mapsOwnFiles(estate: Estate, folder: string) {
  const { layout, mapDir, configPath, config, workTree } = estate
  const folders = () => [...config.nodeDirs, config.workDir, ...listResearches(estate).map(research => research.dirRel)]
  const own = layout === 'inner' ? [mapDir] : [...[...folders(), LAUNCHER_FILE, CMD_LAUNCHER_FILE, LAUNCHER_ATTRIBUTES_FILE].map(rel => join(mapDir, rel)), configPath, glossaryPath(estate)]
  return [...own, hubPath(estate)]
    .map(path => (workTree ? inTree(workTree, path) : path))
    .filter(path => holds(folder, path) && relative(folder, path) !== '')
    .map(path => `:(exclude)${relative(folder, path).split(sep).join('/')}`)
}
