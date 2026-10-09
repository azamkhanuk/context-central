import assert from 'node:assert/strict'
import { statSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { ACME_FILES, ACME_SHOT, acme, disposable, makeTree, run } from './helpers.mts'
import type { TreeFiles } from './helpers.mts'

const tree = disposable()

type Pointer = { rel: string, why: string }
type Resolution = {
  by: unknown
  key: unknown
  name: unknown
  label: unknown
  item: unknown
  pointers: Pointer[]
  more: unknown
  deep: { count: unknown, bytes: unknown, rel: unknown }
  notes: unknown
  evidence: unknown
}

const sizeOf = (rel: keyof typeof ACME_FILES) => Buffer.byteLength(ACME_FILES[rel])
const resolve = (root: string, ...args: string[]) => run(['resolve', ...args], { cwd: root })
const resolved = (root: string, ...args: string[]) => JSON.parse(resolve(root, ...args, '--json').stdout) as Resolution
const rels = (resolution: Resolution) => resolution.pointers.map(pointer => pointer.rel)
const smallMap = (files: TreeFiles) => makeTree({ 'estate.json': { contextCentral: 1, name: 'acme' }, ...files })

function proj12Answer(root: string) {
  return {
    by: 'item',
    key: 'item:PROJ-12',
    item: 'PROJ-12',
    name: 'PROJ-12',
    label: 'work item PROJ-12',
    pointers: [
      { rel: 'work/PROJ-12/STATE.md', path: join(root, 'work/PROJ-12/STATE.md'), bytes: sizeOf('work/PROJ-12/STATE.md'), why: 'state file: where the work stands and what is next' },
      { rel: 'work/PROJ-12/SPEC.md', path: join(root, 'work/PROJ-12/SPEC.md'), bytes: sizeOf('work/PROJ-12/SPEC.md'), why: 'spec of the work item' },
      { rel: 'concepts/gateway.md', path: join(root, 'concepts/gateway.md'), bytes: sizeOf('concepts/gateway.md'), why: 'linked from the work item' },
      { rel: 'repos/api.md', path: join(root, 'repos/api.md'), bytes: sizeOf('repos/api.md'), why: 'linked from the work item' },
    ],
    more: 0,
    notes: {
      count: 1,
      bytes: sizeOf('work/PROJ-12/notes/2026-01-10-research-rate-limits.md'),
      rel: 'work/PROJ-12',
      path: join(root, 'work/PROJ-12'),
    },
    deep: {
      count: 1,
      bytes: sizeOf('work/PROJ-12/sources/01-2026-01-09-PROJ-12-full-text.md'),
      rel: 'work/PROJ-12/sources',
      path: join(root, 'work/PROJ-12/sources'),
    },
    evidence: null,
  }
}

const RANKED_FILES = {
  'work/PROJ-20/STATE.md': [
    '# PROJ-20: Ranked',
    '',
    'See [[work/PROJ-12]], [the spec](SPEC.md), [[docs/runbook]], [[decisions/one-gateway]], [[repos/web]],',
    '[[areas/orders]], [[edges/web-api]], [[concepts/gateway]], [[log/2026-01]] and',
    '[the ticket](sources/01-ticket.md).',
    '',
  ].join('\n'),
  'work/PROJ-20/SPEC.md': '# Spec\n',
  'work/PROJ-20/sources/01-ticket.md': '# Ticket\n',
  'docs/runbook.md': '# Runbook\n',
  'decisions/one-gateway.md': '# One gateway\n',
  'areas/orders.md': '# Orders\n',
  'log/2026-01.md': '# January\n',
}

test('a ticket key resolves to its state file, the notes it links to and its deep tier', () => {
  const root = tree(acme())

  const result = resolve(root, 'pick', 'up', 'PROJ-12')

  assert.equal(result.code, 0)
  assert.equal(
    result.stdout,
    [
      'Context for work item PROJ-12:',
      `- work/PROJ-12/STATE.md (${sizeOf('work/PROJ-12/STATE.md')} B) state file: where the work stands and what is next`,
      `- work/PROJ-12/SPEC.md (${sizeOf('work/PROJ-12/SPEC.md')} B) spec of the work item`,
      `- concepts/gateway.md (${sizeOf('concepts/gateway.md')} B) linked from the work item`,
      `- repos/api.md (${sizeOf('repos/api.md')} B) linked from the work item`,
      `Other notes of this item: 1 file (${sizeOf('work/PROJ-12/notes/2026-01-10-research-rate-limits.md')} B) under work/PROJ-12.`,
      `Deep tier: 1 file (${sizeOf('work/PROJ-12/sources/01-2026-01-09-PROJ-12-full-text.md')} B) under work/PROJ-12/sources, not listed one by one.`,
      '',
    ].join('\n'),
  )
})

test('the answer as JSON carries both paths, the reason and a key to tell answers apart', () => {
  const root = tree(acme())

  assert.deepEqual(resolved(root, 'PROJ-12'), proj12Answer(root))
})

test('absolute paths are printed on request', () => {
  const root = tree(acme())

  const result = resolve(root, 'PROJ-12', '--absolute')

  assert.ok(result.stdout.includes(`\n- ${join(root, 'work/PROJ-12/STATE.md')} (`), result.stdout)
  assert.ok(result.stdout.includes(` under ${join(root, 'work/PROJ-12/sources')}, not listed one by one`), result.stdout)
})

test('a key is found whatever its case', () => {
  const root = tree(acme())

  assert.equal(resolved(root, 'where', 'is', 'proj-12', 'now?').key, 'item:PROJ-12')
})

test('a work item with a plain name is found when the name is a whole token', () => {
  const root = tree(acme({ 'work/portal-split/STATE.md': '# portal-split: Split the portal\n' }))

  assert.equal(resolved(root, 'carry', 'on', 'with', 'portal-split.').key, 'item:portal-split')
  assert.equal(resolved(root, 'the', 'portal-splitting', 'idea'), null)
})

test('a longer key does not resolve to the item whose key it starts with', () => {
  const root = tree(acme())

  assert.deepEqual(resolved(root, 'look', 'at', 'PROJ-123') as unknown, { unanswered: [{ text: 'PROJ-123', connection: 'jira' }] })
})

test('a work item named inside a path or with an ending is still found', () => {
  const root = tree(acme({ 'work/portal-split/STATE.md': '# portal-split: Split the portal\n' }))

  assert.equal(resolved(root, 'continue', 'work/portal-split/STATE.md').key, 'item:portal-split')
  assert.equal(resolved(root, "what", "is", "portal-split's", "next", "step").key, 'item:portal-split')
})

test('when a prompt names two work items the one named first is the answer', () => {
  const root = tree(
    acme({
      'work/PROJ-13/STATE.md': '# PROJ-13: Cache the gateway\n',
      'work/portal-split/STATE.md': '# portal-split: Split the portal\n',
    }),
  )

  assert.equal(resolved(root, 'PROJ-13', 'then', 'PROJ-12').key, 'item:PROJ-13')
  assert.equal(resolved(root, 'portal-split', 'before', 'PROJ-12').key, 'item:portal-split')
})

test('a work item with no entry file is not an answer', () => {
  const root = tree(acme({ 'work/PROJ-30/notes/2026-01-02-idea.md': '# An idea\n' }))

  assert.equal(resolved(root, 'PROJ-30'), null)
})

test('a link that leads out of the map is not listed', () => {
  const root = tree(
    acme({
      'map/estate.json': { contextCentral: 1, name: 'inner' },
      'map/work/PROJ-40/STATE.md': '# PROJ-40: Leaves the map\n\nSee [the other map](../../../repos/web.md) and [[concepts/inside]].\n',
      'map/concepts/inside.md': '# Inside\n',
    }),
  )

  const result = run(['resolve', 'PROJ-40', '--json'], { cwd: join(root, 'map') })

  assert.deepEqual(rels(JSON.parse(result.stdout) as Resolution), ['work/PROJ-40/STATE.md', 'concepts/inside.md'])
})

test('an item name shorter than five characters is never matched as a word', () => {
  const root = tree(acme({ 'work/next/STATE.md': '# next: What comes next\n' }))

  assert.equal(resolved(root, 'what', 'is', 'next'), null)
})

test('a query that is exactly an item name resolves to it however short the name', () => {
  const root = tree(acme())
  run(['work', 'new', 'sso'], { cwd: root })

  assert.equal(resolved(root, 'sso').key, 'item:sso')
  assert.equal(resolved(root, ' SSO ').key, 'item:sso')
  assert.equal(resolved(root, 'turn', 'on', 'sso'), null)
})

test('an entry file that is not a state file is called an entry note', () => {
  const root = tree(acme({ 'work/PROJ-7.md': '# PROJ-7: Old shape\n\nWritten before state files.\n' }))

  assert.deepEqual(
    resolved(root, 'PROJ-7').pointers.map(pointer => [pointer.rel, pointer.why]),
    [['work/PROJ-7.md', 'entry note of the work item']],
  )
})

test("a state file that links its item's older entry file has that file listed straight after it", () => {
  const state = '# PROJ-9: Split the portal\n\nSee [[concepts/gateway]] and [where it began](00-START-HERE.md).\n'
  const root = tree(acme({ 'work/PROJ-9/STATE.md': state, 'work/PROJ-9/00-START-HERE.md': '# Start here\n' }))

  const resolution = resolved(root, 'PROJ-9')

  assert.deepEqual(
    resolution.pointers.map(pointer => [pointer.rel, pointer.why]),
    [
      ['work/PROJ-9/STATE.md', 'state file: where the work stands and what is next'],
      ['work/PROJ-9/00-START-HERE.md', 'older entry file of the work item'],
      ['concepts/gateway.md', 'linked from the work item'],
    ],
  )
})

test('an older entry file the state file does not link stays among the other notes of the item', () => {
  const root = tree(acme({ 'work/PROJ-9/STATE.md': '# PROJ-9: Split the portal\n', 'work/PROJ-9/00-START-HERE.md': '# Start here\n' }))

  const resolution = resolved(root, 'PROJ-9')

  assert.deepEqual(rels(resolution), ['work/PROJ-9/STATE.md'])
  assert.deepEqual(resolution.notes, { count: 1, bytes: 13, rel: 'work/PROJ-9', path: join(root, 'work/PROJ-9') })
})

test('a link to the hub is not a pointer of a work item or of a repo note', () => {
  const state = '# PROJ-9: Split the portal\n\nSee [the hub](../../CLAUDE.md) and [[concepts/gateway]].\n'
  const root = tree(acme({ 'work/PROJ-9/STATE.md': state, 'repos/web.md': '# web\n\nRouted from [the hub](../CLAUDE.md). Talks to [[repos/api]].\n' }))

  assert.deepEqual(rels(resolved(root, 'PROJ-9')), ['work/PROJ-9/STATE.md', 'concepts/gateway.md'])
  assert.deepEqual(rels(resolved(root, 'web')), ['repos/web.md', 'repos/api.md'])
})

test('a hub kept among the notes is left out of linked pointers too', () => {
  const root = tree(acme({ 'docs/index.md': '# Acme estate\n', 'work/PROJ-9/STATE.md': '# PROJ-9: Split the portal\n\nSee [[docs/index]] and [[concepts/gateway]].\n' }, { hub: 'docs/index.md' }))

  assert.deepEqual(rels(resolved(root, 'PROJ-9')), ['work/PROJ-9/STATE.md', 'concepts/gateway.md'])
})

test('linked notes are ranked by kind, with the log and the deep tier left out', () => {
  const root = tree(acme(RANKED_FILES))

  assert.deepEqual(rels(resolved(root, 'PROJ-20', '--max', '20')), [
    'work/PROJ-20/STATE.md',
    'work/PROJ-20/SPEC.md',
    'concepts/gateway.md',
    'edges/web-api.md',
    'areas/orders.md',
    'repos/web.md',
    'decisions/one-gateway.md',
    'docs/runbook.md',
    'work/PROJ-12/STATE.md',
  ])
})

test('the note of a repo the state file names follows the linked notes', () => {
  const root = tree(acme({ 'work/PROJ-21/STATE.md': '# PROJ-21: Screens\n\nThe change is in web only. See [[concepts/gateway]].\n' }))

  assert.deepEqual(
    resolved(root, 'PROJ-21').pointers.map(pointer => [pointer.rel, pointer.why]),
    [
      ['work/PROJ-21/STATE.md', 'state file: where the work stands and what is next'],
      ['concepts/gateway.md', 'linked from the work item'],
      ['repos/web.md', 'named in the work item'],
    ],
  )
})

test('a key with no work item falls through to the next route', () => {
  const root = tree(acme())

  assert.equal(resolved(root, 'PROJ-99', 'in', 'api').key, 'repo:api')
  assert.equal(resolved(root, 'PROJ-99', 'in', 'api').name, 'api')
})

test('no match is an answer, not a failure', () => {
  const root = tree(acme())

  const result = resolve(root, 'nothing', 'tomorrow')

  assert.equal(result.code, 0)
  assert.equal(result.stdout, 'No confident match for "nothing tomorrow".\n')
  assert.equal(resolved(root, 'nothing', 'tomorrow'), null)
})

test('on a map made before connections, a key with no work item is said to read as a ticket', () => {
  const root = tree(acme())

  assert.equal(resolve(root, 'PROJ-99', 'tomorrow').stdout, 'PROJ-99 reads as a ticket of connection jira. No work item answers to it.\n')
})

test('the answer as JSON ends cleanly whether or not there is a match', () => {
  const root = tree(acme())

  const found = resolve(root, 'PROJ-12', '--json')
  const missed = resolve(root, 'nothing', 'tomorrow', '--json')

  assert.deepEqual([found.code, found.stderr], [0, ''])
  assert.deepEqual([missed.code, missed.stdout, missed.stderr], [0, 'null\n', ''])
})

test('a flag the command does not know is wrong usage, said in one line', () => {
  const root = tree(acme())

  const result = resolve(root, 'PROJ-12', '--everything')

  assert.equal(result.code, 2)
  assert.match(result.stderr, /^context-central resolve: .*--everything.*\n$/)
})

test('a query is required', () => {
  const root = tree(acme())

  assert.equal(resolve(root).code, 2)
})

test('only six linked notes are listed unless more are asked for, and the rest are counted', () => {
  const root = tree(acme(RANKED_FILES))

  const result = resolve(root, 'PROJ-20')

  assert.deepEqual(result.stdout.split('\n').slice(8, 11), [
    `- docs/runbook.md (${Buffer.byteLength(RANKED_FILES['docs/runbook.md'])} B) linked from the work item`,
    '1 more linked note is not listed; context-central resolve PROJ-20 --max 20 lists it.',
    `Deep tier: 1 file (${Buffer.byteLength(RANKED_FILES['work/PROJ-20/sources/01-ticket.md'])} B) under work/PROJ-20/sources, not listed one by one.`,
  ])
  assert.equal(resolved(root, 'PROJ-20').more, 1)
})

test('several notes left over are counted in the plural', () => {
  const root = tree(acme(RANKED_FILES))

  const result = resolve(root, 'PROJ-20', '--max', '5')

  assert.match(result.stdout, /^2 more linked notes are not listed; context-central resolve PROJ-20 --max 20 lists them\.$/m)
})

test('the estate sets how many notes follow the entry file', () => {
  const root = tree(acme(RANKED_FILES, { budgets: { resolveMax: 2 } }))

  assert.deepEqual(rels(resolved(root, 'PROJ-20')), ['work/PROJ-20/STATE.md', 'work/PROJ-20/SPEC.md', 'concepts/gateway.md', 'edges/web-api.md'])
})

test('a limit that is not a whole number is refused', () => {
  const root = tree(acme())

  assert.equal(resolve(root, 'PROJ-12', '--max', 'lots').code, 2)
})

test('sizes of a kilobyte or more are shown in kilobytes', () => {
  const root = tree(acme({ 'concepts/gateway.md': `# The gateway\n\n${'x'.repeat(2034)}` }))

  assert.match(resolve(root, 'PROJ-12').stdout, /^- concepts\/gateway\.md \(2\.0 KB\) linked from the work item$/m)
})

test('deep files spread through an item are counted under the folder they share', () => {
  const root = tree(acme({ 'work/PROJ-12/notes/02-2026-01-11-thread-full-text.md': '12345' }))

  const { deep } = resolved(root, 'PROJ-12')

  assert.equal(deep.count, 2)
  assert.equal(deep.bytes, sizeOf('work/PROJ-12/sources/01-2026-01-09-PROJ-12-full-text.md') + 5)
  assert.equal(deep.rel, 'work/PROJ-12')
})

test('a repo name resolves to its note and the notes that links to', () => {
  const root = tree(acme())

  const result = resolve(root, 'how', 'does', 'web', 'reach', 'the', 'back', 'end')

  assert.equal(
    result.stdout,
    [
      'Context for repo web:',
      `- repos/web.md (${sizeOf('repos/web.md')} B) repo note`,
      `- concepts/gateway.md (${sizeOf('concepts/gateway.md')} B) linked from the repo note`,
      `- repos/api.md (${sizeOf('repos/api.md')} B) linked from the repo note`,
      '',
    ].join('\n'),
  )
})

test('a repo answer names the repo in its key and has no item', () => {
  const root = tree(acme())

  const resolution = resolved(root, 'web')

  assert.deepEqual([resolution.by, resolution.key, resolution.item, resolution.deep], ['repo', 'repo:web', null, null])
})

test('a repo name inside a longer word is not a match', () => {
  const root = tree(acme())

  assert.equal(resolved(root, 'the', 'web-api', 'webhook'), null)
})

test('a registered repo with no note falls through', () => {
  const root = tree(acme({}, { repos: ['web', 'api', 'mobile'] }))

  assert.equal(resolved(root, 'mobile'), null)
})

test('a PR link resolves to the work item whose notes mention it', () => {
  const root = tree(acme({ 'work/PROJ-12/notes/2026-01-12-pr.md': '# PR\n\nRaised as https://github.com/acme/api/pull/7 on Monday.\n' }))

  const resolution = resolved(root, 'review', 'https://github.com/acme/api/pull/7', 'please')

  assert.deepEqual([resolution.by, resolution.key, resolution.item], ['pr', 'item:PROJ-12', 'PROJ-12'])
  assert.equal(resolution.pointers[0].rel, 'work/PROJ-12/STATE.md')
})

test('a PR link is not matched by a longer PR number', () => {
  const root = tree(acme({ 'work/PROJ-12/notes/2026-01-12-pr.md': '# PR\n\nRaised as https://github.com/acme/elsewhere/pull/71.\n' }))

  assert.equal(resolved(root, 'https://github.com/acme/elsewhere/pull/7'), null)
})

test('a PR link found only in the deep tier does not count', () => {
  const root = tree(acme({ 'work/PROJ-12/sources/02-pr-full-text.md': 'https://github.com/acme/elsewhere/pull/7\n' }))

  assert.equal(resolved(root, 'https://github.com/acme/elsewhere/pull/7'), null)
})

test('a PR link no work item mentions resolves to the note of its repo', () => {
  const root = tree(acme())

  const resolution = resolved(root, 'https://github.com/acme/web/pull/3')

  assert.deepEqual([resolution.by, resolution.key, resolution.label], ['pr', 'repo:web', 'repo web'])
  assert.deepEqual(
    resolution.pointers.map(pointer => [pointer.rel, pointer.why]),
    [
      ['repos/web.md', 'repo note'],
      ['concepts/gateway.md', 'linked from the repo note'],
      ['repos/api.md', 'linked from the repo note'],
    ],
  )
})

function oneItemMap() {
  const root = smallMap({})
  run(['work', 'new', 'order-export-rework', '--title', 'Rebuild the order export'], { cwd: root })
  return root
}

test('an item name written with spaces resolves to the item, alone or inside a sentence', () => {
  const root = tree(oneItemMap())

  assert.equal(resolve(root, 'order', 'export', 'rework').stdout.split('\n')[0], 'Context for work item order-export-rework:')
  assert.equal(resolved(root, 'carry', 'on', 'with', 'the', 'order', 'export', 'rework').key, 'item:order-export-rework')
})

test('an item name inside a longer hyphenated word or a path resolves to the item, as it does written with spaces', () => {
  const root = tree(oneItemMap())

  assert.equal(resolved(root, 'the', 'order', 'export', 'rework', 'v2', 'idea').key, 'item:order-export-rework')
  assert.equal(resolved(root, 'the', 'order-export-rework-v2', 'idea').key, 'item:order-export-rework')
  assert.equal(resolved(root, 'open', 'src/order/export/rework/index.js').key, 'item:order-export-rework')
  assert.equal(resolved(root, 'the', 'order-export-reworking', 'idea'), null)
})

test('an item title word for word resolves to the item, whatever its case, hyphens or punctuation', () => {
  const root = tree(oneItemMap())

  assert.equal(resolve(root, 'Rebuild', 'the', 'order', 'export').stdout.split('\n')[0], 'Context for work item order-export-rework:')
  assert.equal(resolved(root, 'where', 'are', 'we', 'on', 'rebuild', 'the', 'order', 'export?').key, 'item:order-export-rework')
  assert.equal(resolved(root, 'REBUILD', 'the', 'order-export!').key, 'item:order-export-rework')
  assert.equal(resolved(root, 'rebuild', 'the', 'big', 'order', 'export').by, 'text')
})

test('a query that is exactly a one-word title resolves to the item, and the word inside a sentence does not', () => {
  const root = tree(smallMap({}))
  run(['work', 'new', 'PROJ-14', '--title', 'Checkout'], { cwd: root })

  assert.equal(resolved(root, 'checkout').key, 'item:PROJ-14')
  assert.equal(resolved(root, ' Checkout! ').key, 'item:PROJ-14')
  assert.equal(resolved(root, 'mend', 'the', 'checkout'), null)
})

const TWO_ITEMS = {
  'work/order-export-rework/STATE.md': '---\nitem: order-export-rework\ntitle: Rebuild the order export\nstatus: active\n---\n# order-export-rework: Rebuild the order export\n',
  'work/PROJ-13/STATE.md': '---\nitem: PROJ-13\ntitle: Cache the gateway\nstatus: active\n---\n# PROJ-13: Cache the gateway\n',
}

test('a key or a name beats a title wherever it stands in the query', () => {
  const root = tree(acme(TWO_ITEMS))

  assert.equal(resolved(root, 'rebuild', 'the', 'order', 'export', 'after', 'PROJ-13').key, 'item:PROJ-13')
  assert.equal(resolved(root, 'cache', 'the', 'gateway', 'before', 'order-export-rework').key, 'item:order-export-rework')
})

test('when a query holds two items by name with spaces or title the one that starts first is the answer', () => {
  const root = tree(acme(TWO_ITEMS))

  assert.equal(resolved(root, 'cache', 'the', 'gateway', 'then', 'rebuild', 'the', 'order', 'export').key, 'item:PROJ-13')
  assert.equal(resolved(root, 'order', 'export', 'rework', 'then', 'cache', 'the', 'gateway').key, 'item:order-export-rework')
})

test("when one item's name with spaces is the start of another's, the longer name answers with its own item", () => {
  const root = tree(
    acme({
      'work/order-export/STATE.md': '# order-export: Send orders out\n',
      'work/order-export-rework/STATE.md': '# order-export-rework: Rebuild it\n',
    }),
  )

  assert.equal(resolved(root, 'the', 'order', 'export', 'rework').key, 'item:order-export-rework')
  assert.equal(resolved(root, 'the', 'order', 'export', 'again').key, 'item:order-export')
})

test('a title that two items share does not resolve to either', () => {
  const root = tree(
    acme({
      'work/PROJ-13/STATE.md': '---\ntitle: Cache the gateway\n---\n# PROJ-13: Cache the gateway\n',
      'work/PROJ-14/STATE.md': '---\ntitle: Cache the gateway\n---\n# PROJ-14: Cache the gateway\n',
    }),
  )

  assert.equal(resolved(root, 'cache', 'the', 'gateway'), null)
})

test('a done item resolves by its title', () => {
  const root = tree(oneItemMap())
  run(['work', 'done', 'order-export-rework'], { cwd: root })

  assert.equal(resolved(root, 'rebuild', 'the', 'order', 'export').key, 'item:order-export-rework')
})

test('an item with no entry file is not an answer by its name with spaces', () => {
  const root = tree(acme({ 'work/order-export-rework/notes/2026-01-02-idea.md': '# An idea\n' }))

  assert.equal(resolved(root, 'order', 'export', 'rework'), null)
})

test('the answer by title is the answer the name gives, field for field', () => {
  const root = tree(acme())

  assert.deepEqual(resolved(root, 'rate', 'limit', 'the', 'gateway'), proj12Answer(root))
})

test('words that all sit in one item name and title resolve to the item when nothing else answers', () => {
  const root = tree(oneItemMap())

  assert.equal(resolve(root, 'order', 'export').stdout.split('\n')[0], 'Context for work item order-export-rework:')
  assert.deepEqual(resolved(root, 'rebuild', 'export'), {
    by: 'item',
    key: 'item:order-export-rework',
    item: 'order-export-rework',
    name: 'order-export-rework',
    label: 'work item order-export-rework',
    pointers: [
      {
        rel: 'work/order-export-rework/STATE.md',
        path: join(root, 'work/order-export-rework/STATE.md'),
        bytes: statSync(join(root, 'work/order-export-rework/STATE.md')).size,
        why: 'state file: where the work stands and what is next',
      },
    ],
    more: 0,
    notes: null,
    deep: null,
    evidence: null,
  })
})

test('one counted word is not enough to resolve to an item by its words', () => {
  const root = tree(oneItemMap())

  assert.equal(resolved(root, 'the', 'export'), null)
})

test('a query with one word outside the item name and title does not resolve to the item', () => {
  const root = tree(oneItemMap())

  assert.equal(resolved(root, 'rebuild', 'the', 'server'), null)
})

test('words that sit in the names or titles of two items resolve to neither', () => {
  const root = tree(
    acme({
      'work/order-export-rework/STATE.md': '# order-export-rework: Rebuild the order export\n',
      'work/order-import/STATE.md': '# order-import: Rebuild the order import\n',
    }),
  )

  assert.equal(resolved(root, 'rebuild', 'order'), null)
  assert.equal(resolved(root, 'rebuild', 'import').key, 'item:order-import')
})

test('an item with no entry file is not an answer by its words', () => {
  const root = tree(acme({ 'work/order-export-rework/notes/2026-01-02-idea.md': '# An idea\n' }))

  assert.equal(resolved(root, 'export', 'rework'), null)
})

test('a query that free text answers keeps that answer though its words all sit in one item title', () => {
  const root = tree(
    acme({
      'work/order-export-rework/STATE.md': '---\ntitle: Rebuild the order export\n---\n# order-export-rework\n',
      'concepts/order-export.md': '# Order export\n\nA nightly file of orders.\n',
    }),
  )

  const resolution = resolved(root, 'order', 'export')

  assert.equal(resolution.by, 'text')
  assert.deepEqual(rels(resolution), ['concepts/order-export.md'])
})

const BILLING_NOTE = '# Billing retries\n\nFailed card payments are retried through the gateway.\n'
const BILLING_RUNBOOK = '# Runbook for billing\n\nRetries are logged.\n'

test('a few words resolve to the note whose name and headings carry them', () => {
  const root = tree(acme({ 'concepts/billing-retries.md': BILLING_NOTE }))

  const result = resolve(root, 'how', 'do', 'billing', 'retries', 'behave')

  assert.equal(
    result.stdout,
    ['Context for "how do billing retries behave":', `- concepts/billing-retries.md (${Buffer.byteLength(BILLING_NOTE)} B) matches: billing, retries`, ''].join('\n'),
  )
})

test('every note that clears the bar is returned, best first, and the key lists them', () => {
  const root = tree(
    acme({
      'docs/billing-runbook.md': BILLING_RUNBOOK,
      'concepts/billing-retries.md': BILLING_NOTE,
      'areas/payments.md': '# Payments\n\nBilling happens monthly, with retries.\n',
    }),
  )

  const resolution = resolved(root, 'billing', 'retries')

  assert.deepEqual(rels(resolution), ['concepts/billing-retries.md', 'docs/billing-runbook.md'])
  assert.deepEqual([resolution.by, resolution.item, resolution.deep, resolution.more], ['text', null, null, 0])
  assert.equal(resolution.key, 'text:concepts/billing-retries.md,docs/billing-runbook.md')
  assert.equal(resolution.label, '"billing retries"')
})

test('one matched word is not a confident match', () => {
  const root = tree(acme({ 'concepts/billing-retries.md': BILLING_NOTE }))

  assert.equal(resolved(root, 'billing', 'tomorrow'), null)
})

test('a word that more than four notes in ten share does not count', () => {
  const root = tree(acme({ 'concepts/billing-retries.md': BILLING_NOTE }))

  assert.equal(resolved(root, 'billing', 'gateway'), null)
})

test('a word that only one or two notes carry counts however small the map', () => {
  const root = tree(smallMap({ 'concepts/billing-retries.md': BILLING_NOTE, 'concepts/gateway.md': '# The gateway\n\nEvery call goes through it.\n' }))

  assert.deepEqual(rels(resolved(root, 'billing', 'retries')), ['concepts/billing-retries.md'])
})

test('short words and stop words do not count', () => {
  const root = tree(acme({ 'concepts/billing-retries.md': '# Billing with the card\n\nUp to three tries.\n' }))

  assert.equal(resolved(root, 'billing', 'with', 'the', 'up', 'to'), null)
})

test('the log and the deep tier are never matched by words', () => {
  const root = tree(acme({ 'log/2026-01.md': BILLING_NOTE, 'work/PROJ-12/sources/02-billing-retries.md': BILLING_NOTE }))

  assert.equal(resolved(root, 'billing', 'retries'), null)
})

test('matching notes beyond the limit are counted', () => {
  const root = tree(acme({ 'docs/billing-runbook.md': BILLING_RUNBOOK, 'concepts/billing-retries.md': BILLING_NOTE }))

  const result = resolve(root, 'billing', 'retries', '--max', '1')

  assert.deepEqual(result.stdout.split('\n').slice(1), [
    `- concepts/billing-retries.md (${Buffer.byteLength(BILLING_NOTE)} B) matches: billing, retries`,
    '1 more matching note is not listed; a higher --max lists it.',
    '',
  ])
})

test('a long query is cut short in the first line', () => {
  const root = tree(acme({ 'concepts/billing-retries.md': BILLING_NOTE }))

  const result = resolve(root, 'billing retries and then a great many more words that say nothing useful about anything at all')

  assert.equal(result.stdout.split('\n')[0], 'Context for "billing retries and then a great many more words that say nothing useful abou...":')
})

test("a work item's spec is listed straight after its state file, linked or not", () => {
  const root = tree(acme())

  const resolution = resolved(root, 'PROJ-12')

  assert.deepEqual(rels(resolution).slice(0, 2), ['work/PROJ-12/STATE.md', 'work/PROJ-12/SPEC.md'])
  assert.equal(resolution.pointers[1].why, 'spec of the work item')
})

test('the spec does not use up the cap on linked notes', () => {
  const root = tree(acme())

  const resolution = resolved(root, 'PROJ-12', '--max', '1')

  assert.deepEqual(rels(resolution), ['work/PROJ-12/STATE.md', 'work/PROJ-12/SPEC.md', 'concepts/gateway.md'])
  assert.equal(resolution.more, 1)
})

test("a work item's other notes are counted, not listed", () => {
  const root = tree(acme())
  const note = 'work/PROJ-12/notes/2026-01-10-research-rate-limits.md'

  assert.deepEqual(resolved(root, 'PROJ-12').notes, { count: 1, bytes: sizeOf(note), rel: 'work/PROJ-12', path: join(root, 'work/PROJ-12') })
  assert.match(resolve(root, 'PROJ-12').stdout, new RegExp(`^Other notes of this item: 1 file \\(${sizeOf(note)} B\\) under work/PROJ-12\\.$`, 'm'))
})

test('a link inside a code span is not followed', () => {
  const root = tree(acme({ 'work/PROJ-30/STATE.md': '# PROJ-30\n\nWritten as `[[concepts/gateway]]` in code.\n' }))

  assert.deepEqual(rels(resolved(root, 'PROJ-30')), ['work/PROJ-30/STATE.md'])
})

test('a link whose letter case differs from the file is not followed', () => {
  const root = tree(acme({ 'work/PROJ-31/STATE.md': '# PROJ-31\n\nSee [[Concepts/Gateway]].\n' }))

  assert.deepEqual(rels(resolved(root, 'PROJ-31')), ['work/PROJ-31/STATE.md'])
})

const EVIDENCE = { [ACME_SHOT]: 'x'.repeat(300), 'work/PROJ-12/evidence/2026-01-14-trace.json': 'x'.repeat(50) }

test('an item with evidence gets one line for it after the deep tier', () => {
  const root = tree(acme(EVIDENCE))

  const lines = resolve(root, 'PROJ-12').stdout.split('\n')

  assert.match(lines.at(-3) ?? '', /^Deep tier: /)
  assert.equal(lines.at(-2), 'Evidence: 2 files (350 B) under work/PROJ-12/evidence, not listed one by one.')
})

test('the answer as JSON carries the evidence group with both paths', () => {
  const root = tree(acme(EVIDENCE))

  assert.deepEqual(resolved(root, 'PROJ-12').evidence, { count: 2, bytes: 350, rel: 'work/PROJ-12/evidence', path: join(root, 'work/PROJ-12/evidence') })
})

test('an item without evidence, a repo and free text all answer with no evidence and no line for it', () => {
  const root = tree(acme({ 'concepts/billing-retries.md': BILLING_NOTE }))

  for (const query of ['PROJ-12', 'web', 'billing retries']) {
    assert.equal(resolve(root, query).stdout.startsWith('Context for '), true, query)
    assert.equal(resolved(root, query).evidence, null, query)
    assert.doesNotMatch(resolve(root, query).stdout, /Evidence/, query)
  }
})

test('the evidence line carries an absolute path on request', () => {
  const root = tree(acme(EVIDENCE))

  const result = resolve(root, 'PROJ-12', '--absolute')

  assert.equal(result.stdout.split('\n').at(-2), `Evidence: 2 files (350 B) under ${join(root, 'work/PROJ-12/evidence')}, not listed one by one.`)
})

test('evidence is never matched on words', () => {
  const root = tree(acme({ 'work/PROJ-12/evidence/billing-retries.md': BILLING_NOTE }))

  assert.equal(resolve(root, 'how', 'do', 'billing', 'retries', 'behave').stdout, 'No confident match for "how do billing retries behave".\n')
})

test('on a map made before connections, a pull request link under any organisation still finds its work item', () => {
  const root = tree(acme({ 'work/PROJ-12/notes/2026-01-12-pr.md': '# PR\n\nRaised as https://github.com/elsewhere/api/pull/7 on Monday.\n' }, { codeHost: { type: 'github', org: 'acme', ghUser: 'acme-bot' } }))

  const resolution = resolved(root, 'https://github.com/elsewhere/api/pull/7')

  assert.deepEqual([resolution.by, resolution.item], ['pr', 'PROJ-12'])
})

test('a repo\'s standards note is listed straight after its repo note, however many notes the repo note links', () => {
  const linked = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map(n => [`concepts/idea-${n}.md`, `# Idea ${n}\n`]))
  const repoNote = `# api\n\n${[1, 2, 3, 4, 5, 6, 7].map(n => `[[concepts/idea-${n}]]`).join(' ')}\n`
  const root = tree(acme({ ...linked, 'repos/api.md': repoNote, 'standards/api.md': '# api\n' }))

  const lines = run(['resolve', 'api'], { cwd: root }).stdout.split('\n')

  assert.equal(lines[0], 'Context for repo api:')
  assert.equal(lines[1], `- repos/api.md (${Buffer.byteLength(repoNote)} B) repo note`)
  assert.equal(lines[2], '- standards/api.md (6 B) standards of the repo')
})

