import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { test } from 'node:test'
import { NEEDS_STAND_IN, disposable, makeTree, run, spawned, standIns } from './helpers.mts'
import type { Json, TreeFiles } from './helpers.mts'

const tree = disposable()

type Answer = { by?: unknown, key?: unknown, item?: unknown } | null

const RECORDS_ITS_ARGUMENTS = `#!/bin/sh
here="\${0%/*}"
printf '%s\\n' "$@" > "$here/args"
printf '{"id": 1}\\n'
`

function state(id: string, title: string, ticket: string | null, standing = 'Nothing yet.') {
  return `---\nitem: ${id}\ntitle: ${title}\nstatus: active\n${ticket ? `ticket: "${ticket}"\n` : ''}---\n# ${id}: ${title}\n\n## Where it stands\n\n${standing}\n`
}

const estate = (connections: Json, files: TreeFiles = {}) => tree(makeTree({ 'estate.json': { contextCentral: 1, name: 'acme', repos: [{ name: 'api' }], connections }, 'CLAUDE.md': '# Acme\n', 'repos/api.md': '# api\n\nThe back end.\n', ...files }))
const first = (root: string, query: string) => run(['resolve', query], { cwd: root }).stdout.split('\n')[0]
const answer = (root: string, query: string) => JSON.parse(run(['resolve', query, '--json'], { cwd: root }).stdout) as Answer
const withTicket = (connections: Json, ticket: string) => estate(connections, { 'work/login-redirect/STATE.md': state('login-redirect', 'Fix the login redirect', ticket) })
const FOUND = 'Context for work item login-redirect:'

function argsOf(program: string, root: string, args: string[]) {
  const tools = tree(standIns({ [program]: RECORDS_ITS_ARGUMENTS }))
  const result = run(['fetch', ...args, '--check'], { cwd: root, env: { PATH: [tools, '/usr/bin', '/bin'].join(delimiter) } })
  assert.equal(result.stderr, '')
  return readFileSync(join(tools, 'args'), 'utf8').trimEnd().split('\n')
}

const GITHUB = { issues: { holds: 'tickets', preset: 'github', org: 'acme' }, code: { holds: 'pull-requests', preset: 'github', org: 'acme' } }

for (const spelling of ['#41', 'GH-41', 'gh-41', 'https://github.com/acme/api/issues/41']) {
  test(`github: ${spelling} names issue 41`, () => {
    assert.equal(first(withTicket(GITHUB, '#41'), `look at ${spelling} please`), FOUND)
  })
}

test('github: an issue link under another organisation is not a reference of the connection', () => {
  assert.equal(answer(withTicket(GITHUB, '#41'), 'https://github.com/elsewhere/api/issues/41')?.by, 'repo')
})

test('github: a pull request link finds the work item that mentions it, and else the note of its repo', () => {
  const root = estate(GITHUB, { 'work/PROJ-12/STATE.md': state('PROJ-12', 'Rate limit the gateway', null, 'Raised as https://github.com/acme/api/pull/7.') })

  assert.deepEqual([answer(root, 'https://github.com/acme/api/pull/7')?.by, answer(root, 'https://github.com/acme/api/pull/7')?.item], ['pr', 'PROJ-12'])
  assert.deepEqual([answer(root, 'https://github.com/acme/api/pull/8')?.by, answer(root, 'https://github.com/acme/api/pull/8')?.key], ['pr', 'repo:api'])
})

test('github: a host of its own is where its links are', () => {
  const root = estate({ code: { holds: 'pull-requests', preset: 'github', host: 'github.acme.example' } })

  assert.deepEqual([answer(root, 'https://github.acme.example/acme/api/pull/8')?.by, answer(root, 'https://github.acme.example/acme/api/pull/8')?.key], ['pr', 'repo:api'])
  assert.equal(answer(root, 'https://github.com/acme/api/pull/8')?.by, 'repo')
})

for (const spelling of ['#41', 'GH-41', 'gh-41', '41']) {
  test(`github: an issue written ${spelling} is read by its number, which is what the tool takes`, NEEDS_STAND_IN, () => {
    assert.deepEqual(argsOf('gh', estate(GITHUB), ['ticket', spelling]), ['issue', 'view', '41', '--json', 'number,title,state,author,url,body,comments,labels'])
  })
}

