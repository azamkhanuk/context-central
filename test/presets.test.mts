import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { test } from 'node:test'
import { EXE_NAMES, NEEDS_STAND_IN, disposable, makeTree, notOnWindows, pluginWith, runIn, standIns } from './helpers.mts'
import type { Env, Json, TreeFiles } from './helpers.mts'

const tree = disposable()

const ON_PATH = notOnWindows('the stand-in on the PATH is a file with no extension, which Windows does not take for a tool')
const DESK = `export default {
  program: 'acmedesk',
  hint: 'install the desk tool',
  takes: { keys: 'the keys of its boards, as a list', board: 'the board a ticket is on' },
  kinds: {
    tickets: {
      references: entry => (entry.keys ?? []).map(key => '(?<id>' + key + '-\\\\d+)'),
      read: asked => ({ args: ['show', asked.id, ...(asked.repo ? ['--in', asked.repo] : []), ...(asked.entry.board ? ['--board', asked.entry.board] : [])] }),
    },
    'pull-requests': {
      references: () => ['https://forge\\\\.acme\\\\.example/(?<repo>[\\\\w.-]+)/-/pulls/(?<id>\\\\d+)'],
      read: asked => ({
        args: ['pull', asked.id],
        layout: (printed, day) => {
          const pull = JSON.parse(printed)
          return { id: String(pull.number), digest: 'Pull ' + pull.number + ': ' + pull.title, text: '# Pull ' + pull.number + '\\n\\n' + pull.title + '\\n\\nFetched: ' + day + '\\n' }
        },
      }),
    },
    documents: {
      references: () => [],
    },
  },
  remote: address => {
    const found = /desk\\.acme\\.example[:/](?<team>[^/]+)\\/(?<repo>[^/.]+)/.exec(address)
    return found ? { ...found.groups } : null
  },
  accounts: {
    args: ['whoami'],
    read: printed => printed.split('\\n').filter(Boolean).map(line => ({ user: line.replace(/^\\* /, ''), active: line.startsWith('* ') })),
    fix: wanted => 'the active desk account is not ' + wanted + '; run acmedesk login ' + wanted,
  },
}
`
const DESK_STAND_IN = `#!/bin/sh
here="\${0%/*}"
if [ "$1" = whoami ]; then
  while IFS= read -r account; do printf '%s\\n' "$account"; done < "$here/accounts"
  exit 0
fi
printf '%s\\n' "$@" > "$here/args"
if [ -n "$DESK_FAIL" ]; then
  printf '%s\\n' "$DESK_FAIL" >&2
  exit 1
fi
cat "$here/answer"
`
const TICKET_TEXT = 'DESK-41 Fix the login redirect\n\n  Opened by dev-one.\n\n# Steps\n\nSign in twice.\n'
const TICKET_SAVED = `# Ticket DESK-41

- Connection: desk
- Reference: DESK-41
- Fetched: 2026-01-15

DESK-41 Fix the login redirect

  Opened by dev-one.

# Steps

Sign in twice.
`
const NOTHING_ON_PATH = { PATH: tree(makeTree({})) }
const DESK_CONNECTION = { desk: { holds: 'tickets', preset: 'acmedesk', keys: ['DESK'] } }
const REDIRECT = { 'work/login-redirect/STATE.md': '---\nitem: login-redirect\ntitle: Fix the login redirect\nstatus: active\nticket: "DESK-41"\n---\n# login-redirect: Fix the login redirect\n' }