test('a repo with no standards note is resolved as before', () => {
  const root = tree(acme())

  assert.deepEqual(run(['resolve', 'api'], { cwd: root }).stdout.split('\n').slice(0, 2), ['Context for repo api:', `- repos/api.md (${Buffer.byteLength(ACME_FILES['repos/api.md'])} B) repo note`])
})

test('a repo note that links its own standards note has it listed once, as the standards', () => {
  const repoNote = '# api\n\nSee [[standards/api]] and [[concepts/gateway]].\n'
  const root = tree(acme({ 'repos/api.md': repoNote, 'standards/api.md': '# api\n' }))

  const lines = run(['resolve', 'api'], { cwd: root }).stdout.trimEnd().split('\n')

  assert.deepEqual(lines, [
    'Context for repo api:',
    `- repos/api.md (${Buffer.byteLength(repoNote)} B) repo note`,
    '- standards/api.md (6 B) standards of the repo',
    `- concepts/gateway.md (${Buffer.byteLength(ACME_FILES['concepts/gateway.md'])} B) linked from the repo note`,
  ])
})

test('a folder where the standards note would be is not a note', () => {
  const root = tree(acme({ 'standards/api.md/readme.md': '# not a note\n' }))

  assert.deepEqual(run(['resolve', 'api'], { cwd: root }).stdout.split('\n').slice(0, 3), ['Context for repo api:', `- repos/api.md (${Buffer.byteLength(ACME_FILES['repos/api.md'])} B) repo note`, ''])
})

