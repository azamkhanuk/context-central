import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { ACME_CONFIG, INDEX_CLOSING_LINE, acme, disposable, makeTree, run } from './helpers.mts'

const tree = disposable()

const index = (root, ...flags) => run(['index', ...flags], { cwd: root })
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

  assert.equal(result.stdout.split('\n')[3], `- PROJ-12 | Rate limit the gateway | ${join(root, 'work/PROJ-12/STATE.md')}`)
})

test('finished items are left out, and with none in flight the index says so', () => {
  const root = tree(acme())
  run(['work', 'done', 'PROJ-12'], { cwd: root })

  const result = index(root)

  assert.equal(result.stdout, [`Context map "Acme estate": ${root}`, `Hub: ${join(root, 'CLAUDE.md')}`, 'No work in flight.', ''].join('\n'))
})

test('an item with no entry file says so', () => {
  const root = tree(acme({ 'work/PROJ-30/notes/2026-01-02-idea.md': '# An idea\n' }))

  assert.equal(index(root).stdout.split('\n')[4], '- PROJ-30 | PROJ-30 | no entry file')
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
  assert.equal(lines[2], 'Work in flight (200):')
  assert.equal(lines[3], `- PROJ-12 | Rate limit the gateway | ${join(root, 'work/PROJ-12/STATE.md')}`)
  assert.match(lines.at(-2), /^- and 1\d\d more: context-central work list$/)
  assert.equal(lines.at(-1), INDEX_CLOSING_LINE)
})

test('with two hundred items in flight, the count of the rest is two hundred less the rows shown', () => {
  const items = Object.fromEntries(Array.from({ length: 199 }, (_, at) => [`work/PROJ-${at + 100}/STATE.md`, `# PROJ-${at + 100}: One of a great many items\n`]))
  const root = tree(acme(items))
  const expected = [
    `Context map "Acme estate": ${root}`,
    `Hub: ${join(root, 'CLAUDE.md')}`,
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

  assert.deepEqual(index(root).stdout.split('\n').slice(2, 4), ['Work in flight (1):', '- and 1 more: context-central work list'])
})

test('a hub that is not there is marked', () => {
  const root = tree(acme({}, { hub: 'MAP.md' }))

  assert.equal(index(root).stdout.split('\n')[1], `Hub: ${join(root, 'MAP.md')} (missing)`)
})

test('the index as JSON lists the same items with both paths', () => {
  const root = tree(acme())

  assert.deepEqual(JSON.parse(index(root, '--json').stdout), {
    title: 'Acme estate',
    mapDir: root,
    hub: join(root, 'CLAUDE.md'),
    items: [{ id: 'PROJ-12', title: 'Rate limit the gateway', entry: 'work/PROJ-12/STATE.md', path: join(root, 'work/PROJ-12/STATE.md') }],
  })
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

  assert.equal(index(root).stdout.split('\n')[4], '- PROJ-14 | PROJ-14 | no entry file')
})
