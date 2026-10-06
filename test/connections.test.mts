import assert from 'node:assert/strict'
import { test } from 'node:test'
import { acme, disposable, makeTree, run } from './helpers.mts'
import type { Json } from './helpers.mts'

const tree = disposable()

const NONE = 'No connection is recorded. The plugin works without one. One is recommended, so that a session can read the ticket or the pull request behind the work.\n'
const REPOS = [{ name: 'web' }, { name: 'api' }]

const estate = (settings: { [key: string]: Json }) => tree(makeTree({ 'estate.json': { contextCentral: 1, name: 'acme', repos: REPOS, ...settings }, 'CLAUDE.md': '# Acme\n' }))
const withConnections = (connections: Json) => estate({ connections })
const connections = (root: string, ...args: string[]) => run(['connections', ...args], { cwd: root })
const refused = (connections: Json) => run(['config'], { cwd: withConnections(connections) })

test('a map that records no connection says so, and that one is recommended', () => {
  const result = connections(withConnections({}))

  assert.equal(result.stdout, NONE)
  assert.equal(result.code, 0)
})

test('a map made before connections that records no tracker and no code host has none', () => {
  assert.equal(connections(estate({})).stdout, NONE)
})

test('a connection reached through a server is listed with the server', () => {
  const root = withConnections({ tracker: { holds: 'tickets', server: 'issues' } })

  assert.equal(connections(root).stdout, 'tracker | tickets | by a session, through the server issues\n')
})

test("a connection with the estate's own command is for a session to run", () => {
  const root = withConnections({ tracker: { holds: 'tickets', commands: { read: ['desk', 'show', '{id}'] } } })

  assert.equal(connections(root).stdout, "tracker | tickets | by a session, with the estate's own command\n")
})

test('a connection with no way recorded is reached by hand, with what the estate says of it', () => {
  const root = withConnections({ notes: { holds: 'meetings', how: 'Ask for the minutes in the channel.' }, wiki: { holds: 'documents' } })

  assert.equal(connections(root).stdout, 'notes | meetings | by hand: Ask for the minutes in the channel.\nwiki | documents | by hand\n')
})

test('a pinned account is named beside its connection', () => {
  const root = withConnections({ code: { holds: 'pull-requests', server: 'forge', account: 'acme-bot' } })

  assert.equal(connections(root).stdout, 'code | pull-requests | by a session, through the server forge | as acme-bot\n')
})

test('connections are listed in the order they are written', () => {
  const root = withConnections({ zeta: { holds: 'tickets' }, alpha: { holds: 'chat' } })

  assert.equal(connections(root).stdout, 'zeta | tickets | by hand\nalpha | chat | by hand\n')
})

test('the same facts are given as JSON', () => {
  const root = withConnections({ tracker: { holds: 'tickets', server: 'issues', references: ['PROJ-\\d+'] }, code: { holds: 'pull-requests', account: 'acme-bot' } })

  assert.deepEqual(JSON.parse(connections(root, '--json').stdout) as unknown, [
    { name: 'tracker', holds: 'tickets', by: 'server', fetch: null, missing: null, entry: { holds: 'tickets', server: 'issues', references: ['PROJ-\\d+'] } },
    { name: 'code', holds: 'pull-requests', by: 'hand', fetch: null, missing: null, entry: { holds: 'pull-requests', account: 'acme-bot' } },
  ])
})

test('with no connection the JSON is an empty list', () => {
  assert.deepEqual(JSON.parse(connections(withConnections({}), '--json').stdout) as unknown, [])
})

test('a key of an entry that the plugin does not know is kept and shown', () => {
  const root = withConnections({ tracker: { holds: 'tickets', board: 'Platform' } })

  assert.equal(run(['config', '--get', 'connections.tracker.board'], { cwd: root }).stdout, 'Platform\n')
})

test('a preset name this version does not know is kept, and the connection is read as one with no preset', () => {
  const root = withConnections({ tracker: { holds: 'tickets', preset: 'no-such-desk', server: 'issues' } })

  assert.equal(connections(root).stdout, 'tracker | tickets | by a session, through the server issues\n')
  assert.equal(run(['config', '--get', 'connections.tracker.preset'], { cwd: root }).stdout, 'no-such-desk\n')
})