test('github: a link is handed over whole, since it carries its repository, and a branch as it is written', NEEDS_STAND_IN, () => {
  const root = estate(GITHUB)

  assert.deepEqual(argsOf('gh', root, ['ticket', 'https://github.com/acme/api/issues/41']).slice(0, 3), ['issue', 'view', 'https://github.com/acme/api/issues/41'])
  assert.deepEqual(argsOf('gh', root, ['pr', 'feat/limit']).slice(0, 3), ['pr', 'view', 'feat/limit'])
  assert.deepEqual(argsOf('gh', root, ['pr', 'https://github.com/acme/api/pull/7']), ['pr', 'view', 'https://github.com/acme/api/pull/7', '--json', 'number,title,state,author,baseRefName,headRefName,url,body,files,comments,reviews'])
})

const JIRA = { jira: { holds: 'tickets', preset: 'jira', keys: ['PROJ', 'OPS'], site: 'https://acme.atlassian.example/' } }

for (const spelling of ['OPS-7', 'ops-7', 'https://acme.atlassian.example/browse/OPS-7']) {
  test(`jira: ${spelling} names OPS-7`, () => {
    assert.equal(first(withTicket(JIRA, 'OPS-7'), `look at ${spelling} please`), FOUND)
  })
}

test('jira: a key of a project the connection does not name is not a reference', () => {
  assert.equal(answer(withTicket(JIRA, 'OPS-7'), 'what about WEB-7'), null)
})

test('jira: with a site and no keys, a browse link is still a reference', () => {
  const root = withTicket({ jira: { holds: 'tickets', preset: 'jira', site: 'https://acme.atlassian.example' } }, 'https://acme.atlassian.example/browse/OPS-7')

  assert.equal(first(root, 'see https://acme.atlassian.example/browse/OPS-7'), FOUND)
})

test('jira: a ticket is read with every field, as JSON', NEEDS_STAND_IN, () => {
  assert.deepEqual(argsOf('acli', estate(JIRA), ['ticket', 'OPS-7']), ['jira', 'workitem', 'view', 'OPS-7', '--fields', '*all', '--json'])
})

const AZURE = { boards: { holds: 'tickets', preset: 'azure-devops', org: 'acme', project: 'Shop' }, repos: { holds: 'pull-requests', preset: 'azure-devops', org: 'acme', project: 'Shop' } }

for (const spelling of ['AB#4312', '#4312', 'https://dev.azure.com/acme/Shop/_workitems/edit/4312']) {
  test(`azure-devops: ${spelling} names work item 4312`, () => {
    assert.equal(first(withTicket(AZURE, 'AB#4312'), `look at ${spelling} please`), FOUND)
  })
}

test('azure-devops: a pull request link finds the work item that mentions it, and else the note of its repo', () => {
  const root = estate(AZURE, { 'work/PROJ-12/STATE.md': state('PROJ-12', 'Rate limit the gateway', null, 'Raised as https://dev.azure.com/acme/Shop/_git/api/pullrequest/89.') })

  assert.deepEqual([answer(root, 'https://dev.azure.com/acme/Shop/_git/api/pullrequest/89')?.by, answer(root, 'https://dev.azure.com/acme/Shop/_git/api/pullrequest/89')?.item], ['pr', 'PROJ-12'])
  assert.deepEqual([answer(root, 'https://dev.azure.com/acme/Shop/_git/api/pullrequest/90?_a=files')?.by, answer(root, 'https://dev.azure.com/acme/Shop/_git/api/pullrequest/90?_a=files')?.key], ['pr', 'repo:api'])
})

test('azure-devops: a work item and a pull request are read by number, in the organisation the connection names', NEEDS_STAND_IN, () => {
  const root = estate(AZURE)

  assert.deepEqual(argsOf('az', root, ['ticket', 'AB#4312']), ['boards', 'work-item', 'show', '--id', '4312', '--expand', 'all', '--org', 'https://dev.azure.com/acme', '--output', 'json'])
  assert.deepEqual(argsOf('az', root, ['pr', 'https://dev.azure.com/acme/Shop/_git/api/pullrequest/89']), ['repos', 'pr', 'show', '--id', '89', '--org', 'https://dev.azure.com/acme', '--output', 'json'])
})

test('azure-devops: with no organisation named, the tool is left to its own default', NEEDS_STAND_IN, () => {
  const root = estate({ boards: { holds: 'tickets', preset: 'azure-devops' } })

  assert.deepEqual(argsOf('az', root, ['ticket', '4312']), ['boards', 'work-item', 'show', '--id', '4312', '--expand', 'all', '--output', 'json'])
})

