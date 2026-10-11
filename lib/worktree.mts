import { readFileSync, statSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

export interface WorkTree {
  root: string
  main: string
}

const GIT = '.git'
const GITDIR = /^gitdir:\s*(.+?)\s*$/m

export function linkedWorkTree(dir: string): WorkTree | null {
  const root = linkedRoot(resolve(dir))
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

export function holds(folder: string, path: string) {
  const within = relative(folder, resolve(path))
  return within !== '..' && !within.startsWith(`..${sep}`) && !isAbsolute(within)
}

function moved(from: string, to: string, path: string) {
  return holds(from, path) ? join(to, relative(from, resolve(path))) : path
}

function linkedRoot(start: string) {
  for (let dir = start; ; dir = dirname(dir)) {
    const entry = entryAt(join(dir, GIT))
    if (entry) return entry.isFile() ? dir : null
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
  return ownGit ? resolve(root, relative(dirname(resolve(admin, ownGit)), main)) : main
}

function entryAt(path: string) {
  try {
    return statSync(path, { throwIfNoEntry: false })
  } catch {
    return undefined
  }
}

function read(path: string) {
  try {
    return readFileSync(path, 'utf8').trim() || null
  } catch {
    return null
  }
}