const ONE_GATEWAY = '---\nid: ADR-12\naliases: gateway-rfc, rfc7\n---\n# 0007: One gateway\n\nEvery call goes through it.\n'
const KNOWN = { 'decisions/0007-one-gateway.md': ONE_GATEWAY }
const answer = (root: string, ...words: string[]) => {
  const found = resolved(root, ...words) as Resolution | null
  return found && [found.by, found.key, ...found.pointers.map(pointer => pointer.why)]
}

test('a node is found by the id in its frontmatter, alone or inside a sentence, whatever its case', () => {
  const root = tree(acme(KNOWN))

  const result = resolve(root, 'adr-12')

  assert.equal(result.stdout, ['Context for "adr-12":', `- decisions/0007-one-gateway.md (${Buffer.byteLength(ONE_GATEWAY)} B) known as: ADR-12`, ''].join('\n'))
  assert.deepEqual(answer(root, 'what', 'did', 'ADR', '12', 'settle'), ['id', 'node:decisions/0007-one-gateway.md', 'known as: ADR-12'])
})

test('a node is found by each of its aliases, and one of a single word only when it is the whole question', () => {
  const root = tree(acme(KNOWN))

  assert.deepEqual(answer(root, 'the', 'gateway-rfc', 'again'), ['id', 'node:decisions/0007-one-gateway.md', 'known as: gateway-rfc'])
  assert.deepEqual(answer(root, 'RFC7'), ['id', 'node:decisions/0007-one-gateway.md', 'known as: rfc7'])
  assert.equal(answer(root, 'see', 'rfc7', 'again'), null)
})

