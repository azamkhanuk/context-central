import { readFileSync } from 'node:fs'
import { posix, win32 } from 'node:path'
import { repoFolder, standardsFiles } from './estate.mts'
import { onPath } from './machine.mts'
import { folderAt } from './nodes.mts'
import { plural } from './text.mts'
import { asked, askedBytes } from './worktree.mts'
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

interface Named {
  id: string
  line: number
}

export interface Cited {
  span: string
  path: string
  first: number | null
  last: number | null
  line: number
  commit: string | null
}

export type Judged = 'moved' | 'held' | 'no commit' | 'commit not held' | 'not behind the head' | 'no such file'

interface Citation extends Cited {
  paths: string[]
}

interface Answers {
  held: Map<string, Held>
  ids: Map<string, string>
  behind: Set<string>
}

type Held = { type: string, id: string, lines: string[] }

const PARTS = ['Design', 'Code', 'Tests', 'Review']
const LEVEL_TWO = /^##[ \t]+(.*?)[ \t]*$/
const STARTS_A_RULE = /^(?:[-*+]|\d+[.)])[ \t]/
const NESTED_OR_BLANK = /^(?:[ \t]|$)/
const SPAN = /(?<!`)(`+)(?!`)(.+?)(?<!`)\1(?!`)/g
const A_COMMIT = /^[0-9a-f]{7,64}$/
const AT = /^\s+at\s+$/
const WITH_LINES = /^([^:]*):(\d+)(?:-(\d+))?$/
const NOT_IN_A_PATH = /[\s:\p{Cc}]/u
const LEADS_OUT = /^\.\.(?:[\\/]|$)/
const AN_OBJECT = /^([0-9a-f]+) (\w+) (\d+)$/
const A_LINK_THAT_LEADS_NOWHERE = /^(?:symlink|dangling|loop|notdir) (\d+)$/
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
  const text = note && onPath('git', env) && folderAt(folder) ? textOf(note.path) : null
  if (!note || text === null) return null
  const { readAt, named, citations } = read(text, repo)
  const answers = answersOf(folder, [...new Set(named.map(({ id }) => id))], citations, env)
  if (!answers) return null
  const { held, ids, behind } = answers
  const lost = named.filter(({ id }, index) => !ids.has(id) && named.findIndex(other => other.id === id) === index)
  const moved = citations.filter(citation => citation.commit !== null && behind.has(citation.commit) && hasMoved(citation, citation.commit, held))
  return { rel: note.rel, said: [...commitWords(note.rel, repo, readAt, lost), ...movedWords(note.rel, repo, moved)] }
}

export function citedIn(text: string, at: number): Cited[] {
  return readIn(text, at).cited
}

export function judgedIn(folder: string, repo: Repo, cited: Cited[], env: Env): Judged[] | null {
  const citations = cited.map(one => ({ ...one, paths: countedFrom(one.path, repo) }))
  const answers = answersOf(folder, [...new Set(citations.flatMap(({ commit }) => commit ?? []))], citations, env)
  return answers && citations.map(citation => judgedBy(citation, answers))
}

function judgedBy(citation: Citation, { held, ids, behind }: Answers): Judged {
  const { commit, paths } = citation
  if (commit === null) return 'no commit'
  if (!ids.has(commit)) return 'commit not held'
  if (!behind.has(commit)) return 'not behind the head'
  if (!paths.some(path => held.get(at(commit, path))?.type === A_FILE)) return 'no such file'
  return hasMoved(citation, commit, held) ? 'moved' : 'held'
}

function answersOf(folder: string, commits: string[], citations: Citation[], env: Env): Answers | null {
  const held = heldBy(folder, [...new Set([...commits.map(asACommit), ...citations.flatMap(namesOf)])], env)
  const ids = held && idsOf(commits, held)
  const behind = ids && behindTheHead(folder, ids, env)
  return held && ids && behind ? { held, ids, behind } : null
}

function textOf(path: string) {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

function read(text: string, repo: Repo) {
  const lines = text.split(/\r?\n/)
  const firstPart = lines.findIndex(line => LEVEL_TWO.test(line))
  const opening = firstPart === -1 ? lines : lines.slice(0, firstPart)
  const readAt = opening.flatMap((line, at) => spansOf(line).map(span => ({ id: span.text, line: at + 1 }))).find(({ id }) => A_COMMIT.test(id) && id !== repo.name) ?? null
  const rules = rulesIn(lines).map(rule => citationsOf(rule, readAt?.id ?? null, repo))
  return { readAt, named: [...(readAt ? [readAt] : []), ...rules.flatMap(({ own }) => own ?? [])], citations: rules.flatMap(rule => rule.citations) }
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

function citationsOf({ at, text }: Rule, readAt: string | null, repo: Repo): { own: Named | null, citations: Citation[] } {
  const { own, cited } = readIn(text, at)
  return { own, citations: cited.map(one => ({ ...one, paths: countedFrom(one.path, repo), commit: one.commit ?? readAt })) }
}

function readIn(text: string, at: number): { own: Named | null, cited: Cited[] } {
  const spans = spansOf(text)
  const lineOf = (from: number) => at + text.slice(0, from).split('\n').length
  const commits = spans.filter((span, index) => index > 0 && A_COMMIT.test(span.text) && AT.test(text.slice(spans[index - 1].to, span.from)) && citedBy(spans[index - 1].text)?.first != null)
  const last = commits.at(-1)
  const cited = spans.filter(span => !commits.includes(span)).flatMap(span => {
    const read = citedBy(span.text)
    return read ? [{ ...read, span: span.text, line: lineOf(span.from), commit: last?.text ?? null }] : []
  })
  return { own: last ? { id: last.text, line: lineOf(last.from) } : null, cited }
}

function citedBy(span: string) {
  const [, before, one, other] = WITH_LINES.exec(span) ?? []
  const written = before ?? span
  if (written === '' || NOT_IN_A_PATH.test(written) || posix.isAbsolute(written) || win32.isAbsolute(written)) return null
  if (LEADS_OUT.test(posix.normalize(written)) || LEADS_OUT.test(win32.normalize(written))) return null
  const lines = [one, other ?? one].flatMap(line => (line === undefined ? [] : [Number(line)]))
  return { path: posix.normalize(written), first: lines.length > 0 ? Math.min(...lines) : null, last: lines.length > 0 ? Math.max(...lines) : null }
}

function countedFrom(path: string, repo: Repo) {
  const folder = posix.normalize(`${repo.path}/`)
  return folder !== './' && path.startsWith(folder) && path.length > folder.length ? [path, path.slice(folder.length)] : [path]
}

function spansOf(text: string) {
  return [...text.matchAll(SPAN)].map(found => ({ text: found[2], from: found.index, to: found.index + found[0].length }))
}

function namesOf({ commit, paths }: Citation) {
  return commit === null ? [] : paths.flatMap(path => [at(commit, path), at(HEAD, path)])
}

function asACommit(commit: string) {
  return `${commit}^{commit}`
}

// A short id that a tree shares names no file by itself, so a file is asked of the commit the id names.
function at(commit: string, path: string) {
  return `${commit === HEAD ? HEAD : asACommit(commit)}:./${path}`
}

function heldBy(folder: string, names: string[], env: Env) {
  const printed = batchOf(folder, names, env)
  if (!printed) return null
  const held = new Map<string, Held>()
  let from = 0
  for (const name of names) {
    const end = printed.indexOf(NEWLINE, from)
    if (end === -1) return null
    const answer = printed.toString('utf8', from, end)
    const [, id, type, size] = AN_OBJECT.exec(answer) ?? []
    const [, target] = A_LINK_THAT_LEADS_NOWHERE.exec(answer) ?? []
    from = end + 1
    if (target !== undefined) from += Number(target) + 1
    if (type === undefined) continue
    held.set(name, { type, id, lines: type === A_FILE ? linesOf(printed.toString('utf8', from, from + Number(size))) : [] })
    from += Number(size) + 1
  }
  return held
}

function batchOf(folder: string, names: string[], env: Env) {
  try {
    const { status, stdout, error } = askedBytes(folder, ['cat-file', '--batch', '--follow-symlinks'], env, names.map(name => `${name}\n`).join(''))
    return status === 0 && !error ? stdout : null
  } catch {
    return null
  }
}

// A branch or a tag named in hexadecimal answers before a commit of that id, so a commit counts as held only under an id that starts as it is written.
function idsOf(commits: string[], held: Map<string, Held>) {
  const ids = new Map<string, string>()
  for (const commit of commits) {
    const id = held.get(asACommit(commit))?.id
    if (id?.startsWith(commit)) ids.set(commit, id)
  }
  return ids
}

function behindTheHead(folder: string, ids: Map<string, string>, env: Env) {
  const ahead = ids.size > 0 ? aheadOfTheHead(folder, [...new Set(ids.values())], env) : new Set<string>()
  return ahead && new Set([...ids].filter(([, id]) => !ahead.has(id)).map(([commit]) => commit))
}

function aheadOfTheHead(folder: string, ids: string[], env: Env) {
  try {
    const { status, stdout, error } = asked(folder, ['rev-list', ...ids, '--not', HEAD], env)
    return status === 0 && !error ? new Set(stdout.split('\n')) : null
  } catch {
    return null
  }
}

function linesOf(text: string) {
  const lines = text.split('\n')
  return lines.at(-1) === '' ? lines.slice(0, -1) : lines
}

function hasMoved({ paths, first, last }: Citation, commit: string, held: Map<string, Held>) {
  const path = paths.find(counted => held.get(at(commit, counted))?.type === A_FILE)
  const then = path === undefined ? undefined : held.get(at(commit, path))
  if (path === undefined || !then) return false
  const now = held.get(at(HEAD, path))
  if (now?.type !== A_FILE) return true
  if (first === null || last === null) return false
  if (first < 1 || last > then.lines.length) return true
  return then.lines.slice(first - 1, last).some((line, index) => line.trim() !== now.lines[first - 1 + index]?.trim())
}

function commitWords(rel: string, repo: Repo, readAt: Named | null, lost: Named[]) {
  if (!readAt) return [`${rel} names no commit on its opening lines for its citations to be read at; /context-central:standards ${repo.name} sets one`]
  if (lost.length === 0) return []
  const [{ id, line }] = lost
  const which = lost.length === 1 ? `the commit \`${id}\` at line ${line}, which repo ${repo.name} does not hold, so the citations read at it were not compared` : `${plural(lost.length, 'commit')} that repo ${repo.name} does not hold (first \`${id}\`, at line ${line}), so the citations read at them were not compared`
  return [`${rel} names ${which}; /context-central:standards ${repo.name} refreshes the note`]
}

function movedWords(rel: string, repo: Repo, moved: Citation[]) {
  if (moved.length === 0) return []
  const [{ span, line }] = moved
  const which = moved.length === 1 ? `has moved since the commit it was read at (\`${span}\`, at line ${line})` : `have moved since the commit they were read at (first \`${span}\`, at line ${line})`
  return [`${rel} has ${plural(moved.length, 'citation')} that ${which}; /context-central:standards ${repo.name} refreshes the note`]
}
