import { existsSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { withoutCode } from './text.mts'

const MAX_HOPS = 4
const IMPORT = /(?:^|\s)@([~.\w][\w./~-]*)/g

export function describeFile(path) {
  const text = readFileSync(path, 'utf8')
  return { path, bytes: Buffer.byteLength(text), lines: countLines(text) }
}

export function expandImports(path, env) {
  const seen = new Set([resolve(path)])
  const found = []
  visit(resolve(path), 1)
  return found

  function visit(importer, hop) {
    if (hop > MAX_HOPS) return
    for (const target of importTargets(importer, env)) {
      if (seen.has(target)) continue
      seen.add(target)
      found.push({ ...describeFile(target), importedBy: importer })
      visit(target, hop + 1)
    }
  }
}

function importTargets(importer, env) {
  return [...withoutCode(readFileSync(importer, 'utf8')).matchAll(IMPORT)]
    .map(match => locate(match[1], importer, env))
    .filter(target => existsSync(target) && statSync(target).isFile())
}

function locate(reference, importer, env) {
  if (reference.startsWith('~/')) return join(env.HOME ?? homedir(), reference.slice(2))
  return isAbsolute(reference) ? reference : resolve(dirname(importer), reference)
}

function countLines(text) {
  if (text === '') return 0
  return text.split('\n').length - (text.endsWith('\n') ? 1 : 0)
}