test('an id or an alias of digits alone names nothing', () => {
  const root = tree(acme({ 'concepts/limits.md': '---\nid: 41\naliases: 0041\n---\n# Per-route caps\n' }))

  assert.equal(answer(root, '41'), null)
  assert.equal(answer(root, 'see', '0041', 'please'), null)
})

test('a numbered node is known by its kind and its number, with or without the final s and the leading zeros', () => {
  const root = tree(acme(KNOWN))

  assert.deepEqual(answer(root, 'decision', '7'), ['id', 'node:decisions/0007-one-gateway.md', 'known as: decision 7'])
  assert.deepEqual(answer(root, 'what', 'did', 'decisions', '0007', 'say'), ['id', 'node:decisions/0007-one-gateway.md', 'known as: decisions 7'])
  assert.equal(answer(root, 'decision', '8'), null)
})

test('a number alone names nothing, and a file that starts with a date is not a numbered node', () => {
  const root = tree(acme({ ...KNOWN, 'docs/2026-01-05-retro.md': '# Looking back\n' }))

  assert.equal(answer(root, '7'), null)
  assert.equal(answer(root, '0007'), null)
  assert.equal(answer(root, 'doc', '2026'), null)
  assert.equal(answer(root, 'docs', '2026'), null)
})

test('nodes that share an identifier are all listed, and those beyond the limit are counted', () => {
  const root = tree(acme({ ...KNOWN, 'concepts/edge-gateway.md': '---\naliases: gateway-rfc\n---\n# The edge\n' }))

  assert.deepEqual(answer(root, 'gateway-rfc'), ['id', 'node:concepts/edge-gateway.md,decisions/0007-one-gateway.md', 'known as: gateway-rfc', 'known as: gateway-rfc'])
  assert.equal(resolve(root, 'gateway-rfc', '--max', '1').stdout.split('\n')[2], '1 more matching note is not listed; a higher --max lists it.')
})