const estate = (settings: { [key: string]: Json }, files: TreeFiles = {}) => tree(makeTree({ 'estate.json': { contextCentral: 1, name: 'acme', ...settings }, 'CLAUDE.md': '# Acme\n', ...files }))
const DESK_PLUGIN = tree(pluginWith({ acmedesk: DESK }))
const withDesk = () => DESK_PLUGIN
const deskOnPath = () => ({ PATH: tree(standIns({ acmedesk: '#!/bin/sh\n' })) })
const deskAnswering = (answer = TICKET_TEXT, accounts = '* dev-one\n') => tree(standIns({ acmedesk: DESK_STAND_IN, answer, accounts }))
const fetch = (root: string, desk: string, args: string[], env: Env = {}) => runIn(withDesk(), ['fetch', ...args], { cwd: root, env: { TZ: 'UTC', PATH: [desk, '/usr/bin', '/bin'].join(delimiter), ...env } })
const argsGiven = (desk: string) => readFileSync(join(desk, 'args'), 'utf8').trimEnd().split('\n')
const sources = (root: string, item = 'login-redirect') => readdirSync(join(root, 'work', item, 'sources'))
const connected = (connections: Json = DESK_CONNECTION) => estate({ connections }, REDIRECT)

test('a preset is found by its file name, and listed with what it holds, the program it starts and the parameters it takes', () => {
  const result = runIn(withDesk(), ['connections', '--presets'], { cwd: estate({}) })

  assert.equal(result.stdout, 'acmedesk | holds tickets, pull-requests, documents | starts acmedesk | reads tickets, pull-requests | takes keys: the keys of its boards, as a list; board: the board a ticket is on\n')
  assert.equal(result.code, 0)
})

test('a preset that reads nothing and takes no parameter says neither', () => {
  const plugin = tree(pluginWith({ plain: "export default { program: 'plain', kinds: { tickets: { references: () => [] } } }\n" }))

  assert.equal(runIn(plugin, ['connections', '--presets'], { cwd: estate({}) }).stdout, 'plain | holds tickets | starts plain\n')
})

test('a plugin that carries no preset says so and still lists connections', () => {
  const plugin = tree(pluginWith({}))
  const root = estate({ connections: { tracker: { holds: 'tickets', server: 'issues' } } })

  assert.equal(runIn(plugin, ['connections', '--presets'], { cwd: root }).stdout, 'No preset is carried.\n')
  assert.equal(runIn(plugin, ['connections'], { cwd: root }).stdout, 'tracker | tickets | by a session, through the server issues\n')
})

test('the presets are listed with no map at all', () => {
  const result = runIn(withDesk(), ['connections', '--presets'], { cwd: tree(makeTree({ 'readme.md': '# no map here\n' })) })

  assert.equal(result.code, 0)
  assert.match(result.stdout, /^acmedesk \| /)
})

test('a connection whose preset can read is reached by fetch where its program is on the PATH', ON_PATH, () => {
  const result = runIn(withDesk(), ['connections'], { cwd: connected(), env: deskOnPath() })

  assert.equal(result.stdout, 'desk | tickets | by fetch: context-central fetch ticket "<reference>" --item <item>\n')
})

test('where the program is not on the PATH the line says so, beside the other way recorded', () => {
  const root = estate({ connections: { tracker: { holds: 'tickets', preset: 'acmedesk', server: 'issues' }, spare: { holds: 'tickets', preset: 'acmedesk' } } })

  const result = runIn(withDesk(), ['connections'], { cwd: root, env: NOTHING_ON_PATH })

  assert.equal(result.stdout, 'tracker | tickets | by a session, through the server issues (not by fetch here: acmedesk is not on PATH)\nspare | tickets | by hand (not by fetch here: acmedesk is not on PATH)\n')
})

test('a kind the preset holds and cannot read is never reached by fetch', ON_PATH, () => {
  const root = estate({ connections: { wiki: { holds: 'documents', preset: 'acmedesk' } } })

  assert.equal(runIn(withDesk(), ['connections'], { cwd: root, env: deskOnPath() }).stdout, 'wiki | documents | by hand\n')
})

