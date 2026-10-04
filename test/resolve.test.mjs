import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { ACME_FILES, acme, disposable, run } from './helpers.mjs'

const tree = disposable()

const sizeOf = rel => Buffer.byteLength(ACME_FILES[rel])
const resolve = (root, ...args) => run(['resolve', ...args], { cwd: root })
const resolved = (root, ...args) => JSON.parse(resolve(root, ...args, '--json').stdout)
const rels = resolution => resolution.pointers.map(pointer => pointer.rel)

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

  assert.deepEqual(resolved(root, 'PROJ-12'), {
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
  })
})

test('absolute paths are printed on request', () => {
  const root = tree(acme())

  const result = resolve(root, 'PROJ-12', '--absolute')

  assert.match(result.stdout, new RegExp(`^- ${join(root, 'work/PROJ-12/STATE.md')} \\(`, 'm'))
  assert.match(result.stdout, new RegExp(` under ${join(root, 'work/PROJ-12/sources')}, not listed one by one`))
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

  assert.equal(resolved(root, 'look', 'at', 'PROJ-123'), null)
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

  assert.deepEqual(rels(JSON.parse(result.stdout)), ['work/PROJ-40/STATE.md', 'concepts/inside.md'])
})

test('an item name shorter than five characters is never matched as a word', () => {
  const root = tree(acme({ 'work/next/STATE.md': '# next: What comes next\n' }))

  assert.equal(resolved(root, 'what', 'comes', 'next'), null)
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

  const result = resolve(root, 'PROJ-99', 'tomorrow')

  assert.equal(result.code, 0)
  assert.equal(result.stdout, 'No confident match for "PROJ-99 tomorrow".\n')
  assert.equal(resolved(root, 'PROJ-99', 'tomorrow'), null)
})

test('the answer as JSON ends cleanly whether or not there is a match', () => {
  const root = tree(acme())

  const found = resolve(root, 'PROJ-12', '--json')
  const missed = resolve(root, 'PROJ-99', 'tomorrow', '--json')

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

const EVIDENCE = { 'work/PROJ-12/evidence/2026-01-14-limit-reached.png': 'x'.repeat(300), 'work/PROJ-12/evidence/2026-01-14-trace.json': 'x'.repeat(50) }

test('an item with evidence gets one line for it after the deep tier', () => {
  const root = tree(acme(EVIDENCE))

  const lines = resolve(root, 'PROJ-12').stdout.split('\n')

  assert.match(lines.at(-3), /^Deep tier: /)
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