const OLD_AZURE = { tracker: { type: 'azure-devops', keyPatterns: [] } }
const oldMap = (settings: { [key: string]: Json }) => tree(makeTree({ 'estate.json': { contextCentral: 1, name: 'acme', ...settings }, 'CLAUDE.md': '# Acme\n' }))

test('on a map made before connections, the new word ticket goes to the tracker the map records', NEEDS_STAND_IN, () => {
  assert.deepEqual(argsOf('az', oldMap(OLD_AZURE), ['ticket', '4312']).slice(0, 5), ['boards', 'work-item', 'show', '--id', '4312'])
})

test('on such a map the old word issue still goes where it always went', NEEDS_STAND_IN, () => {
  assert.deepEqual(argsOf('gh', oldMap(OLD_AZURE), ['issue', '41']).slice(0, 3), ['issue', 'view', '41'])
})

const ACLI_AS_DOCUMENTED = `#!/bin/sh
here="\${0%/*}"
fail() { printf 'Error: %s\\n' "$1" >&2; exit 1; }
[ "$1 $2 $3" = "jira workitem view" ] || fail "unknown command"
shift 3
key=""; fields=""; json=""
while [ $# -gt 0 ]; do
  case "$1" in
    --json) json=1 ;;
    --web|-w) ;;
    --fields|-f) [ $# -ge 2 ] || fail "flag needs an argument: $1"; fields="$2"; shift ;;
    -*) fail "unknown flag: $1" ;;
    *) [ -z "$key" ] || fail "accepts at most 1 arg(s), received 2"; key="$1" ;;
  esac
  shift
done
[ "$key" = OPS-7 ] || fail "Issue does not exist or you do not have permission to see it."
[ -n "$json" ] || fail "this stand-in answers with --json only"
case "$fields" in
  '*all') cat "$here/all.json" ;;
  *) cat "$here/default.json" ;;
esac
`
const AZ_AS_DOCUMENTED = `#!/bin/sh
here="\${0%/*}"
fail() { printf 'az: error: %s\\n' "$1" >&2; exit 2; }
case "$1 $2 $3" in
  "boards work-item show") what=workitem ;;
  "repos pr show") what=pr ;;
  *) fail "'$1 $2 $3' is not in the 'az' command group" ;;
esac
shift 3
id=""
while [ $# -gt 0 ]; do
  case "$1" in
    --id) [ $# -ge 2 ] || fail "argument --id: expected one argument"; id="$2"; shift ;;
    --org|--organization) case "$2" in https://dev.azure.com/*) ;; *) fail "--organization must be of the form https://dev.azure.com/<name>" ;; esac; shift ;;
    --output|-o) case "$2" in json|jsonc|none|table|tsv|yaml|yamlc) ;; *) fail "argument --output/-o: invalid choice: '$2'" ;; esac; shift ;;
    --expand) [ "$what" = workitem ] || fail "unrecognized arguments: --expand"; case "$2" in all|fields|links|none|relations) ;; *) fail "argument --expand: invalid choice: '$2'" ;; esac; shift ;;
    --open) ;;
    --detect) shift ;;
    *) fail "unrecognized arguments: $1" ;;
  esac
  shift
done
case "$id" in ''|*[!0-9]*) fail "argument --id: invalid int value: '$id'" ;; esac
cat "$here/$what.json"
`
const JIRA_WITH_COMMENTS = { key: 'OPS-7', fields: { summary: 'Rotate the signing keys', comment: { comments: [{ author: { displayName: 'Dev Two' }, body: 'Rotation has to overlap by a day.' }] } } }
const JIRA_BY_DEFAULT = { key: 'OPS-7', fields: { summary: 'Rotate the signing keys' } }
const WORK_ITEM = { id: 4312, fields: { 'System.Title': 'Export the monthly report', 'System.State': 'Active' } }
const PULL_REQUEST = { pullRequestId: 89, title: 'Export the monthly report', status: 'active' }

const asDocumented = (files: TreeFiles) => tree(standIns(files))
const through = (tools: string, root: string, args: string[]) => run(['fetch', ...args], { cwd: root, env: { TZ: 'UTC', PATH: [tools, '/usr/bin', '/bin'].join(delimiter) } })
const saved = (root: string, rel: string) => readFileSync(join(root, rel), 'utf8')