test('an identifier answers only where it leaves a counted word in the question', () => {
  const root = tree(acme({ 'concepts/list.md': '---\naliases: to-do\n---\n# What is left\n' }))

  assert.equal(answer(root, 'to-do'), null)
})

test('an identifier in the work folder, the log or the deep tier is never matched', () => {
  const marked = (id: string) => `---\nid: ${id}\n---\n# Marked\n`
  const root = tree(acme({ 'work/PROJ-12/notes/marked.md': marked('NOTE-1'), 'log/2026-01.md': marked('LOG-1'), 'docs/sources/marked.md': marked('DEEP-1') }))

  assert.equal(answer(root, 'note-1'), null)
  assert.equal(answer(root, 'log-1'), null)
  assert.equal(answer(root, 'deep-1'), null)
})

test('an identifier answers only where no route of today does', () => {
  const root = tree(
    acme({
      'concepts/billing-retries.md': `---\nid: proj-12-design\naliases: billing-retries, web\n---\n${BILLING_NOTE}`,
      'docs/billing-runbook.md': BILLING_RUNBOOK,
    }),
  )

  assert.equal(resolved(root, 'proj-12-design').key, 'item:PROJ-12')
  assert.equal(resolved(root, 'web').key, 'repo:web')
  assert.equal(resolved(root, 'billing', 'retries').by, 'text')
})

