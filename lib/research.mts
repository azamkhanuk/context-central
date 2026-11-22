import { existsSync, readFileSync, statSync } from 'node:fs'
import { join, posix, relative, resolve, sep } from 'node:path'
import { filesUnder, underNotNodes } from './nodes.mts'
import { firstHeading, parseFrontmatter } from './text.mts'
import { holds } from './worktree.mts'
import type { Estate } from './estate.mts'
import type { Node } from './nodes.mts'

export interface Research {
  name: string
  dirRel: string
  title: string
  item: string | null
  sheet: Node
  pages: Node[]
  files: Node[]
  sources: Node[]
}

export const SHEET_FILE = 'index.md'

const PAGE = /^facts-[a-z0-9-]+\.md$/

export function researchTaken({ estateRoot, mapDir, config }: Estate): string | null {
  const folder = join(mapDir, config.researchDir)
  if (statSync(folder, { throwIfNoEntry: false })?.isFile()) return 'is a file, not a folder'
  if (existsSync(join(folder, '.git'))) return 'holds a .git of its own'
  const repo = config.repos.find(candidate => {
    const root = resolve(estateRoot, candidate.path)
    return root !== mapDir && holds(mapDir, root) && holds(root, folder)
  })
  if (repo) return `is inside the repo ${repo.name}`
  if (underNotNodes(config, config.researchDir)) return 'is under a notNodes entry'
  const fromRoot = relative(estateRoot, folder).split(sep).join('/')
  const leftAlone = config.leftAlone.map(entry => entry.replace(/\/+$/, '')).some(entry => fromRoot === entry || fromRoot.startsWith(`${entry}/`))
  return leftAlone ? 'is under a leftAlone entry' : null
}

export function listResearches(estate: Estate): Research[] {
  if (researchTaken(estate)) return []
  const { researchDir } = estate.config
  const folders = new Map<string, Node[]>()
  for (const file of filesUnder(estate, researchDir)) {
    const [name] = file.rel.slice(researchDir.length + 1).split('/')
    folders.set(name, [...(folders.get(name) ?? []), file])
  }
  return [...folders].flatMap(([name, inFolder]) => researchIn(`${researchDir}/${name}`, name, inFolder))
}

export function findResearch(estate: Estate, name: string): Research | null {
  const all = listResearches(estate)
  return all.find(one => one.name === name) ?? all.find(one => one.name.toLowerCase() === name.toLowerCase()) ?? null
}

function researchIn(dirRel: string, name: string, inFolder: Node[]): Research[] {
  const sheet = inFolder.find(file => file.rel === `${dirRel}/${SHEET_FILE}`)
  const head = sheet && headOf(sheet.path)
  if (!sheet || !head || head.data.research === undefined) return []
  const files = inFolder.filter(file => !file.deep)
  const pages = files.filter(file => posix.dirname(file.rel) === dirRel && PAGE.test(posix.basename(file.rel)))
  return [{ name, dirRel, title: head.data.title ?? firstHeading(head.body) ?? name, item: head.data.item || null, sheet, pages, files, sources: inFolder.filter(file => file.deep) }]
}

function headOf(path: string) {
  try {
    return parseFrontmatter(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}
