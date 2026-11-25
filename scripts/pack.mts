import { accessSync, constants, cpSync, lstatSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const AS_THEY_ARE = [join('bin', 'context-central'), join('.claude-plugin', 'plugin.json'), 'README.md', 'LICENSE']
const IMPORT_OF_A_MTS = /(\b(?:from|import)\s*\(?\s*)(['"])(\.\.?\/[^'"\n]*)\.mts\2/g

const readJson = (rel: string) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as Record<string, unknown>
const filesUnder = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry => (entry.isDirectory() ? filesUnder(join(dir, entry.name)) : [join(dir, entry.name)]))

function written(path: string, text: string) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
}

function packageOf() {
  const { name, version } = readJson(join('.claude-plugin', 'plugin.json'))
  const { description, license, engines, bin } = readJson('package.json')
  return { name, version, description, license, private: true, engines, bin }
}

function pack(folder: string) {
  const tree = join(folder, 'package')
  for (const file of filesUnder(join(ROOT, 'lib'))) {
    const javascript = stripTypeScriptTypes(readFileSync(file, 'utf8')).replace(IMPORT_OF_A_MTS, '$1$2$3.mjs$2')
    written(join(tree, relative(ROOT, file).replace(/\.mts$/, '.mjs')), javascript)
  }
  for (const rel of AS_THEY_ARE) cpSync(join(ROOT, rel), join(tree, rel))
  written(join(tree, 'package.json'), `${JSON.stringify(packageOf(), null, 2)}\n`)
  return tree
}

const FAULTS: Record<string, string> = {
  ELOOP: 'lies below a link that leads round in a loop',
  ENAMETOOLONG: 'has a part longer than a disk holds',
  ENOTDIR: 'lies under a file',
  EACCES: 'lies in a folder this user may not open',
}

function looked(path: string, how: typeof statSync) {
  try {
    return how(path, { throwIfNoEntry: false })
  } catch (error) {
    const { code } = error as NodeJS.ErrnoException
    return FAULTS[code ?? ''] ?? `cannot be reached (${code})`
  }
}

function writable(path: string) {
  try {
    accessSync(path, constants.W_OK)
    return true
  } catch {
    return false
  }
}

function trouble(folder: string): string | null {
  const own = looked(folder, lstatSync)
  if (typeof own === 'string') return own
  if (own === undefined) return troubleAbove(dirname(folder))
  const followed = looked(folder, statSync)
  if (typeof followed === 'string') return followed
  if (followed === undefined) return 'is a link that leads nowhere'
  if (!followed.isDirectory()) return 'is a file'
  if (readdirSync(folder).length > 0) return 'is not empty'
  return writable(folder) ? null : 'is a folder this user may not write'
}

function troubleAbove(above: string): string | null {
  const own = looked(above, lstatSync)
  if (typeof own === 'string') return own
  if (own === undefined) return dirname(above) === above ? 'lies on no disk there is' : troubleAbove(dirname(above))
  const followed = looked(above, statSync)
  if (typeof followed === 'string') return followed
  if (followed === undefined) return 'lies below a link that leads nowhere'
  if (!followed.isDirectory()) return 'lies under a file'
  return writable(above) ? null : 'lies in a folder this user may not write'
}

function refusal(folder: string | null) {
  if (folder === null) return 'pack: name an empty folder to write the package into'
  const why = trouble(folder)
  return why === null ? null : `pack: ${folder} ${why}, so nothing was written`
}

const [given] = process.argv.slice(2)
const folder = given ? resolve(given) : null
const refused = refusal(folder)
if (refused !== null || folder === null) {
  console.error(refused)
  process.exitCode = 1
} else {
  console.log(pack(folder))
}
