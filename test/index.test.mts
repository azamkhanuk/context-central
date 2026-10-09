import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { ACME_CONFIG, ACME_CONNECTIONS_LINE, INDEX_CLOSING_LINE, acme, disposable, makeTree, run } from './helpers.mts'

const tree = disposable()

const index = (root: string, ...flags: string[]) => run(['index', ...flags], { cwd: root })
const PORTAL = { 'work/portal-split/STATE.md': '---\ntitle: Split the portal\n---\n# portal-split\n' }

test('the index names the map, the hub and each item in flight with its state file', () => {
  const root = tree(acme(PORTAL))

  const result = index(root)

  assert.equal(result.code, 0)
  assert.equal(
    result.stdout,
    [
      `Context map "Acme estate": ${root}`,
      `Hub: ${join(root, 'CLAUDE.md')}`,
      ACME_CONNECTIONS_LINE,
      'Work in flight (2):',
      '- portal-split | Split the portal | work/portal-split/STATE.md',
      '- PROJ-12 | Rate limit the gateway | work/PROJ-12/STATE.md',
      INDEX_CLOSING_LINE,
      '',
    ].join('\n'),
  )
})

test('state files are given as absolute paths on request', () => {
  const root = tree(acme())

  const result = index(root, '--absolute')

  assert.equal(result.stdout.split('\n')[4], `- PROJ-12 | Rate limit the gateway | ${join(root, 'work/PROJ-12/STATE.md')}`)
})

test('finished items are left out, and with none in flight the index says so', () => {
  const root = tree(acme())
  run(['work', 'done', 'PROJ-12'], { cwd: root })

  const result = index(root)

  assert.equal(result.stdout, [`Context map "Acme estate": ${root}`, `Hub: ${join(root, 'CLAUDE.md')}`, ACME_CONNECTIONS_LINE, 'No work in flight.', ''].join('\n'))
})

test('an item with no entry file says so', () => {
  const root = tree(acme({ 'work/PROJ-30/notes/2026-01-02-idea.md': '# An idea\n' }))

  assert.equal(index(root).stdout.split('\n')[5], '- PROJ-30 | PROJ-30 | no entry file')
})

test('a README directly under the work folder is not work in flight', () => {
  const root = tree(acme({ 'work/README.md': '# Work\n' }))

  assert.equal(index(root).stdout.split('\n')[3], 'Work in flight (1):')
})

test('an index over its budget lists what fits and counts the rest', () => {
  const root = tree(
    acme({
      'work/PROJ-13/STATE.md': '# PROJ-13: Cache the gateway\n',
      'work/PROJ-14/STATE.md': '# PROJ-14: Retire the old gateway\n',
      'work/PROJ-15/STATE.md': '# PROJ-15: Log every call\n',
    }),
  )
  const expected = [
    `Context map "Acme estate": ${root}`,
    `Hub: ${join(root, 'CLAUDE.md')}`,
    ACME_CONNECTIONS_LINE,
    'Work in flight (4):',
    '- PROJ-12 | Rate limit the gateway | work/PROJ-12/STATE.md',
    '- and 3 more: context-central work list',
    INDEX_CLOSING_LINE,
  ].join('\n')
  writeFileSync(join(root, 'estate.json'), JSON.stringify({ ...ACME_CONFIG, budgets: { indexChars: expected.length + 10 } }))

  assert.equal(index(root).stdout, `${expected}\n`)
})

test('two hundred items in flight stay within the default budget and the rest are counted', () => {
  const items = Object.fromEntries(Array.from({ length: 199 }, (_, at) => [`work/PROJ-${at + 100}/STATE.md`, `# PROJ-${at + 100}: One of a great many items\n`]))
  const root = tree(acme(items))

  const lines = index(root, '--absolute').stdout.trimEnd().split('\n')

  assert.ok(lines.join('\n').length <= 2000)
  assert.equal(lines[3], 'Work in flight (200):')
  assert.equal(lines[4], `- PROJ-12 | Rate limit the gateway | ${join(root, 'work/PROJ-12/STATE.md')}`)
  assert.match(lines.at(-2) ?? '', /^- and 1\d\d more: context-central work list$/)
  assert.equal(lines.at(-1), INDEX_CLOSING_LINE)
})