for (const [what, written, said] of [
  ['connections that are a list', [], /"connections" must be a map from a name to an entry/],
  ['an entry that is not an object', { tracker: 'issues' }, /"connections\.tracker" must be an object/],
  ['a name that could not be a file name', { 'my tracker': { holds: 'tickets' } }, /"connections": "my tracker" is not a name/],
  ['an entry with nothing in holds', { tracker: { server: 'issues' } }, /"connections\.tracker\.holds" must be text/],
  ['a reference that is not a regular expression', { tracker: { holds: 'tickets', references: ['PROJ-(\\d+'] } }, /connections\.tracker\.references: "PROJ-\(\\d\+" is not a valid regular expression/],
  ['references that are not a list', { tracker: { holds: 'tickets', references: 'PROJ-\\d+' } }, /"connections\.tracker\.references" must be a list/],
  ['a command that is not a list of words', { tracker: { holds: 'tickets', commands: { read: 'desk show {id}' } } }, /"connections\.tracker\.commands\.read" must be a list/],
  ['a command with an empty word', { tracker: { holds: 'tickets', commands: { read: ['desk', ''] } } }, /"connections\.tracker\.commands\.read" must be a list of non-empty strings/],
  ['commands that are not a map', { tracker: { holds: 'tickets', commands: ['desk'] } }, /"connections\.tracker\.commands" must be a map from an action to a command/],
  ['a repo that is not registered', { code: { holds: 'pull-requests', repos: ['web', 'billing'] } }, /"connections\.code\.repos" names "billing", which is not a registered repo/],
  ['a server that is not text', { tracker: { holds: 'tickets', server: 7 } }, /"connections\.tracker\.server" must be text/],
  ['an account that is not text', { code: { holds: 'pull-requests', account: true } }, /"connections\.code\.account" must be text/],
] satisfies [string, Json, RegExp][]) {
  test(`${what} is refused`, () => {
    const result = refused(written)

    assert.equal(result.code, 1)
    assert.match(result.stderr, said)
  })
}

test('a map made before connections shows its tracker, its code host and its sources as connections', () => {
  const root = tree(acme({}, { tracker: { type: 'desk', site: 'https://desk.acme.example', keyPatterns: ['PROJ-\\d+'], route: { via: 'the desk server', tools: { readIssue: 'read' } } }, codeHost: { type: 'forge', org: 'acme' }, sources: { meetings: 'The notes tool.', chat: '' } }))

  assert.deepEqual(JSON.parse(run(['config', '--get', 'connections'], { cwd: root }).stdout) as unknown, {
    desk: { holds: 'tickets', references: ['PROJ-\\d+'], site: 'https://desk.acme.example', route: { via: 'the desk server', tools: { readIssue: 'read' } } },
    forge: { holds: 'pull-requests', org: 'acme' },
    meetings: { holds: 'meetings', how: 'The notes tool.' },
  })
})

test('a tracker written down without a type is still a connection, by its key patterns', () => {
  const root = tree(acme({}, { tracker: { keyPatterns: ['OPS-\\d+'] } }))

  assert.deepEqual(JSON.parse(run(['config', '--get', 'connections'], { cwd: root }).stdout) as unknown, { tracker: { holds: 'tickets', references: ['OPS-\\d+'] } })
})

test('a tracker and a code host of one type on an old map are two connections', () => {
  const root = tree(acme({}, { tracker: { type: 'forge', keyPatterns: [] }, codeHost: { type: 'forge' } }))

  assert.deepEqual(JSON.parse(run(['config', '--get', 'connections'], { cwd: root }).stdout) as unknown, { forge: { holds: 'tickets', references: [] }, 'forge-pull-requests': { holds: 'pull-requests' } })
})

test('an old route is how a session reaches the tracker', () => {
  const root = tree(acme({}, { tracker: { type: 'desk', keyPatterns: [], route: { via: 'the desk server' } } }))

  assert.equal(connections(root).stdout, 'desk | tickets | by a session, by the route written down\n')
})

test('with connections present the tracker, the code host and the sources are not read', () => {
  const root = tree(acme({}, { connections: {}, codeHost: { type: 'forge' }, sources: { meetings: 'The notes tool.' } }))

  assert.equal(run(['config', '--get', 'connections'], { cwd: root }).stdout, '{}\n')
  assert.equal(connections(root).stdout, NONE)
})

test('an argument the command does not take is wrong usage, said in one line', () => {
  const result = connections(withConnections({}), '--nope')

  assert.equal(result.code, 2)
  assert.equal(result.stderr.trimEnd().split('\n').length, 1)
})

test('outside any map the command says there is none', () => {
  const result = connections(tree(makeTree({ 'readme.md': '# no map here\n' })))

  assert.equal(result.code, 1)
  assert.match(result.stderr, /no context map found/)
})
