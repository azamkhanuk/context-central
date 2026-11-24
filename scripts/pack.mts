import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
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

const [given] = process.argv.slice(2)
const folder = given ? resolve(given) : null
if (folder === null) {
  console.error('pack: name an empty folder to write the package into')
  process.exitCode = 1
} else if (existsSync(folder) && readdirSync(folder).length > 0) {
  console.error(`pack: ${folder} is not empty, so nothing was written`)
  process.exitCode = 1
} else {
  console.log(pack(folder))
}