test('with two hundred items in flight, the count of the rest is two hundred less the rows shown', () => {
  const items = Object.fromEntries(Array.from({ length: 199 }, (_, at) => [`work/PROJ-${at + 100}/STATE.md`, `# PROJ-${at + 100}: One of a great many items\n`]))
  const root = tree(acme(items))
  const expected = [
    `Context map "Acme estate": ${root}`,
    `Hub: ${join(root, 'CLAUDE.md')}`,
    ACME_CONNECTIONS_LINE,
    'Work in flight (200):',
    '- PROJ-12 | Rate limit the gateway | work/PROJ-12/STATE.md',
    '- PROJ-100 | One of a great many items | work/PROJ-100/STATE.md',
    '- PROJ-101 | One of a great many items | work/PROJ-101/STATE.md',
    '- and 197 more: context-central work list',
    INDEX_CLOSING_LINE,
  ].join('\n')
  writeFileSync(join(root, 'estate.json'), JSON.stringify({ ...ACME_CONFIG, budgets: { indexChars: expected.length + 10 } }))

  assert.equal(index(root).stdout, `${expected}\n`)
})

test('an argument the command does not take is wrong usage, said in one line', () => {
  const root = tree(acme())

  const result = index(root, 'everything')

  assert.equal(result.code, 2)
  assert.match(result.stderr, /^context-central index: .*everything.*\n$/)
})

test('a budget too small for any item still counts them', () => {
  const root = tree(acme({}, { budgets: { indexChars: 10 } }))

  assert.deepEqual(index(root).stdout.split('\n').slice(3, 5), ['Work in flight (1):', '- and 1 more: context-central work list'])
})

test('a hub that is not there is marked', () => {
  const root = tree(acme({}, { hub: 'MAP.md' }))

  assert.equal(index(root).stdout.split('\n')[1], `Hub: ${join(root, 'MAP.md')} (missing)`)
})

test('the index as JSON lists the same items with both paths', () => {
  const root = tree(acme())

  assert.deepEqual(JSON.parse(index(root, '--json').stdout) as unknown, {
    title: 'Acme estate',
    mapDir: root,
    hub: join(root, 'CLAUDE.md'),
    repo: null,
    connections: [{ name: 'jira', holds: 'tickets' }],
    items: [{ id: 'PROJ-12', title: 'Rate limit the gateway', entry: 'work/PROJ-12/STATE.md', path: join(root, 'work/PROJ-12/STATE.md') }],
  })
})

test('the index names the repo the folder is in, with its note and its standards', () => {
  const root = tree(acme({ 'standards/web.md': '# web\n' }))

  assert.equal(index(join(root, 'web')).stdout.split('\n')[2], 'Repo web: repos/web.md; standards: standards/web.md')
  assert.equal(index(join(root, 'web'), '--absolute').stdout.split('\n')[2], `Repo web: ${join(root, 'repos/web.md')}; standards: ${join(root, 'standards/web.md')}`)
})

test('a repo with no standards note is named with its note alone', () => {
  const root = tree(acme())

  assert.equal(index(join(root, 'api')).stdout.split('\n')[2], 'Repo api: repos/api.md')
})

test('the root of a root-layout estate, and a repo with no note, get no repo line', () => {
  const root = tree(acme({ 'billing/README.md': '# billing\n' }, { repos: [...ACME_CONFIG.repos, { name: 'billing' }] }))

  assert.equal(index(root).stdout.split('\n')[2], ACME_CONNECTIONS_LINE)
  assert.equal(index(join(root, 'billing')).stdout.split('\n')[2], ACME_CONNECTIONS_LINE)
})

test('inside repos that nest, the deeper one is named', () => {
  const root = tree(acme({ 'web/admin/README.md': '# admin\n', 'repos/admin.md': '# admin\n' }, { repos: [...ACME_CONFIG.repos, { name: 'admin', path: 'web/admin' }] }))

  assert.equal(index(join(root, 'web', 'admin')).stdout.split('\n')[2], 'Repo admin: repos/admin.md')
  assert.equal(index(join(root, 'web')).stdout.split('\n')[2], 'Repo web: repos/web.md')
})

test('in a map kept inside a repo the line is given at the estate root and below it', () => {
  const root = tree(
    makeTree({
      '.context-central/estate.json': { contextCentral: 1, name: 'solo', repos: [{ name: 'solo', path: '.' }] },
      '.context-central/repos/solo.md': '# solo\n',
      'CLAUDE.md': '# Solo\n',
      'src/index.js': 'export {}\n',
    }),
  )

  assert.equal(index(root).stdout.split('\n')[2], 'Repo solo: repos/solo.md')
  assert.equal(index(join(root, 'src')).stdout.split('\n')[2], 'Repo solo: repos/solo.md')
})