test('jira: the read is taken by a stand-in that takes only the flags the vendor documents, and the saved ticket holds its comments', NEEDS_STAND_IN, () => {
  const tools = asDocumented({ acli: ACLI_AS_DOCUMENTED, 'all.json': JIRA_WITH_COMMENTS, 'default.json': JIRA_BY_DEFAULT })
  const root = withTicket(JIRA, 'OPS-7')

  const result = through(tools, root, ['ticket', '--item', 'login-redirect'])

  assert.equal(result.stderr, '')
  assert.match(result.stdout, /^ticket OPS-7 read through jira\nsaved: work\/login-redirect\/sources\/01-2026-01-15-ticket-OPS-7-full-text\.md /)
  assert.ok(saved(root, 'work/login-redirect/sources/01-2026-01-15-ticket-OPS-7-full-text.md').includes('"body": "Rotation has to overlap by a day."'))
})

test('jira: that stand-in refuses a flag, a command and a second key that the vendor does not document', NEEDS_STAND_IN, () => {
  const tools = asDocumented({ acli: ACLI_AS_DOCUMENTED, 'all.json': JIRA_WITH_COMMENTS, 'default.json': JIRA_BY_DEFAULT })
  const stand = (...args: string[]) => spawned(join(tools, 'acli'), args, { env: { PATH: '/usr/bin:/bin' } })

  assert.deepEqual([stand('jira', 'workitem', 'view', 'OPS-7', '--json', '--all-fields').code, stand('jira', 'issue', 'view', 'OPS-7', '--json').code, stand('jira', 'workitem', 'view', 'OPS-7', 'OPS-8', '--json').code], [1, 1, 1])
  assert.equal(stand('jira', 'workitem', 'view', 'OPS-7', '--json').stdout.includes('Rotation has to overlap'), false)
})

test('jira: a ticket the tool does not know is reported by the first line the tool wrote', NEEDS_STAND_IN, () => {
  const tools = asDocumented({ acli: ACLI_AS_DOCUMENTED, 'all.json': JIRA_WITH_COMMENTS, 'default.json': JIRA_BY_DEFAULT })

  const result = through(tools, estate(JIRA), ['ticket', 'OPS-8', '--check'])

  assert.equal(result.code, 1)
  assert.equal(result.stderr, 'context-central fetch: acli failed: Error: Issue does not exist or you do not have permission to see it.\n')
})

test('azure-devops: both reads are taken by a stand-in that takes only the flags the vendor documents, and what it printed is saved', NEEDS_STAND_IN, () => {
  const tools = asDocumented({ az: AZ_AS_DOCUMENTED, 'workitem.json': WORK_ITEM, 'pr.json': PULL_REQUEST })
  const root = withTicket(AZURE, 'AB#4312')

  const ticket = through(tools, root, ['ticket', '--item', 'login-redirect'])
  const pull = through(tools, root, ['pr', 'https://dev.azure.com/acme/Shop/_git/api/pullrequest/89', '--item', 'login-redirect'])

  assert.deepEqual([ticket.stderr, pull.stderr], ['', ''])
  assert.ok(saved(root, 'work/login-redirect/sources/01-2026-01-15-ticket-4312-full-text.md').includes('"System.Title": "Export the monthly report"'))
  assert.ok(saved(root, 'work/login-redirect/sources/02-2026-01-15-pr-89-full-text.md').includes('"pullRequestId": 89'))
})

test('azure-devops: that stand-in refuses a flag, a command and an organisation that the vendor does not document', NEEDS_STAND_IN, () => {
  const tools = asDocumented({ az: AZ_AS_DOCUMENTED, 'workitem.json': WORK_ITEM, 'pr.json': PULL_REQUEST })
  const stand = (...args: string[]) => spawned(join(tools, 'az'), args, { env: { PATH: '/usr/bin:/bin' } }).code

  assert.deepEqual(
    [stand('boards', 'work-item', 'show', '--id', '4312', '--comments'), stand('boards', 'workitem', 'show', '--id', '4312'), stand('repos', 'pr', 'show', '--id', '89', '--expand', 'all'), stand('repos', 'pr', 'show', '--id', '89', '--org', 'acme'), stand('repos', 'pr', 'show', '--id', 'AB#89')],
    [2, 2, 2, 2, 2],
  )
})