test('as JSON a connection says whether fetch reads it here and which program is missing', ON_PATH, () => {
  const root = estate({ connections: { tracker: { holds: 'tickets', preset: 'acmedesk' } } })
  const entry = { holds: 'tickets', preset: 'acmedesk' }

  assert.deepEqual(JSON.parse(runIn(withDesk(), ['connections', '--json'], { cwd: root, env: deskOnPath() }).stdout) as unknown, [
    { name: 'tracker', holds: 'tickets', by: 'fetch', fetch: 'context-central fetch ticket "<reference>" --item <item>', missing: null, entry },
  ])
  assert.deepEqual(JSON.parse(runIn(withDesk(), ['connections', '--json'], { cwd: root, env: NOTHING_ON_PATH }).stdout) as unknown, [
    { name: 'tracker', holds: 'tickets', by: 'hand', fetch: null, missing: 'acmedesk', entry },
  ])
})

test('the tracker and the code host of an old map each take the preset their type names', () => {
  const root = estate({ tracker: { type: 'acmedesk', keyPatterns: ['PROJ-\\d+'] }, codeHost: { type: 'acmedesk' } })

  assert.deepEqual(JSON.parse(runIn(withDesk(), ['config', '--get', 'connections'], { cwd: root }).stdout) as unknown, {
    acmedesk: { holds: 'tickets', references: ['PROJ-\\d+'], preset: 'acmedesk' },
    'acmedesk-pull-requests': { holds: 'pull-requests', preset: 'acmedesk' },
  })
})

test("fetch reads a ticket with the command of its connection's preset and saves what it printed, word for word", NEEDS_STAND_IN, () => {
  const root = connected()
  const desk = deskAnswering()

  const result = fetch(root, desk, ['ticket', 'DESK-41', '--item', 'login-redirect'])

  assert.equal(result.stderr, '')
  assert.equal(result.stdout, `ticket DESK-41 read through desk\nsaved: work/login-redirect/sources/01-2026-01-15-ticket-DESK-41-full-text.md (${Buffer.byteLength(TICKET_SAVED)} B)\n`)
  assert.deepEqual(argsGiven(desk), ['show', 'DESK-41'])
  assert.equal(readFileSync(join(root, 'work/login-redirect/sources/01-2026-01-15-ticket-DESK-41-full-text.md'), 'utf8'), TICKET_SAVED)
})

test("with no reference, fetch ticket reads the item's own ticket", NEEDS_STAND_IN, () => {
  const desk = deskAnswering()

  const result = fetch(connected(), desk, ['ticket', '--item', 'login-redirect'])

  assert.equal(result.code, 0)
  assert.deepEqual(argsGiven(desk), ['show', 'DESK-41'])
})

test('issue is another word for ticket', NEEDS_STAND_IN, () => {
  const desk = deskAnswering()

  const result = fetch(connected(), desk, ['issue', 'DESK-41', '--item', 'login-redirect'])

  assert.match(result.stdout, /^ticket DESK-41 read through desk\nsaved: work\/login-redirect\/sources\/01-2026-01-15-issue-DESK-41-full-text\.md /)
})

test('an item with no ticket has none to read', () => {
  const root = estate({ connections: DESK_CONNECTION }, { 'work/portal-split/STATE.md': '# portal-split: Split the portal\n' })

  const result = fetch(root, deskAnswering(), ['ticket', '--item', 'portal-split'])

  assert.equal(result.code, 1)
  assert.equal(result.stderr, 'context-central fetch: portal-split has no ticket; name the reference to read\n')
})

test('the command is given the part of the reference that names the thing', NEEDS_STAND_IN, () => {
  const root = connected({ desk: { holds: 'tickets', preset: 'acmedesk', references: ['https://desk\\.acme\\.example/t/(?<id>DESK-\\d+)'] } })
  const desk = deskAnswering()

  const result = fetch(root, desk, ['ticket', 'https://desk.acme.example/t/DESK-41', '--item', 'login-redirect'])

  assert.deepEqual(argsGiven(desk), ['show', 'DESK-41'])
  assert.match(result.stdout, /saved: work\/login-redirect\/sources\/01-2026-01-15-ticket-DESK-41-full-text\.md/)
})