test('the index as JSON carries the repo the folder is in, and null elsewhere', () => {
  const root = tree(acme({ 'standards/web.md': '# web\n' }))

  assert.deepEqual((JSON.parse(index(join(root, 'web'), '--json').stdout) as { repo: unknown }).repo, {
    name: 'web',
    note: 'repos/web.md',
    path: join(root, 'repos/web.md'),
    standards: 'standards/web.md',
    standardsPath: join(root, 'standards/web.md'),
  })
  assert.equal((JSON.parse(index(root, '--json').stdout) as { repo: unknown }).repo, null)
})

test('the repo line counts against the budget, and a work item row is what gives way', () => {
  const root = tree(acme({ 'work/PROJ-13/STATE.md': '# PROJ-13: Cache the gateway\n' }))
  const expected = [
    `Context map "Acme estate": ${root}`,
    `Hub: ${join(root, 'CLAUDE.md')}`,
    'Repo web: repos/web.md',
    ACME_CONNECTIONS_LINE,
    'Work in flight (2):',
    '- PROJ-12 | Rate limit the gateway | work/PROJ-12/STATE.md',
    '- and 1 more: context-central work list',
    INDEX_CLOSING_LINE,
  ].join('\n')
  writeFileSync(join(root, 'estate.json'), JSON.stringify({ ...ACME_CONFIG, budgets: { indexChars: expected.length + 10 } }))

  assert.equal(index(join(root, 'web')).stdout, `${expected}\n`)
})

test("a map inside a repo has the repo's own instruction file as its hub", () => {
  const root = tree(
    makeTree({
      '.context-central/estate.json': { contextCentral: 1, name: 'solo' },
      'CLAUDE.md': '# Solo\n',
    }),
  )

  assert.deepEqual(index(root).stdout.split('\n').slice(0, 3), [
    `Context map "solo": ${join(root, '.context-central')}`,
    `Hub: ${join(root, 'CLAUDE.md')}`,
    'No work in flight.',
  ])
})

test('a folder that holds only evidence is listed as an item with no entry file', () => {
  const root = tree(acme({ 'work/PROJ-14/evidence/2026-01-14-b.png': 'x' }))

  assert.equal(index(root).stdout.split('\n')[5], '- PROJ-14 | PROJ-14 | no entry file')
})

const HOW_TO_ASK = 'context-central connections says how this machine reaches each.'
const connected = (connections: { [name: string]: { [key: string]: string | string[] | { [action: string]: string[] } } }) => tree(makeTree({ 'estate.json': { contextCentral: 1, name: 'acme', connections }, 'CLAUDE.md': '# Acme\n' }))

test('the index names the connections and the ways recorded for each', () => {
  const root = connected({
    desk: { holds: 'tickets', server: 'issues' },
    forge: { holds: 'pull-requests', preset: 'acmeforge', account: 'acme-bot' },
    notes: { holds: 'meetings' },
    talk: { holds: 'chat', commands: { read: ['talk', 'show', '{id}'] } },
  })

  assert.equal(
    index(root).stdout,
    [
      `Context map "acme": ${root}`,
      `Hub: ${join(root, 'CLAUDE.md')}`,
      `Connections: desk holds tickets (server issues); forge holds pull-requests (preset acmeforge, as acme-bot); notes holds meetings; talk holds chat (its own command). ${HOW_TO_ASK}`,
      'No work in flight.',
      '',
    ].join('\n'),
  )
})

test('a map that records no connection has no line for them', () => {
  const root = connected({})

  assert.equal(index(root).stdout, [`Context map "acme": ${root}`, `Hub: ${join(root, 'CLAUDE.md')}`, 'No work in flight.', ''].join('\n'))
})

test('a line of connections that would pass 400 characters gives names and kinds alone', () => {
  const names = Array.from({ length: 12 }, (_, at) => `tracker-${at + 1}`)
  const root = connected(Object.fromEntries(names.map(name => [name, { holds: 'tickets', server: `the-${name}-server-with-a-long-name` }])))

  assert.equal(index(root).stdout.split('\n')[2], `Connections: ${names.map(name => `${name} holds tickets`).join('; ')}. ${HOW_TO_ASK}`)
})

test('the index as JSON lists the connections by name and kind', () => {
  const root = connected({ desk: { holds: 'tickets', server: 'issues' } })

  assert.deepEqual((JSON.parse(index(root, '--json').stdout) as { connections: unknown }).connections, [{ name: 'desk', holds: 'tickets' }])
})

test('so many connections that even their names would pass 400 characters are counted and not named', () => {
  const root = connected(Object.fromEntries(Array.from({ length: 40 }, (_, at) => [`tracker-${at + 1}`, { holds: 'tickets' }])))

  assert.equal(index(root).stdout.split('\n')[2], 'Connections: 40 are recorded. context-central connections lists them and says how this machine reaches each.')
})
