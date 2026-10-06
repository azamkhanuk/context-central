import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { test } from 'node:test'
import { NEEDS_STAND_IN, disposable, makeTree, run, standIns } from './helpers.mts'
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

test('github: an issue and a pull request are each read by number, link or branch as given', NEEDS_STAND_IN, () => {
  const root = estate(GITHUB)

  assert.deepEqual(argsOf('gh', root, ['ticket', '#41']), ['issue', 'view', '#41', '--json', 'number,title,state,author,url,body,comments,labels'])
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
