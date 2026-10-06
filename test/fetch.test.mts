import assert from 'node:assert/strict'
import { chmodSync, copyFileSync, existsSync, readdirSync, readFileSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { test } from 'node:test'
import { EXE_NAMES, NEEDS_STAND_IN, acme, disposable, makeTree, run } from './helpers.mts'
import type { Env } from './helpers.mts'

const tree = disposable()

const GH_STUB = `#!/bin/sh
here="\${0%/*}"
printf '%s\\n' "$@" > "$here/args"
if [ -n "$GH_STUB_FAIL" ]; then
  printf '%s\\n' "$GH_STUB_FAIL" >&2
  exit 1
fi
case "$1 $2" in
  "pr view") cat "$here/pr.json" ;;
  "issue view") cat "$here/issue.json" ;;
  *) echo "stub gh: unexpected call" >&2; exit 2 ;;
esac
`

const PR = {
  number: 88,
  title: 'Limit the gateway',
  state: 'OPEN',
  author: { login: 'dev-one' },
  baseRefName: 'main',
  headRefName: 'feat/limit',
  url: 'https://code.acme.example/acme/api/pull/88',
  body: 'Adds a token bucket in front of every route.\n\n## Testing\n\nRan the suite.',
  files: [
    { path: 'src/limiter.js', additions: 120, deletions: 0 },
    { path: 'src/gateway.js', additions: 14, deletions: 3 },
    { path: 'test/limiter.test.js', additions: 80, deletions: 0 },
    { path: 'README.md', additions: 2, deletions: 1 },
  ],
  comments: [
    { author: { login: 'dev-two' }, body: 'What happens on deploy?', createdAt: '2026-01-12T09:30:00Z' },
    { author: { login: 'dev-one' }, body: 'The bucket resets.\n\nThat is a trap worth writing down.', createdAt: '2026-01-12T10:00:00Z' },
    { author: { login: 'dev-three' }, body: 'Orders needs twenty a minute.', createdAt: '2026-01-13T08:15:00Z' },
  ],
  reviews: [
    { author: { login: 'dev-two' }, state: 'CHANGES_REQUESTED', body: 'Keep the count across deploys.', submittedAt: '2026-01-13T11:00:00Z' },
    { author: { login: 'dev-three' }, state: 'APPROVED', body: '', submittedAt: '2026-01-14T16:45:00Z' },
  ],
}

const PR_FULL_TEXT = `# PR #88: Limit the gateway

- URL: https://code.acme.example/acme/api/pull/88
- State: OPEN
- Author: dev-one
- Branches: feat/limit -> main
- Fetched: 2026-01-15

## Body

Adds a token bucket in front of every route.

## Testing

Ran the suite.

## Comments (3)

### dev-two, 2026-01-12T09:30:00Z

What happens on deploy?

### dev-one, 2026-01-12T10:00:00Z

The bucket resets.

That is a trap worth writing down.

### dev-three, 2026-01-13T08:15:00Z

Orders needs twenty a minute.

## Reviews (2)

### dev-two, CHANGES_REQUESTED, 2026-01-13T11:00:00Z

Keep the count across deploys.

### dev-three, APPROVED, 2026-01-14T16:45:00Z

(no text)

## Changed files (4)

- src/limiter.js (+120 -0)
- src/gateway.js (+14 -3)
- test/limiter.test.js (+80 -0)
- README.md (+2 -1)
`

const ISSUE = {
  number: 41,
  title: 'Gateway drops calls',
  state: 'CLOSED',
  author: { login: 'dev-three' },
  url: 'https://code.acme.example/acme/api/issues/41',
  body: 'One call in ten never reaches api.',
  comments: [{ author: { login: 'dev-one' }, body: 'Seen on orders only.', createdAt: '2026-01-11T14:00:00Z' }],
  labels: [{ name: 'bug' }, { name: 'gateway' }],
}

const ISSUE_FULL_TEXT = `# Issue #41: Gateway drops calls

- URL: https://code.acme.example/acme/api/issues/41
- State: CLOSED
- Author: dev-three
- Labels: bug, gateway
- Fetched: 2026-01-15

## Body

One call in ten never reaches api.

## Comments (1)

### dev-one, 2026-01-11T14:00:00Z

Seen on orders only.
`

const BARE_PR = { ...PR, number: 90, title: 'Tidy', body: '', files: [{ path: 'README.md', additions: 1, deletions: 1 }], comments: [], reviews: [] }

function stubGh(pr = PR, issue = ISSUE) {
  const dir = tree(makeTree({ gh: GH_STUB, 'pr.json': pr, 'issue.json': issue }))
  chmodSync(join(dir, 'gh'), 0o755)
  return dir
}

const fetch = (root: string, gh: string, args: string[], env: Env = {}) => run(['fetch', ...args], { cwd: root, env: { TZ: 'UTC', PATH: [gh, '/usr/bin', '/bin'].join(delimiter), ...env } })
const read = (root: string, rel: string) => readFileSync(join(root, rel), 'utf8')
const ghArgs = (gh: string) => readFileSync(join(gh, 'args'), 'utf8').trimEnd().split('\n')
const sources = (root: string, item = 'PROJ-12') => readdirSync(join(root, 'work', item, 'sources'))

test('a fetched pull request is saved in full and answered with a digest', NEEDS_STAND_IN, () => {
  const root = tree(acme())

  const result = fetch(root, stubGh(), ['pr', '88', '--item', 'PROJ-12'])

  assert.equal(result.code, 0)
  assert.equal(
    result.stdout,
    'PR #88: Limit the gateway [OPEN] feat/limit -> main, 4 files, 3 comments\nsaved: work/PROJ-12/sources/02-2026-01-15-pr-88-full-text.md (771 B)\n',
  )
  assert.equal(read(root, 'work/PROJ-12/sources/02-2026-01-15-pr-88-full-text.md'), PR_FULL_TEXT)
})

test('the pull request is asked for with every field the full text needs', NEEDS_STAND_IN, () => {
  const root = tree(acme())
  const gh = stubGh()

  fetch(root, gh, ['pr', '88', '--item', 'PROJ-12'])

  assert.deepEqual(ghArgs(gh), ['pr', 'view', '88', '--json', 'number,title,state,author,baseRefName,headRefName,url,body,files,comments,reviews'])
})

test('a named repository is passed on to gh', NEEDS_STAND_IN, () => {
  const root = tree(acme())
  const gh = stubGh()

  fetch(root, gh, ['issue', '41', '--item', 'PROJ-12', '--repo', 'acme/api'])

  assert.deepEqual(ghArgs(gh), ['issue', 'view', '41', '--json', 'number,title,state,author,url,body,comments,labels', '--repo', 'acme/api'])
})

test('a fetched issue is saved in full and answered with a digest', NEEDS_STAND_IN, () => {
  const root = tree(acme())

  const result = fetch(root, stubGh(), ['issue', '41', '--item', 'PROJ-12'])

  assert.equal(result.code, 0)
  assert.equal(
    result.stdout,
    'Issue #41: Gateway drops calls [CLOSED] 1 comment\nsaved: work/PROJ-12/sources/02-2026-01-15-issue-41-full-text.md (286 B)\n',
  )
  assert.equal(read(root, 'work/PROJ-12/sources/02-2026-01-15-issue-41-full-text.md'), ISSUE_FULL_TEXT)
})

test('a pull request with nothing said on it still saves cleanly', NEEDS_STAND_IN, () => {
  const root = tree(acme())

  const result = fetch(root, stubGh(BARE_PR), ['pr', '90', '--item', 'PROJ-12'])

  assert.match(result.stdout, /^PR #90: Tidy \[OPEN\] feat\/limit -> main, 1 file, 0 comments\n/)
  assert.match(
    read(root, 'work/PROJ-12/sources/02-2026-01-15-pr-90-full-text.md'),
    /## Body\n\n\(empty\)\n\n## Comments \(0\)\n\nNone\.\n\n## Reviews \(0\)\n\nNone\.\n\n## Changed files \(1\)\n\n- README\.md \(\+1 -1\)\n$/,
  )
})

test('the first source of an item is numbered 01', NEEDS_STAND_IN, () => {
  const root = tree(acme({ 'work/PROJ-9/STATE.md': '# PROJ-9: Split the portal\n' }))

  const result = fetch(root, stubGh(), ['pr', '88', '--item', 'PROJ-9'])

  assert.match(result.stdout, /saved: work\/PROJ-9\/sources\/01-2026-01-15-pr-88-full-text\.md/)
  assert.deepEqual(sources(root, 'PROJ-9'), ['01-2026-01-15-pr-88-full-text.md'])
})

test('a source is numbered one past the highest in the folder', NEEDS_STAND_IN, () => {
  const root = tree(acme({ 'work/PROJ-12/sources/09-2026-01-12-thread-full-text.md': '# A thread\n' }))

  const result = fetch(root, stubGh(), ['issue', '41', '--item', 'PROJ-12'])

  assert.match(result.stdout, /saved: work\/PROJ-12\/sources\/10-2026-01-15-issue-41-full-text\.md/)
})

test('fetching for an item that does not exist is refused before gh is asked', () => {
  const root = tree(acme())
  const gh = stubGh()

  const result = fetch(root, gh, ['pr', '88', '--item', 'PROJ-404'])

  assert.equal(result.code, 1)
  assert.equal(result.stderr, 'context-central fetch: no work item "PROJ-404"\n')
  assert.equal(existsSync(join(gh, 'args')), false)
})

test('a failing gh is reported by the first line it wrote, and nothing is saved', NEEDS_STAND_IN, () => {
  const root = tree(acme())
  const failure = 'GraphQL: Could not resolve to a PullRequest with the number of 99.\nTry again later.'

  const result = fetch(root, stubGh(), ['pr', '99', '--item', 'PROJ-12'], { GH_STUB_FAIL: failure })

  assert.equal(result.code, 1)
  assert.equal(result.stderr, 'context-central fetch: gh failed: GraphQL: Could not resolve to a PullRequest with the number of 99.\n')
  assert.deepEqual(sources(root), ['01-2026-01-09-PROJ-12-full-text.md'])
})

test('a machine without gh is told so', () => {
  const root = tree(acme())
  const emptyPath = tree(makeTree({}))

  const result = run(['fetch', 'pr', '88', '--item', 'PROJ-12'], { cwd: root, env: { PATH: emptyPath } })

  assert.equal(result.code, 1)
  assert.equal(result.stderr, 'context-central fetch: connection github is not read by fetch here: gh is not on PATH; install the GitHub CLI and sign in with "gh auth login".\n')
})

test('gh is started by its bare name where the file is gh.exe', EXE_NAMES, () => {
  const root = tree(acme())
  const dir = tree(makeTree({}))
  copyFileSync(process.execPath, join(dir, 'gh.exe'))

  const result = run(['fetch', 'pr', '88', '--item', 'PROJ-12'], { cwd: root, env: { PATH: dir } })

  assert.equal(result.code, 1)
  assert.match(result.stderr, /^context-central fetch: gh failed: /)
})

test('a fetch needs a kind, a reference and an item', () => {
  const root = tree(acme())
  const gh = stubGh()

  for (const args of [['pr', '88'], ['pr', '--item', 'PROJ-12'], ['thread', '88', '--item', 'PROJ-12'], ['--item', 'PROJ-12']]) {
    assert.equal(fetch(root, gh, args).code, 2, args.join(' '))
  }
  assert.equal(existsSync(join(gh, 'args')), false)
})

test('a file in sources named by its date does not count as a number', NEEDS_STAND_IN, () => {
  const root = tree(
    acme({
      'work/PROJ-12/sources/07-2026-01-12-thread-full-text.md': '# A thread\n',
      'work/PROJ-12/sources/2026-01-13-loose-notes.md': '# Loose notes\n',
    }),
  )

  const result = fetch(root, stubGh(), ['pr', '88', '--item', 'PROJ-12'])

  assert.match(result.stdout, /saved: work\/PROJ-12\/sources\/08-2026-01-15-pr-88-full-text\.md/)
})

test('headings, code fences and indentation in what people wrote are saved as written', NEEDS_STAND_IN, () => {
  const root = tree(acme())
  const body = '    npm test\n\n# Why\n\n```sh\n## not a heading\n```\n'
  const comment = { author: { login: 'dev-two' }, body: '  - an indented point\n  - another', createdAt: '2026-01-12T09:30:00Z' }

  fetch(root, stubGh({ ...BARE_PR, body, comments: [comment] }), ['pr', '90', '--item', 'PROJ-12'])

  const saved = read(root, 'work/PROJ-12/sources/02-2026-01-15-pr-90-full-text.md')
  assert.ok(saved.includes('## Body\n\n    npm test\n\n# Why\n\n```sh\n## not a heading\n```\n\n## Comments (1)\n'))
  assert.ok(saved.includes('### dev-two, 2026-01-12T09:30:00Z\n\n  - an indented point\n  - another\n\n## Reviews (0)\n'))
})

test('a flag fetch does not know is wrong usage, said in one line', () => {
  const root = tree(acme())
  const gh = stubGh()

  const result = fetch(root, gh, ['pr', '88', '--item', 'PROJ-12', '--web'])

  assert.equal(result.code, 2)
  assert.match(result.stderr, /^context-central fetch: Unknown option '--web'.*\n$/)
  assert.equal(existsSync(join(gh, 'args')), false)
})

test('an item kept as a single note gets a sources folder beside it', NEEDS_STAND_IN, () => {
  const root = tree(acme({ 'work/PROJ-7.md': '# PROJ-7: Retire the old portal\n' }))

  const result = fetch(root, stubGh(), ['issue', '41', '--item', 'PROJ-7'])

  assert.match(result.stdout, /saved: work\/PROJ-7\/sources\/01-2026-01-15-issue-41-full-text\.md/)
  assert.deepEqual(sources(root, 'PROJ-7'), ['01-2026-01-15-issue-41-full-text.md'])
})

test('a fetch is refused in plain words when a file stands where the sources folder would go', NEEDS_STAND_IN, () => {
  const root = tree(acme({ 'work/PROJ-13/STATE.md': '# PROJ-13\n', 'work/PROJ-13/sources': 'a file\n' }))

  const result = fetch(root, stubGh(), ['pr', '88', '--item', 'PROJ-13'])

  assert.deepEqual(result, { code: 1, stdout: '', stderr: 'context-central fetch: work/PROJ-13/sources is a file, not a folder, so nothing can be written under it\n' })
})