test("a node is found by its file name when that is the whole of the question's counted words", () => {
  const root = tree(acme())

  const result = resolve(root, 'what', 'is', 'the', 'gateway')

  assert.equal(result.stdout, ['Context for "what is the gateway":', `- concepts/gateway.md (${sizeOf('concepts/gateway.md')} B) named: gateway`, ''].join('\n'))
  assert.deepEqual(answer(root, 'Gateway'), ['name', 'node:concepts/gateway.md', 'named: gateway'])
  assert.equal(answer(root, 'the', 'gateway', 'rules'), null)
})

test('a node is found by its title, which is the title in its frontmatter before its first heading', () => {
  const root = tree(acme({ 'concepts/caps.md': '---\ntitle: Throttling\n---\n# Ceilings\n', 'concepts/queue.md': '# Backlog\n' }))

  assert.deepEqual(answer(root, 'throttling'), ['name', 'node:concepts/caps.md', 'named: throttling'])
  assert.deepEqual(answer(root, 'the', 'backlog'), ['name', 'node:concepts/queue.md', 'named: backlog'])
  assert.equal(answer(root, 'ceilings'), null)
})

test("a numbered node's name counts with its number and without it", () => {
  const root = tree(smallMap({ 'decisions/0007-doorway.md': '# 0007: Doorway\n' }))

  assert.deepEqual(answer(root, 'doorway'), ['name', 'node:decisions/0007-doorway.md', 'named: doorway'])
  assert.deepEqual(answer(root, '0007', 'doorway'), ['name', 'node:decisions/0007-doorway.md', 'named: 0007 doorway'])
  assert.equal(answer(root, '0008', 'doorway'), null)
})

