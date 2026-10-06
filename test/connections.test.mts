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

const TWO_TRACKERS = {
  tracker: { holds: 'tickets', references: ['PROJ-\\d+'], how: 'Open the tracker.' },
  desk: { holds: 'tickets', references: ['DESK-\\d+', 'https://desk\\.acme\\.example/t/(?<id>DESK-\\d+)'], server: 'acme-desk' },
  code: { holds: 'pull-requests', references: ['https://forge\\.acme\\.example/pull/(?<id>\\d+)'], server: 'forge' },
}

test('with a ticket or a pull request named, only the connection it belongs to is listed', () => {
  const root = withConnections(TWO_TRACKERS)

  assert.equal(connections(root, '--ticket', 'DESK-7').stdout, 'desk | tickets | by a session, through the server acme-desk\n')
  assert.equal(connections(root, '--ticket', 'PROJ-12').stdout, 'tracker | tickets | by hand: Open the tracker.\n')
  assert.equal(connections(root, '--pr', 'https://forge.acme.example/pull/9').stdout, 'code | pull-requests | by a session, through the server forge\n')
})

test('a link to a ticket belongs to the connection its short form belongs to', () => {
  const root = withConnections(TWO_TRACKERS)

  assert.equal(connections(root, '--ticket', 'https://desk.acme.example/t/DESK-7').stdout, 'desk | tickets | by a session, through the server acme-desk\n')
})

test('the connection of a ticket is given as JSON too', () => {
  const root = withConnections(TWO_TRACKERS)

  assert.deepEqual(JSON.parse(connections(root, '--ticket', 'DESK-7', '--json').stdout) as unknown, [
    { name: 'desk', holds: 'tickets', by: 'server', fetch: null, missing: null, entry: TWO_TRACKERS.desk },
  ])
})

test('a ticket that two connections claim belongs to the one written first, which is the one fetch reads', () => {
  const root = withConnections({ first: { holds: 'tickets', references: ['#\\d+'], server: 'one' }, second: { holds: 'tickets', references: ['#\\d+'], server: 'two' } })

  assert.equal(connections(root, '--ticket', '#41').stdout, 'first | tickets | by a session, through the server one\n')
  assert.match(run(['fetch', 'ticket', '#41', '--check'], { cwd: root }).stderr, /^context-central fetch: connection first is not read by fetch/)
})

test('a reference is looked for only among the connections that hold its kind', () => {
  const root = withConnections({ issues: { holds: 'tickets', references: ['#\\d+'] }, code: { holds: 'pull-requests', references: ['#\\d+'] } })

  assert.equal(connections(root, '--ticket', '#41').stdout, 'issues | tickets | by hand\n')
  assert.equal(connections(root, '--pr', '#41').stdout, 'code | pull-requests | by hand\n')
})

test('a ticket that no pattern claims belongs to the only connection that holds tickets, as fetch has it', () => {
  const root = withConnections({ tracker: { holds: 'tickets', server: 'issues' }, code: { holds: 'pull-requests', references: ['#\\d+'] } })

  assert.equal(connections(root, '--ticket', 'ABC-1').stdout, 'tracker | tickets | by a session, through the server issues\n')
  assert.match(run(['fetch', 'ticket', 'ABC-1', '--check'], { cwd: root }).stderr, /^context-central fetch: connection tracker is not read by fetch/)
})

test('a ticket that none of several connections claims has no connection, and they are named', () => {
  const result = connections(withConnections(TWO_TRACKERS), '--ticket', 'OTHER-1')

  assert.equal(result.code, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'context-central connections: more than one connection holds tickets and none claims "OTHER-1": tracker, desk\n')
})

test('part of a reference is not the reference', () => {
  const result = connections(withConnections(TWO_TRACKERS), '--ticket', 'DESK-7-and-more')

  assert.equal(result.code, 1)
  assert.match(result.stderr, /none claims "DESK-7-and-more"/)
})

test('where no connection holds the kind, the command says so', () => {
  const result = connections(withConnections({ tracker: { holds: 'tickets', server: 'issues' } }), '--pr', 'https://forge.acme.example/pull/9')

  assert.equal(result.code, 1)
  assert.equal(result.stderr, 'context-central connections: no connection holds pull-requests\n')
})

test('a ticket and a pull request at once, either beside the list of presets, or a bare word, is wrong usage', () => {
  const root = withConnections(TWO_TRACKERS)

  assert.equal(connections(root, '--ticket', 'DESK-7', '--pr', 'https://forge.acme.example/pull/9').code, 2)
  assert.equal(connections(root, '--ticket', 'DESK-7', '--item', 'login-redirect').code, 2)
  assert.equal(connections(root, '--ticket', 'DESK-7', '--presets').code, 2)
  assert.equal(connections(root, 'DESK-7').code, 2)
})

