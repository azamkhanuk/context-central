import { readFileSync } from 'node:fs'
import { posix, win32 } from 'node:path'
import { repoFolder, standardsFiles } from './estate.mts'
import { onPath } from './machine.mts'
import { folderAt } from './nodes.mts'
import { askedBytes } from './worktree.mts'
import type { Env } from './cli.mts'
import type { Estate, Repo } from './estate.mts'

export interface NoteWarnings {
  rel: string
  said: string[]
}

interface Rule {
  at: number
  text: string
}

interface Citation {
  span: string
  path: string
  first: number | null
  last: number | null
  line: number
  commit: string | null
}

type Held = { type: string, lines: string[] }

const PARTS = ['Design', 'Code', 'Tests', 'Review']
const LEVEL_TWO = /^##[ \t]+(.*?)[ \t]*$/
const STARTS_A_RULE = /^(?:[-*+]|\d+[.)])[ \t]/
const NESTED_OR_BLANK = /^(?:[ \t]|$)/
const SPAN = /(?<!`)(`+)(?!`)(.+?)(?<!`)\1(?!`)/g
const A_COMMIT = /^[0-9a-f]{7,64}$/
const WITH_LINES = /^([^:]*):(\d+)(?:-(\d+))?$/
const NOT_IN_A_PATH = /[\s:\p{Cc}]/u
const LEADS_OUT = /^\.\.(?:[\\/]|$)/
const AN_OBJECT = /^[0-9a-f]+ (\w+) (\d+)$/
const A_FILE = 'blob'
const HEAD = 'HEAD'
const NEWLINE = 0x0a
const judged = new Map<string, NoteWarnings | null>()

export function noteWarnings(estate: Estate, repo: Repo, env: Env): NoteWarnings | null {
  const key = `${estate.mapDir}\n${repo.name}`
  if (!judged.has(key)) judged.set(key, warningsOf(estate, repo, env))
  return judged.get(key) ?? null
}

function warningsOf(estate: Estate, repo: Repo, env: Env): NoteWarnings | null {
  const note = standardsFiles(estate, repo).find(file => file.note && file.state === 'file')
  const folder = repoFolder(estate, repo)
  if (!note || !onPath('git', env) || !folderAt(folder)) return null
  const citations = citationsIn(readFileSync(note.path, 'utf8'), repo)
  const held = heldBy(folder, [...new Set(citations.flatMap(namesOf))], env)
  if (!held) return null
  const moved = citations.filter(citation => hasMoved(citation, held))
  return { rel: note.rel, said: moved.length > 0 ? [movedWords(note.rel, repo, moved)] : [] }
}

function citationsIn(text: string, repo: Repo) {
  const lines = text.split(/\r?\n/)
  const firstPart = lines.findIndex(line => LEVEL_TWO.test(line))
  const opening = firstPart === -1 ? lines : lines.slice(0, firstPart)
  const commit = opening.flatMap(spansOf).find(span => A_COMMIT.test(span) && span !== repo.name) ?? null
  return rulesIn(lines).flatMap(rule => citationsOf(rule, commit))
}

function rulesIn(lines: string[]) {
  const rules: Rule[] = []
  let inAPart = false
  for (let at = 0; at < lines.length; at += 1) {
    const heading = LEVEL_TWO.exec(lines[at])
    if (heading) inAPart = PARTS.includes(heading[1])
    if (!inAPart || !STARTS_A_RULE.test(lines[at])) continue
    let end = at + 1
    while (end < lines.length && NESTED_OR_BLANK.test(lines[end])) end += 1
    rules.push({ at, text: lines.slice(at, end).join('\n') })
    at = end - 1
  }
  return rules
}

function citationsOf({ at, text }: Rule, commit: string | null): Citation[] {
  return [...text.matchAll(SPAN)].flatMap(({ 2: span, index }) => {
    const cited = citedBy(span)
    return cited ? [{ ...cited, span, line: at + text.slice(0, index).split('\n').length, commit }] : []
  })
}

function citedBy(span: string) {
  const [, before, first, last] = WITH_LINES.exec(span) ?? []
  const written = before ?? span
  if (written === '' || NOT_IN_A_PATH.test(written) || posix.isAbsolute(written) || win32.isAbsolute(written)) return null
  if (LEADS_OUT.test(posix.normalize(written)) || LEADS_OUT.test(win32.normalize(written))) return null
  const from = first === undefined ? null : Number(first)
  return { path: posix.normalize(written), first: from, last: last === undefined ? from : Number(last) }
}

function spansOf(line: string) {
  return [...line.matchAll(SPAN)].map(found => found[2])
}

function namesOf({ commit, path }: Citation) {
  return commit === null ? [] : [at(commit, path), at(HEAD, path)]
}

function at(commit: string, path: string) {
  return `${commit}:./${path}`
}

function heldBy(folder: string, names: string[], env: Env) {
  const printed = answerOf(folder, names, env)
  if (!printed) return null
  const held = new Map<string, Held>()
  let from = 0
  for (const name of names) {
    const end = printed.indexOf(NEWLINE, from)
    if (end === -1) return null
    const [, type, size] = AN_OBJECT.exec(printed.toString('utf8', from, end)) ?? []
    from = end + 1
    if (type === undefined) continue
    held.set(name, { type, lines: type === A_FILE ? linesOf(printed.toString('utf8', from, from + Number(size))) : [] })
    from += Number(size) + 1
  }
  return held
}

function answerOf(folder: string, names: string[], env: Env) {
  try {
    const { status, stdout } = askedBytes(folder, ['cat-file', '--batch'], env, names.map(name => `${name}\n`).join(''))
    return status === 0 ? stdout : null
  } catch {
    return null
  }
}

function linesOf(text: string) {
  const lines = text.split('\n')
  return lines.at(-1) === '' ? lines.slice(0, -1) : lines
}

function hasMoved({ commit, path, first, last }: Citation, held: Map<string, Held>) {
  const then = commit === null ? undefined : held.get(at(commit, path))
  if (then?.type !== A_FILE) return false
  const now = held.get(at(HEAD, path))
  if (now?.type !== A_FILE) return true
  if (first === null || last === null) return false
  if (first < 1 || last > then.lines.length) return true
  return then.lines.slice(first - 1, last).some((line, index) => line.trim() !== now.lines[first - 1 + index]?.trim())
}

function movedWords(rel: string, repo: Repo, moved: Citation[]) {
  const [{ span, line }] = moved
  const which = moved.length === 1 ? `1 citation that has moved since the commit it was read at (\`${span}\`, at line ${line})` : `${moved.length} citations that have moved since the commit they were read at (first \`${span}\`, at line ${line})`
  return `${rel} has ${which}; /context-central:standards ${repo.name} refreshes the note`
}