test('several nodes of one name are all listed, up to the limit', () => {
  const root = tree(acme({ 'docs/gateway.md': '# Running it\n', 'areas/edge.md': '# Gateway\n' }))

  assert.deepEqual(answer(root, 'gateway'), ['name', 'node:concepts/gateway.md,areas/edge.md,docs/gateway.md', 'named: gateway', 'named: gateway', 'named: gateway'])
  assert.deepEqual(rels(resolved(root, 'gateway', '--max', '2')), ['concepts/gateway.md', 'areas/edge.md'])
})

test('a name answers only where it leaves a counted word, and never from the work folder or the log', () => {
  const root = tree(acme({ 'concepts/todo.md': '# To do\n', 'log/2026-01.md': '# January\n', 'work/PROJ-12/notes/plan.md': '# Plan\n' }))

  assert.equal(answer(root, 'to', 'do'), null)
  assert.equal(answer(root, 'january'), null)
  assert.equal(answer(root, 'plan'), null)
})

test('a name answers only where no route of today does, and after an identifier', () => {
  const root = tree(acme({ 'work/gateway/STATE.md': '# gateway: Replace the gateway\n', 'docs/limits.md': '---\naliases: caps\n---\n# Limits\n', 'concepts/caps.md': '# Caps\n' }))

  assert.equal(resolved(root, 'gateway').key, 'item:gateway')
  assert.equal(resolved(root, 'web').key, 'repo:web')
  assert.deepEqual(answer(root, 'caps'), ['id', 'node:docs/limits.md', 'known as: caps'])
})