test('a reference that fetch would refuse as not one word, or as starting with a dash, is refused here too', () => {
  const root = withConnections({ tracker: { holds: 'tickets', references: ['PROJ-\\d+'], server: 'issues' } })

  for (const odd of ['', ' ', 'PROJ 12', '--web', ' PROJ-12 ', 'PROJ-12\n']) {
    assert.equal(connections(root, `--ticket=${odd}`).code, 2, JSON.stringify(odd))
    assert.equal(connections(root, `--pr=${odd}`).code, 2, JSON.stringify(odd))
  }
  assert.equal(connections(root, '--ticket=PROJ-12').code, 0)
})

const TWO_FORGES = {
  one: { holds: 'pull-requests', references: ['https://forge\\.acme\\.example/(?<repo>[\\w.-]+)/pull/(?<id>\\d+)'], server: 'forge-one', repos: ['api'] },
  two: { holds: 'pull-requests', references: ['https://forge\\.acme\\.example/(?<repo>[\\w.-]+)/pull/(?<id>\\d+)'], server: 'forge-two', repos: ['web'] },
}

test('a pull request link that two connections claim belongs to the one that serves its repository, for fetch as well', () => {
  const root = withConnections(TWO_FORGES)

  assert.equal(connections(root, '--pr', 'https://forge.acme.example/web/pull/7').stdout, 'two | pull-requests | by a session, through the server forge-two\n')
  assert.equal(connections(root, '--pr', 'https://forge.acme.example/api/pull/7').stdout, 'one | pull-requests | by a session, through the server forge-one\n')
  assert.match(run(['fetch', 'pr', 'https://forge.acme.example/web/pull/7', '--check'], { cwd: root }).stderr, /^context-central fetch: connection two is not read by fetch/)
})

test('a connection that names no repos has a link before one that names other repos', () => {
  const root = withConnections({ one: TWO_FORGES.one, any: { holds: 'pull-requests', references: TWO_FORGES.two.references, server: 'forge-two' } })

  assert.equal(connections(root, '--pr', 'https://forge.acme.example/web/pull/7').stdout, 'any | pull-requests | by a session, through the server forge-two\n')
})

test('a link to a repository that no claiming connection serves belongs to the one written first', () => {
  assert.equal(connections(withConnections(TWO_FORGES), '--pr', 'https://forge.acme.example/docs/pull/7').stdout, 'one | pull-requests | by a session, through the server forge-one\n')
})

const head = (id: string, ticket: string | null) => `---\nitem: ${id}\ntitle: Something\nstatus: active\n${ticket ? `ticket: "${ticket}"\n` : ''}---\n# ${id}: Something\n`
const withItems = () =>
  tree(makeTree({
    'estate.json': { contextCentral: 1, name: 'acme', repos: REPOS, connections: TWO_TRACKERS },
    'CLAUDE.md': '# Acme\n',
    'work/login-redirect/STATE.md': head('login-redirect', 'DESK-7'),
    'work/PROJ-12/STATE.md': head('PROJ-12', null),
    'work/tidy-up/STATE.md': head('tidy-up', null),
  }))

test("with a work item named, the connection is the one its own ticket belongs to", () => {
  assert.equal(connections(withItems(), '--item', 'login-redirect').stdout, 'desk | tickets | by a session, through the server acme-desk\n')
})

test('a work item whose name is itself a reference has that for its ticket', () => {
  assert.equal(connections(withItems(), '--item', 'PROJ-12').stdout, 'tracker | tickets | by hand: Open the tracker.\n')
})

test('a work item with no ticket has no connection, and one that does not exist is said not to', () => {
  const root = withItems()

  assert.deepEqual([connections(root, '--item', 'tidy-up').code, connections(root, '--item', 'tidy-up').stderr], [1, 'context-central connections: tidy-up has no ticket\n'])
  assert.deepEqual([connections(root, '--item', 'nope').code, connections(root, '--item', 'nope').stderr], [1, 'context-central connections: no work item "nope"\n'])
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

test('with connections present, a tracker written badly is not even read', () => {
  const root = tree(acme({}, { connections: {}, tracker: { keyPatterns: ['PROJ-('] } }))

  assert.equal(run(['config', '--get', 'connections'], { cwd: root }).stdout, '{}\n')
})

test('a source of an old map that is neither words nor a route written down is no connection', () => {
  const root = tree(acme({}, { tracker: { type: 'none', keyPatterns: [] }, sources: { chat: false, meetings: 0, wiki: null } }))

  assert.equal(run(['config', '--get', 'connections'], { cwd: root }).stdout, '{}\n')
})
