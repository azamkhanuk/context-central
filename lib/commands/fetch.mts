import { spawnSync } from 'node:child_process'
import { readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { PluginError, UsageError } from '../errors.mts'
import { requireEstate } from '../estate.mts'
import { findWorkItem, makeFolder } from '../nodes.mts'
import { formatBytes, localDate, plural } from '../text.mts'
import type { Io } from '../cli.mts'

interface Authored {
  author?: { login?: string } | null
}

interface Comment extends Authored {
  createdAt?: string
  body?: string | null
}

interface Review extends Authored {
  state?: string
  submittedAt?: string
  body?: string | null
}

interface ChangedFile {
  path: string
  additions: number
  deletions: number
}

interface Fetched extends Authored {
  number: number
  title: string
  state: string
  url: string
  body?: string | null
  headRefName?: string
  baseRefName?: string
  files: ChangedFile[]
  comments: Comment[]
  reviews: Review[]
  labels: { name: string }[]
}

interface Kind {
  label: string
  fields: string
  digest: (fetched: Fetched) => string
  facts: (fetched: Fetched) => string[]
  sections: (fetched: Fetched) => string[]
}

export const summary = 'Save a PR or issue in full and print a digest: fetch pr|issue <ref> --item <item> [--repo <owner/name>]'

const KINDS: Record<string, Kind> = {
  pr: {
    label: 'PR',
    fields: 'number,title,state,author,baseRefName,headRefName,url,body,files,comments,reviews',
    digest: pr => `${branches(pr)}, ${plural(pr.files.length, 'file')}, ${plural(pr.comments.length, 'comment')}`,
    facts: pr => [`Branches: ${branches(pr)}`],
    sections: pr => [
      section('Reviews', pr.reviews, review => entry([login(review), review.state, review.submittedAt], review.body)),
      section('Changed files', pr.files, file => `- ${file.path} (+${file.additions} -${file.deletions})`, '\n'),
    ],
  },
  issue: {
    label: 'Issue',
    fields: 'number,title,state,author,url,body,comments,labels',
    digest: issue => plural(issue.comments.length, 'comment'),
    facts: issue => [`Labels: ${issue.labels.map(label => label.name).join(', ') || 'none'}`],
    sections: () => [],
  },
}

export function run(args: string[], io: Io) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { item: { type: 'string' }, repo: { type: 'string' } } })
  const [kindName, ref] = positionals
  const kind = Object.hasOwn(KINDS, kindName ?? '') && KINDS[kindName]
  if (!kind || !ref || positionals.length !== 2 || !values.item) {
    throw new UsageError('expected: fetch pr <ref> --item <item> [--repo <owner/name>], or the same with issue')
  }
  const estate = requireEstate(io)
  const item = findWorkItem(estate, values.item)
  if (!item) throw new PluginError(`no work item "${values.item}"`)
  const fetched = gh([kindName, 'view', ref, '--json', kind.fields, ...(values.repo ? ['--repo', values.repo] : [])], io)
  const { day } = localDate(io.env)
  const text = fullText(kind, fetched, day)
  const sourcesAbs = makeFolder(estate.mapDir, `${item.dirRel}/sources`)
  const name = `${nextNumber(sourcesAbs)}-${day}-${kindName}-${fetched.number}-full-text.md`
  writeFileSync(join(sourcesAbs, name), text, { flag: 'wx' })
  io.out(`${kind.label} #${fetched.number}: ${fetched.title} [${fetched.state}] ${kind.digest(fetched)}`)
  io.out(`saved: ${item.dirRel}/sources/${name} (${formatBytes(Buffer.byteLength(text))})`)
}

function gh(args: string[], io: Io) {
  const result = spawnSync('gh', args, { cwd: io.cwd, env: io.env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if ((result.error as NodeJS.ErrnoException | undefined)?.['code'] === 'ENOENT') throw new PluginError('gh is not on PATH; install the GitHub CLI and sign in with "gh auth login"')
  if (result.error) throw new PluginError(`gh failed: ${result.error.message}`)
  if (result.status !== 0) throw new PluginError(`gh failed: ${firstLine(result.stderr) || `exit ${result.status}`}`)
  try {
    return withLists(JSON.parse(result.stdout) as Fetched)
  } catch {
    throw new PluginError('gh failed: its answer was not JSON')
  }
}

function withLists(fetched: Fetched): Fetched {
  const lists = Object.fromEntries((['files', 'comments', 'reviews', 'labels'] satisfies (keyof Fetched)[]).map(key => [key, fetched[key] ?? []]))
  return { ...fetched, ...lists }
}

function fullText(kind: Kind, fetched: Fetched, day: string) {
  const facts = [`URL: ${fetched.url}`, `State: ${fetched.state}`, `Author: ${login(fetched)}`, ...kind.facts(fetched), `Fetched: ${day}`]
  return [
    `# ${kind.label} #${fetched.number}: ${fetched.title}`,
    facts.map(fact => `- ${fact}`).join('\n'),
    `## Body\n\n${verbatim(fetched.body, '(empty)')}`,
    section('Comments', fetched.comments, comment => entry([login(comment), comment.createdAt], comment.body)),
    ...kind.sections(fetched),
  ]
    .join('\n\n')
    .concat('\n')
}

function section<Item>(title: string, items: Item[], render: (item: Item) => string, separator = '\n\n') {
  return `## ${title} (${items.length})\n\n${items.map(render).join(separator) || 'None.'}`
}

function entry(heading: (string | undefined)[], body: string | null | undefined) {
  return `### ${heading.filter(Boolean).join(', ')}\n\n${verbatim(body, '(no text)')}`
}

function verbatim(body: string | null | undefined, whenEmpty: string) {
  return (body ?? '').replace(/\r\n/g, '\n').replace(/^\s*\n/, '').trimEnd() || whenEmpty
}

function nextNumber(sourcesAbs: string) {
  const taken = readdirSync(sourcesAbs).map(name => Number(/^(\d{2})-/.exec(name)?.[1] ?? 0))
  return String(Math.max(0, ...taken) + 1).padStart(2, '0')
}

function branches(pr: Fetched) {
  return `${pr.headRefName} -> ${pr.baseRefName}`
}

function login(authored: Authored) {
  return authored.author?.login ?? 'unknown'
}

function firstLine(text: string | null) {
  return (text ?? '').trim().split('\n')[0]
}
