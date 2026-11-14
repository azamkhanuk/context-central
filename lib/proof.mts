import { arch, platform } from 'node:os'
import { join, relative, sep } from 'node:path'
import { PluginError } from './errors.mts'
import { repoFolder } from './estate.mts'
import { glossaryPath } from './glossary.mts'
import { locked, readWhole, writeWhole } from './lock.mts'
import { PROOF_FILE, folderToSaveIn, hubPath, makeFolder } from './nodes.mts'
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

const DETACHED = 'HEAD'

export function recordRun(estate: Estate, item: WorkItem, repo: Repo, check: string, exit: number, env: Env): Run {
  const dirRel = folderToSaveIn(estate, item)
  const folder = repoFolder(estate, repo)
  const head = headOf(folder, env)
  const changed = head && asked(folder, ['status', '--porcelain', '--', '.', ...mapsOwnFiles(estate, folder)], env)
  if (!head || !changed || changed.status !== 0) throw new PluginError(`git gave no answer in ${folder}, so nothing was recorded`)
  const run: Run = { repo: repo.name, check, exit, ...head, dirty: changed.stdout !== '', date: localDate(env).day, system: `${platform()} ${arch()}` }
  locked(estate.mapDir, () => {
    const path = join(makeFolder(estate.mapDir, dirRel), PROOF_FILE)
    const held = readWhole(path) ?? ''
    writeWhole(path, `${held}${held === '' || held.endsWith('\n') ? '' : '\n'}${JSON.stringify(run)}\n`)
  })
  return run
}

function headOf(folder: string, env: Env) {
  const { status, stdout } = asked(folder, ['rev-parse', 'HEAD', '--abbrev-ref', 'HEAD'], env)
  const [commit, branch] = (stdout ?? '').split('\n')
  return status === 0 && commit && branch ? { commit, branch: branch === DETACHED ? null : branch } : null
}

function mapsOwnFiles(estate: Estate, folder: string) {
  const { layout, mapDir, configPath, config, workTree } = estate
  const own = layout === 'inner' ? [mapDir] : [...config.nodeDirs.map(dir => join(mapDir, dir)), configPath, glossaryPath(estate)]
  return [...own, hubPath(estate)]
    .map(path => (workTree ? inTree(workTree, path) : path))
    .filter(path => holds(folder, path) && relative(folder, path) !== '')
    .map(path => `:(exclude)${relative(folder, path).split(sep).join('/')}`)
}