test('the connection is chosen by the reference where two hold tickets', NEEDS_STAND_IN, () => {
  const root = connected({ desk: { holds: 'tickets', preset: 'acmedesk', keys: ['DESK'] }, ops: { holds: 'tickets', preset: 'acmedesk', keys: ['OPS'] } })

  assert.match(fetch(root, deskAnswering(), ['ticket', 'OPS-7', '--item', 'login-redirect']).stdout, /^ticket OPS-7 read through ops\n/)
})

test('a reference that no connection claims goes to the only connection of its kind', NEEDS_STAND_IN, () => {
  const desk = deskAnswering()

  fetch(connected(), desk, ['ticket', '41', '--item', 'login-redirect'])

  assert.deepEqual(argsGiven(desk), ['show', '41'])
})

test('with two connections of a kind and a reference that neither claims, fetch asks which', () => {
  const root = connected({ desk: { holds: 'tickets', preset: 'acmedesk', keys: ['DESK'] }, ops: { holds: 'tickets', preset: 'acmedesk', keys: ['OPS'] } })

  const result = fetch(root, deskAnswering(), ['ticket', '41', '--item', 'login-redirect'])

  assert.equal(result.code, 1)
  assert.equal(result.stderr, 'context-central fetch: more than one connection holds tickets: desk, ops; name one with --connection\n')
})

test('--connection names the one to read through', NEEDS_STAND_IN, () => {
  const root = connected({ desk: { holds: 'tickets', preset: 'acmedesk', keys: ['DESK'] }, ops: { holds: 'tickets', preset: 'acmedesk', keys: ['OPS'] } })

  assert.match(fetch(root, deskAnswering(), ['ticket', '41', '--item', 'login-redirect', '--connection', 'ops']).stdout, /^ticket 41 read through ops\n/)
})

test('a connection that is not there, or holds another kind of thing, is refused by name', () => {
  const root = connected({ desk: { holds: 'tickets', preset: 'acmedesk' }, forge: { holds: 'pull-requests', preset: 'acmedesk' } })
  const desk = deskAnswering()

  assert.equal(fetch(root, desk, ['ticket', '41', '--item', 'login-redirect', '--connection', 'nope']).stderr, 'context-central fetch: no connection "nope"\n')
  assert.equal(fetch(root, desk, ['ticket', '41', '--item', 'login-redirect', '--connection', 'forge']).stderr, 'context-central fetch: connection forge holds pull-requests, not tickets\n')
  assert.equal(existsSync(join(desk, 'args')), false)
})

test('a map with no connection of that kind says so', () => {
  const result = fetch(connected({}), deskAnswering(), ['pr', '88', '--item', 'login-redirect'])

  assert.equal(result.code, 1)
  assert.equal(result.stderr, 'context-central fetch: no connection holds pull-requests\n')
})

for (const [way, entry, instead] of [
  ['a server', { server: 'issues' }, ' A session reads it through the server issues.'],
  ["the estate's own command", { commands: { read: ['acmedesk', 'show', '{id}'] } }, " A session reads it with the estate's own command."],
  ['a word on how', { how: 'Ask in the channel.' }, ' By hand: Ask in the channel.'],
  ['nothing', {}, ''],
] satisfies [string, { [key: string]: Json }, string][]) {
  test(`a connection with no preset and ${way} is not read by fetch, and the line says how it is reached`, () => {
    const desk = deskAnswering()

    const result = fetch(connected({ desk: { holds: 'tickets', ...entry } }), desk, ['ticket', 'DESK-41', '--item', 'login-redirect'])

    assert.equal(result.code, 1)
    assert.equal(result.stderr, `context-central fetch: connection desk is not read by fetch: it has no preset that reads tickets.${instead}\n`)
    assert.equal(existsSync(join(desk, 'args')), false)
  })
}

