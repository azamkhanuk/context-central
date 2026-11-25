import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { Env } from './cli.mts'

export interface WorkTree {
  root: string
  main: string
}

const GIT = '.git'
const GITDIR = /^gitdir:\s*(.+?)\s*$/m
const GIT_TIMEOUT_MS = 5000
const GIT_ANSWER_BYTES = 256 * 1024 * 1024
const NOT_SO = 1
const PATHSPEC_SETTINGS = ['GIT_LITERAL_PATHSPECS', 'GIT_GLOB_PATHSPECS', 'GIT_NOGLOB_PATHSPECS', 'GIT_ICASE_PATHSPECS']

export function linkedWorkTree(dir: string): WorkTree | null {
  const above = checkoutAbove(resolve(dir))
  const root = above?.linked ? above.dir : null
  const admin = root && adminFolder(root)
  const shared = admin && read(join(admin, 'commondir'))
  if (!root || !admin || !shared) return null
  const common = resolve(admin, shared)
  return basename(common) === GIT ? { root, main: spelledFrom(root, admin, dirname(common)) } : null
}

export function inMain(tree: WorkTree, path: string) {
  return moved(tree.root, tree.main, path)
}

export function inTree(tree: WorkTree, path: string) {
  return holds(tree.root, path) ? path : moved(tree.main, tree.root, path)
}

export function mainCheckoutOf(dir: string) {
  return checkoutAround(dir)?.main ?? null
}

export function checkoutAround(dir: string): { root: string; main: string | null } | null {
  const above = checkoutAbove(resolve(dir))
  return above && { root: above.dir, main: above.linked ? (linkedWorkTree(above.dir)?.main ?? null) : above.dir }
}

export function checkoutsUnder(dir: string) {
  return namesIn(dir)
    .filter(name => entryAt(join(dir, name))?.isDirectory() && entryAt(join(dir, name, GIT)) && !linkedWorkTree(join(dir, name)))
    .sort()
}

export function workTreesOf(main: string) {
  const admins = join(main, GIT, 'worktrees')
  return namesIn(admins)
    .flatMap(name => {
      const ownGit = read(join(admins, name, 'gitdir'))
      const asGitSpellsIt = ownGit && linkedWorkTree(dirname(resolve(admins, name, ownGit)))
      const root = asGitSpellsIt && resolve(main, relative(asGitSpellsIt.main, asGitSpellsIt.root))
      return root && entryAt(root)?.isDirectory() ? [root] : []
    })
    .sort()
}

export function gitTracks(dir: string, path: string, env: Env) {
  const { status } = asked(dir, ['ls-files', '--error-unmatch', '--', asGitTakesIt(dir, path)], env)
  return status === 0 ? true : status === NOT_SO ? false : null
}

export function trackedUnder(dir: string, folder: string, env: Env) {
  const within = `${asGitTakesIt(dir, folder)}/`
  const { status, stdout } = asked(dir, ['ls-files', '-z', '--', within], env)
  return status === 0 ? stdout.split('\0').filter(path => path.startsWith(within)).map(path => path.slice(within.length)) : null
}

export function trackedThere(path: string, env: Env) {
  const above = checkoutAbove(dirname(path))
  if (!above) return { root: null, tracked: false }
  const asWritten = withoutPathspecSettings(env)
  const blind = foldsCase(above.dir) || asked(above.dir, ['config', '--bool', 'core.ignorecase'], asWritten).stdout?.trim() === 'true'
  const name = asGitTakesIt(above.dir, path)
  const { status, stdout } = asked(above.dir, ['ls-files', '-z', '--', `:(literal${blind ? ',icase' : ''})${name}`], asWritten)
  return { root: above.dir, tracked: status === 0 ? stdout !== '' : null }
}

export function foldsCase(dir: string) {
  const own = idOf(join(dir, GIT))
  return own !== null && own === idOf(join(dir, GIT.toUpperCase()))
}

export function inGitsOwnFolder(dir: string, env: Env) {
  return asked(dir, ['rev-parse', '--is-inside-git-dir'], env).stdout?.trim() === 'true'
}

export function gitIgnores(dir: string, path: string, env: Env) {
  return asked(dir, ['check-ignore', '-q', '--', asGitTakesIt(dir, path)], env).status === 0
}

export function holds(folder: string, path: string) {
  const within = relative(folder, resolve(path))
  return within !== '..' && !within.startsWith(`..${sep}`) && !isAbsolute(within)
}

function moved(from: string, to: string, path: string) {
  return holds(from, path) ? join(to, relative(from, resolve(path))) : path
}

function asGitTakesIt(dir: string, path: string) {
  return relative(dir, path).split(sep).join('/')
}

export function asked(dir: string, args: string[], env: Env, timeoutMs = GIT_TIMEOUT_MS, input?: string) {
  return spawnSync('git', args, { cwd: dir, env, encoding: 'utf8', timeout: timeoutMs, maxBuffer: GIT_ANSWER_BYTES, input })
}

export function askedBytes(dir: string, args: string[], env: Env, input: string, timeoutMs = GIT_TIMEOUT_MS) {
  return spawnSync('git', args, { cwd: dir, env, timeout: timeoutMs, maxBuffer: GIT_ANSWER_BYTES, input })
}

function checkoutAbove(start: string) {
  for (let dir = start; ; dir = dirname(dir)) {
    const entry = entryAt(join(dir, GIT))
    if (entry) return { dir, linked: entry.isFile() }
    if (dirname(dir) === dir) return null
  }
}

function adminFolder(root: string) {
  const named = GITDIR.exec(read(join(root, GIT)) ?? '')?.[1]
  return named ? resolve(root, named) : null
}

// Git may spell a folder another way than the session does, so the main checkout is placed by the way from the work tree to it.
function spelledFrom(root: string, admin: string, main: string) {
  const ownGit = read(join(admin, 'gitdir'))
  const placed = ownGit && resolve(root, relative(dirname(resolve(admin, ownGit)), main))
  return placed && entryAt(join(placed, GIT))?.isDirectory() ? placed : main
}

// Each of these, set in the environment, makes git read a pathspec other than as the plugin writes it.
function withoutPathspecSettings(env: Env): Env {
  return Object.fromEntries(Object.entries(env).filter(([key]) => !PATHSPEC_SETTINGS.includes(key)))
}

function idOf(path: string) {
  try {
    const entry = statSync(path, { bigint: true, throwIfNoEntry: false })
    return entry ? `${entry.dev}:${entry.ino}` : null
  } catch {
    return null
  }
}

function entryAt(path: string) {
  try {
    return statSync(path, { throwIfNoEntry: false })
  } catch {
    return undefined
  }
}

function namesIn(dir: string) {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

function read(path: string) {
  try {
    return readFileSync(path, 'utf8').trim() || null
  } catch {
    return null
  }
}