const GLOSSARY = [
  '# Glossary',
  '',
  "The estate's terms.",
  '',
  '```',
  '**Example**: What it means.',
  '```',
  '',
  '**Rate limit**: The most calls a client may make in a minute.',
  '_Avoid_: throttle',
  '',
  '- **Token bucket:** How the limit is counted.',
  '',
  '## Cut-over',
  '',
  'The day billing moves.',
  '',
].join('\n')

test('a term of the glossary is found, alone or inside a question, with the line it is on', () => {
  const root = tree(acme({ 'glossary.md': GLOSSARY }))

  const result = resolve(root, 'what', 'is', 'a', 'token', 'bucket')

  assert.equal(result.stdout, ['Context for "what is a token bucket":', `- glossary.md (${Buffer.byteLength(GLOSSARY)} B) defines: Token bucket, line 12`, ''].join('\n'))
  assert.deepEqual(answer(root, 'Token', 'Bucket'), ['term', 'term:Token bucket', 'defines: Token bucket, line 12'])
})

test('a heading below the first is a term, and the first heading and a line in a code block are not', () => {
  const root = tree(acme({ 'glossary.md': GLOSSARY }))

  assert.deepEqual(answer(root, 'cut-over'), ['term', 'term:Cut-over', 'defines: Cut-over, line 14'])
  assert.equal(answer(root, 'glossary'), null)
  assert.equal(answer(root, 'example'), null)
})

test('a term must be the whole of the question, and a map with no glossary has none', () => {
  assert.equal(answer(tree(acme({ 'glossary.md': GLOSSARY })), 'token', 'bucket', 'sizes'), null)
  assert.equal(answer(tree(acme()), 'token', 'bucket'), null)
})

test('on the command line a term that is also the words of one item still answers with the item', () => {
  const root = tree(acme({ 'glossary.md': GLOSSARY }))

  assert.equal(resolved(root, 'rate', 'limit').key, 'item:PROJ-12')
})

test('a term answers after a node of the same name', () => {
  const root = tree(acme({ 'glossary.md': `${GLOSSARY}\n**Gateway**: The one door.\n` }))

  assert.deepEqual(answer(root, 'gateway'), ['name', 'node:concepts/gateway.md', 'named: gateway'])
})

test("a term is found in the glossary the estate names, which is given by its path from the map's folder", () => {
  const terms = '# Terms\n\n**Token bucket**: How the limit is counted.\n'
  const named = tree(acme({ 'docs/terms.md': terms }, { glossary: 'docs/terms.md' }))
  const outside = tree(makeTree({ '.context-central/estate.json': { contextCentral: 1, name: 'solo', glossary: 'CONTEXT.md' }, 'CONTEXT.md': terms }))

  assert.deepEqual(rels(resolved(named, 'token', 'bucket')), ['docs/terms.md'])
  assert.deepEqual(rels(resolved(outside, 'token', 'bucket')), ['../CONTEXT.md'])
})