test("where the preset's program is not on the PATH, fetch says so with the preset's hint and the other way recorded", () => {
  const root = connected({ desk: { holds: 'tickets', preset: 'acmedesk', server: 'issues' } })

  const result = runIn(withDesk(), ['fetch', 'ticket', 'DESK-41', '--item', 'login-redirect'], { cwd: root, env: NOTHING_ON_PATH })

  assert.equal(result.code, 1)
  assert.equal(result.stderr, 'context-central fetch: connection desk is not read by fetch here: acmedesk is not on PATH; install the desk tool. A session reads it through the server issues.\n')
})

test('--check runs the read, saves nothing and needs no item', NEEDS_STAND_IN, () => {
  const root = connected()
  const desk = deskAnswering()

  const result = fetch(root, desk, ['ticket', 'DESK-41', '--check'])

  assert.equal(result.stdout, `ok: connection desk read ticket DESK-41 (${Buffer.byteLength(TICKET_TEXT)} B)\n`)
  assert.equal(result.code, 0)
  assert.deepEqual(argsGiven(desk), ['show', 'DESK-41'])
  assert.equal(existsSync(join(root, 'work/login-redirect/sources')), false)
})

test('--check with a program that fails exits 1 with the first line it wrote', NEEDS_STAND_IN, () => {
  const result = fetch(connected(), deskAnswering(), ['ticket', 'DESK-41', '--check'], { DESK_FAIL: 'No such ticket.\nTry another.' })

  assert.equal(result.code, 1)
  assert.equal(result.stderr, 'context-central fetch: acmedesk failed: No such ticket.\n')
})

test('a failing read saves nothing', NEEDS_STAND_IN, () => {
  const root = connected()

  fetch(root, deskAnswering(), ['ticket', 'DESK-41', '--item', 'login-redirect'], { DESK_FAIL: 'No such ticket.' })

  assert.equal(existsSync(join(root, 'work/login-redirect/sources')), false)
})

test('a preset that lays its text out decides the digest, the name of the file and the text', NEEDS_STAND_IN, () => {
  const root = connected({ forge: { holds: 'pull-requests', preset: 'acmedesk' } })
  const desk = deskAnswering(JSON.stringify({ number: 88, title: 'Limit the gateway' }))

  const result = fetch(root, desk, ['pr', 'https://forge.acme.example/api/-/pulls/88', '--item', 'login-redirect'])

  assert.equal(result.stdout, 'Pull 88: Limit the gateway\nsaved: work/login-redirect/sources/01-2026-01-15-pr-88-full-text.md (50 B)\n')
  assert.deepEqual(argsGiven(desk), ['pull', '88'])
  assert.equal(readFileSync(join(root, 'work/login-redirect/sources/01-2026-01-15-pr-88-full-text.md'), 'utf8'), '# Pull 88\n\nLimit the gateway\n\nFetched: 2026-01-15\n')
})

test('an answer the layout cannot read is a failure of the program, and nothing is saved', NEEDS_STAND_IN, () => {
  const root = connected({ forge: { holds: 'pull-requests', preset: 'acmedesk' } })

  const result = fetch(root, deskAnswering('not what was expected'), ['pr', '88', '--item', 'login-redirect'])

  assert.equal(result.code, 1)
  assert.match(result.stderr, /^context-central fetch: acmedesk failed: its answer could not be read \(.*\)\n$/)
  assert.equal(existsSync(join(root, 'work/login-redirect/sources')), false)
})

test("--repo is handed to the preset's command", NEEDS_STAND_IN, () => {
  const desk = deskAnswering()

  fetch(connected(), desk, ['ticket', 'DESK-41', '--item', 'login-redirect', '--repo', 'api'])

  assert.deepEqual(argsGiven(desk), ['show', 'DESK-41', '--in', 'api'])
})

test('a reference or a repo that is more than one word is refused before anything is started', () => {
  const desk = deskAnswering()

  assert.equal(fetch(connected(), desk, ['ticket', 'DESK 41', '--item', 'login-redirect']).code, 2)
  assert.equal(fetch(connected(), desk, ['ticket', 'DESK-41', '--item', 'login-redirect', '--repo', 'api web']).code, 2)
  assert.equal(existsSync(join(desk, 'args')), false)
})

