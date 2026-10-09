import type { Account, Asked, Entry, Laid, PresetBody, Reading } from '../presets.mts'

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

interface Shape {
  word: string
  label: string
  fields: string
  digest: (fetched: Fetched) => string
  facts: (fetched: Fetched) => string[]
  sections: (fetched: Fetched) => string[]
}

const HOST = 'github.com'
const LINK = /^[a-z][a-z0-9+.-]*:\/\//i
// An ssh host alias for a second key is written github.com-<name>.
const REMOTE = /^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^@/\s]+@)?github\.com(?:-[\w-]+)?(?::\d+)?[:/](?<org>[^/]+)\/(?<repo>[^/]+?)(?:\.git)?\/?$/
const PULL_REQUEST: Shape = {
  word: 'pr',
  label: 'PR',
  fields: 'number,title,state,author,baseRefName,headRefName,url,body,files,comments,reviews',
  digest: pr => `${branches(pr)}, ${plural(pr.files.length, 'file')}, ${plural(pr.comments.length, 'comment')}`,
  facts: pr => [`Branches: ${branches(pr)}`],
  sections: pr => [
    section('Reviews', pr.reviews, review => entry([login(review), review.state, review.submittedAt], review.body)),
    section('Changed files', pr.files, file => `- ${file.path} (+${file.additions} -${file.deletions})`, '\n'),
  ],
}
const ISSUE: Shape = {
  word: 'issue',
  label: 'Issue',
  fields: 'number,title,state,author,url,body,comments,labels',
  digest: issue => plural(issue.comments.length, 'comment'),
  facts: issue => [`Labels: ${issue.labels.map(label => label.name).join(', ') || 'none'}`],
  sections: () => [],
}

export default {
  program: 'gh',
  hint: 'install the GitHub CLI and sign in with "gh auth login"',
  takes: { org: 'the organisation or the user its repositories are under', host: 'the host, where it is not github.com' },
  kinds: {
    tickets: {
      references: entry => ['#(?<id>\\d+)', 'GH-(?<id>\\d+)', `${repoAt(entry)}/issues/(?<id>\\d+)`],
      read: asked => reading(ISSUE, asked),
    },
    'pull-requests': {
      references: entry => [`${repoAt(entry)}/pull/(?<id>\\d+)`],
      read: asked => reading(PULL_REQUEST, asked),
    },
  },
  remote: address => {
    const found = REMOTE.exec(address)?.groups
    return found ? { org: found.org, repo: found.repo } : null
  },
  accounts: {
    args: ['auth', 'status'],
    read: accountsIn,
    token: (wanted, entry) => ({ args: ['auth', 'token', '--user', wanted, ...hostFlag(entry)], variable: tokenVariable(entry) }),
    signIn: (wanted, entry, [former]) => {
      const host = hostFlag(entry).map(word => ` ${word}`).join('')
      const back = former ? `; that makes it the active account, and gh auth switch${host} --user ${former} puts ${former} back` : ''
      return `sign ${wanted} in with gh auth login${host}${back}`
    },
    fix: wanted => `the active gh account is not ${wanted}; run gh auth switch --user ${wanted}, or start each gh command with GH_TOKEN=$(gh auth token --user ${wanted})`,
  },
  onOldMaps: { accountKey: 'ghUser', unasked: true },
} satisfies PresetBody

function accountsIn(printed: string, entry?: Entry): Account[] {
  const accounts: (Account & { host: string })[] = []
  for (const line of printed.split('\n')) {
    const login = /Logged in to (\S+) (?:account|as) (\S+)/.exec(line)
    const active = /Active account: (true|false)/.exec(line)
    if (login) accounts.push({ host: login[1].toLowerCase(), user: login[2], active: true })
    if (active && accounts.length > 0) accounts.at(-1)!.active = active[1] === 'true'
  }
  return accounts.filter(account => !entry || account.host === hostOf(entry)).map(({ user, active }) => ({ user, active }))
}

function hostOf({ host }: Entry) {
  return typeof host === 'string' && host ? host.toLowerCase() : HOST
}

function tokenVariable(entry: Entry) {
  const host = hostOf(entry)
  return host === HOST || host.endsWith('.ghe.com') ? 'GH_TOKEN' : 'GH_ENTERPRISE_TOKEN'
}

function hostFlag({ host }: Entry) {
  return typeof host === 'string' && host ? ['--hostname', host] : []
}

function repoAt({ host, org }: Entry) {
  return `https://${literal(typeof host === 'string' && host ? host : HOST)}/${typeof org === 'string' && org ? literal(org) : '[\\w.-]+'}/(?<repo>[\\w.-]+)`
}

function literal(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function reading(shape: Shape, { reference, id, repo }: Asked): Reading {
  return {
    args: [shape.word, 'view', LINK.test(reference) ? reference : id, '--json', shape.fields, ...(repo ? ['--repo', repo] : [])],
    layout: (printed, day) => laid(shape, withLists(JSON.parse(printed) as Fetched), day),
  }
}

function laid(shape: Shape, fetched: Fetched, day: string): Laid {
  return {
    id: String(fetched.number),
    digest: `${shape.label} #${fetched.number}: ${fetched.title} [${fetched.state}] ${shape.digest(fetched)}`,
    text: fullText(shape, fetched, day),
  }
}

function withLists(fetched: Fetched): Fetched {
  const lists = Object.fromEntries((['files', 'comments', 'reviews', 'labels'] satisfies (keyof Fetched)[]).map(key => [key, fetched[key] ?? []]))
  return { ...fetched, ...lists }
}

function fullText(shape: Shape, fetched: Fetched, day: string) {
  const facts = [`URL: ${fetched.url}`, `State: ${fetched.state}`, `Author: ${login(fetched)}`, ...shape.facts(fetched), `Fetched: ${day}`]
  return [
    `# ${shape.label} #${fetched.number}: ${fetched.title}`,
    facts.map(fact => `- ${fact}`).join('\n'),
    `## Body\n\n${verbatim(fetched.body, '(empty)')}`,
    section('Comments', fetched.comments, comment => entry([login(comment), comment.createdAt], comment.body)),
    ...shape.sections(fetched),
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

function branches(pr: Fetched) {
  return `${pr.headRefName} -> ${pr.baseRefName}`
}

function login(authored: Authored) {
  return authored.author?.login ?? 'unknown'
}

function plural(count: number, noun: string) {
  return `${count} ${count === 1 ? noun : `${noun}s`}`
}
