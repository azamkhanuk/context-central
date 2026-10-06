import assert from 'node:assert/strict'
import { test } from 'node:test'
import { disposable, makeTree, run } from './helpers.mts'
import type { Json, TreeFiles } from './helpers.mts'

const tree = disposable()

type Answer = { by: unknown, key: unknown, item: unknown } | null

const CONNECTIONS = {
  desk: { holds: 'tickets', references: ['#(?<id>\\d+)', 'DESK-(?<id>\\d+)', 'https://desk\\.acme\\.example/t/(?<id>\\d+)'] },
  forge: { holds: 'pull-requests', references: ['https://forge\\.acme\\.example/(?<repo>[\\w.-]+)/-/pulls/(?<id>\\d+)'] },
  notes: { holds: 'meetings', references: ['https://notes\\.acme\\.example/m/(?<id>\\d+)'] },
}
const REDIRECT = 'work/login-redirect/STATE.md'

function state(id: string, title: string, ticket: string | null = null, standing = 'Nothing yet.') {
  return `---\nitem: ${id}\ntitle: ${title}\nstatus: active\n${ticket ? `ticket: "${ticket}"\n` : ''}---\n# ${id}: ${title}\n\n## Where it stands\n\n${standing}\n`
}

function estate(files: TreeFiles, settings: { [key: string]: Json } = { connections: CONNECTIONS }) {
  return tree(makeTree({ 'estate.json': { contextCentral: 1, name: 'acme', repos: [{ name: 'web' }, { name: 'api' }], ...settings }, 'CLAUDE.md': '# Acme\n', 'repos/api.md': '# api\n\nThe back end.\n', ...files }))
}

const first = (root: string, query: string) => run(['resolve', query], { cwd: root }).stdout.split('\n')[0]
const answer = (root: string, query: string) => JSON.parse(run(['resolve', query, '--json'], { cwd: root }).stdout) as Answer
const redirect = (ticket: string) => estate({ [REDIRECT]: state('login-redirect', 'Fix the login redirect', ticket) })

test('a work item is found by its ticket, whatever its folder is called', () => {
  assert.equal(first(redirect('#41'), 'look at #41 please'), 'Context for work item login-redirect:')
})

for (const spelling of ['DESK-41', 'desk-41', 'see https://desk.acme.example/t/41 today', '(#41)', 'fix #41.']) {
  test(`${spelling} is another spelling of the same reference`, () => {
    assert.equal(first(redirect('#41'), spelling), 'Context for work item login-redirect:')
  })
}

for (const text of ['page#41', 'XDESK-41', 'DESK-410', '#410']) {
  test(`${text} is not a reference to ticket 41`, () => {
    assert.equal(answer(redirect('#41'), text), null)
  })
}

test('a ticket written down as a link answers to its key', () => {
  assert.equal(first(redirect('https://desk.acme.example/t/41'), 'DESK-41 again'), 'Context for work item login-redirect:')
})

test('a work item named by its key answers to another spelling of that key', () => {
  const root = estate({ 'work/DESK-41/STATE.md': state('DESK-41', 'Fix the login redirect') })

  assert.equal(first(root, 'look at #41 please'), 'Context for work item DESK-41:')
})

test('where two matches overlap, the longer one is the reference', () => {
  const connections = { desk: { holds: 'tickets', references: ['PROJ-(?<id>\\d+)'] }, tasks: { holds: 'tickets', references: ['(?<id>PROJ-\\d+\\.\\d+)'] } }
  const root = estate({ 'work/PROJ-12/STATE.md': state('PROJ-12', 'Rate limit the gateway'), 'work/subtask/STATE.md': state('subtask', 'Count per client', 'PROJ-12.3') }, { connections })

  assert.equal(first(root, 'PROJ-12.3 is next'), 'Context for work item subtask:')
  assert.equal(first(root, 'PROJ-12 is next'), 'Context for work item PROJ-12:')
})

test('a link recorded for a connection finds the work item that mentions it', () => {
  const root = estate({ 'work/PROJ-12/STATE.md': state('PROJ-12', 'Rate limit the gateway', null, 'Raised as https://forge.acme.example/api/-/pulls/88 on Monday.') })

  assert.deepEqual(answer(root, 'review https://forge.acme.example/api/-/pulls/88 please'), { ...answer(root, 'PROJ-12'), by: 'pr' })
  assert.equal(answer(root, 'PROJ-12')?.item, 'PROJ-12')
})

test('such a link is not matched by a longer number', () => {
  const root = estate({ 'work/PROJ-12/STATE.md': state('PROJ-12', 'Rate limit the gateway', null, 'Raised as https://forge.acme.example/elsewhere/-/pulls/881.') })

  assert.equal(answer(root, 'https://forge.acme.example/elsewhere/-/pulls/88'), null)
})

test('a link that no work item mentions resolves to the note of the repo it names', () => {
  const root = estate({})

  const found = answer(root, 'https://forge.acme.example/api/-/pulls/3')

  assert.deepEqual([found?.by, found?.key], ['pr', 'repo:api'])
})

test('a link of a connection that holds something else is told apart from a pull request', () => {
  const root = estate({ 'work/PROJ-12/STATE.md': state('PROJ-12', 'Rate limit the gateway', null, 'Agreed in https://notes.acme.example/m/7.') })

  const found = answer(root, 'https://notes.acme.example/m/7')

  assert.deepEqual([found?.by, found?.item], ['link', 'PROJ-12'])
})

test('a map that records its connections takes no link it did not record for a pull request', () => {
  const root = estate({ 'work/PROJ-12/STATE.md': state('PROJ-12', 'Rate limit the gateway', null, 'Raised as https://code.acme.example/acme/api/pull/7.') })

  assert.equal(answer(root, 'https://code.acme.example/acme/api/pull/7')?.by, 'repo')
})

test('with no connection recorded, a work item is still found by its ticket as words', () => {
  const root = estate({ [REDIRECT]: state('login-redirect', 'Fix the login redirect', 'DESK-41') }, { connections: {} })

  assert.equal(first(root, 'what about DESK-41'), 'Context for work item login-redirect:')
})

test('on a map made before connections, a key pattern that starts with a sign answers after a space', () => {
  const root = estate({ [REDIRECT]: state('login-redirect', 'Fix the login redirect', '#41') }, { tracker: { type: 'desk', keyPatterns: ['#\\d+'] } })

  assert.equal(first(root, 'look at #41 please'), 'Context for work item login-redirect:')
})