test("an identifier that could not be part of a file's name is made safe in it", NEEDS_STAND_IN, () => {
  const root = connected({ desk: { holds: 'tickets', preset: 'acmedesk', references: ['#\\d+'] } })

  fetch(root, deskAnswering(), ['ticket', '#41', '--item', 'login-redirect'])

  assert.deepEqual(sources(root), ['01-2026-01-15-ticket-41-full-text.md'])
})

test('--check and --item do not go together', () => {
  assert.equal(fetch(connected(), deskAnswering(), ['ticket', 'DESK-41', '--check', '--item', 'login-redirect']).code, 2)
})

const doctorLine = (root: string, env: Env) => runIn(withDesk(), ['doctor'], { cwd: root, env: { HOME: tree(makeTree({ '.keep': '' })), ...env } }).stdout.split('\n').find(line => line.includes('connections'))
const BOT = { desk: { holds: 'tickets', preset: 'acmedesk', account: 'acme-bot' } }

test('doctor notes a connection whose only way is a preset whose program is not on the PATH', () => {
  const root = connected({ desk: { holds: 'tickets', preset: 'acmedesk' }, spare: { holds: 'tickets', preset: 'acmedesk', server: 'issues' } })

  const result = runIn(withDesk(), ['doctor'], { cwd: root, env: NOTHING_ON_PATH })

  assert.equal(result.stdout.split('\n').find(line => line.includes('connections')), 'note connections: desk is not reached here: acmedesk is not on PATH; install the desk tool')
  assert.equal(result.code, 0)
})

test('doctor is content with a connection whose preset program is on the PATH', ON_PATH, () => {
  assert.equal(doctorLine(connected(), deskOnPath()), 'ok   connections')
})

test("a pinned account that is not the active one is a fault, said in the preset's words", NEEDS_STAND_IN, () => {
  const result = runIn(withDesk(), ['doctor'], { cwd: connected(BOT), env: { PATH: deskAnswering(TICKET_TEXT, '* dev-one\nacme-bot\n') } })

  assert.equal(result.stdout.split('\n').find(line => line.includes('connections')), 'FIX  connections: the active desk account is not acme-bot; run acmedesk login acme-bot')
  assert.equal(result.code, 1)
})

test('a pinned account that is the active one, whatever its letter case, is fine', NEEDS_STAND_IN, () => {
  assert.equal(doctorLine(connected(BOT), { PATH: deskAnswering(TICKET_TEXT, 'dev-one\n* Acme-Bot\n') }), 'ok   connections')
})

test('a pinned account whose program is not on the PATH is noted, not held to be a fault', () => {
  assert.equal(doctorLine(connected(BOT), NOTHING_ON_PATH), 'note connections: desk is not reached here: acmedesk is not on PATH; install the desk tool')
})

test('a failed read through a connection with a pinned account names it when the active one is another', NEEDS_STAND_IN, () => {
  const result = fetch(connected(BOT), deskAnswering(TICKET_TEXT, '* dev-one\n'), ['ticket', 'DESK-41', '--check'], { DESK_FAIL: 'Not permitted.' })

  assert.equal(result.stderr, 'context-central fetch: acmedesk failed: Not permitted.; the active desk account is not acme-bot; run acmedesk login acme-bot\n')
})

test('a failed read as the pinned account says nothing of accounts', NEEDS_STAND_IN, () => {
  const result = fetch(connected(BOT), deskAnswering(TICKET_TEXT, '* acme-bot\n'), ['ticket', 'DESK-41', '--check'], { DESK_FAIL: 'Not permitted.' })

  assert.equal(result.stderr, 'context-central fetch: acmedesk failed: Not permitted.\n')
})

test('detect looks for the program of every preset and lists the accounts of those that can say', NEEDS_STAND_IN, () => {
  const root = tree(makeTree({ 'readme.txt': 'x\n' }))

  const facts = JSON.parse(runIn(withDesk(), ['detect', '--json'], { cwd: root, env: { PATH: deskAnswering(TICKET_TEXT, '* dev-one\nacme-bot\n'), HOME: join(root, 'home') } }).stdout) as { tools: unknown, accounts: unknown, connectionCandidates: unknown }

  assert.deepEqual(facts.tools, { git: false, acmedesk: true })
  assert.deepEqual(facts.accounts, { acmedesk: [{ user: 'dev-one', active: true }, { user: 'acme-bot', active: false }] })
  assert.deepEqual(facts.connectionCandidates, [
    { preset: 'acmedesk', holds: 'tickets', because: 'its tool is on the PATH', entry: { holds: 'tickets', preset: 'acmedesk' } },
    { preset: 'acmedesk', holds: 'pull-requests', because: 'its tool is on the PATH', entry: { holds: 'pull-requests', preset: 'acmedesk' } },
    { preset: 'acmedesk', holds: 'documents', because: 'its tool is on the PATH', entry: { holds: 'documents', preset: 'acmedesk' } },
  ])
})

test('a plugin that carries no preset looks for git alone and offers no candidate', () => {
  const root = tree(makeTree({ 'readme.txt': 'x\n' }))

  const facts = JSON.parse(runIn(tree(pluginWith({})), ['detect', '--json'], { cwd: root, env: { ...NOTHING_ON_PATH, HOME: join(root, 'home') } }).stdout) as { tools: unknown, accounts: unknown, connectionCandidates: unknown }

  assert.deepEqual([facts.tools, facts.accounts, facts.connectionCandidates], [{ git: false }, {}, []])
})

const withOwnTicket = (ticket: string) => estate({ connections: DESK_CONNECTION }, { 'work/odd/STATE.md': `---\nitem: odd\ntitle: Odd\nstatus: active\nticket: "${ticket}"\n---\n# odd: Odd\n` })

for (const [what, ticket] of [['more than one word', 'DESK 41'], ['a word that starts with a dash', '--web']]) {
  test(`an item's own ticket that is ${what} is refused before anything is started`, () => {
    const desk = deskAnswering()

    const result = fetch(withOwnTicket(ticket), desk, ['ticket', '--item', 'odd'])

    assert.equal(result.code, 1)
    assert.equal(result.stderr, `context-central fetch: "${ticket}" cannot be put into a command: a reference is one word that does not start with a dash\n`)
    assert.equal(existsSync(join(desk, 'args')), false)
  })
}

test('a value from the settings that is more than one word is refused before anything is started', () => {
  const desk = deskAnswering()

  const result = fetch(connected({ desk: { holds: 'tickets', preset: 'acmedesk', board: 'Platform team' } }), desk, ['ticket', 'DESK-41', '--check'])

  assert.equal(result.code, 1)
  assert.equal(result.stderr, 'context-central fetch: connection desk gives the command "Platform team", which is not one word\n')
  assert.equal(existsSync(join(desk, 'args')), false)
})

test('a tool that is there only as a .cmd file is said to be one the plugin cannot start', EXE_NAMES, () => {
  const tools = tree(makeTree({ 'acmedesk.cmd': '@echo off\r\n' }))
  const root = connected({ desk: { holds: 'tickets', preset: 'acmedesk', server: 'issues' } })

  assert.equal(runIn(withDesk(), ['connections'], { cwd: root, env: { PATH: tools } }).stdout, 'desk | tickets | by a session, through the server issues (not by fetch here: acmedesk is a .cmd or .bat file, which the plugin cannot start)\n')
  assert.equal(runIn(withDesk(), ['fetch', 'ticket', 'DESK-41', '--check'], { cwd: root, env: { PATH: tools } }).stderr, 'context-central fetch: connection desk is not read by fetch here: acmedesk is a .cmd or .bat file, which the plugin cannot start. A session reads it through the server issues.\n')
})
