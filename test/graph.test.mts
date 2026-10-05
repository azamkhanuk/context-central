import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ACME_FILES, ACME_SHOT, acme, disposable, makeTree, run } from './helpers.mts'

const tree = disposable()

const graph = (root: string, ...flags: string[]) => run(['graph', ...flags], { cwd: root })
const DEEP = 'work/PROJ-12/sources/01-2026-01-09-PROJ-12-full-text.md'
const TIDY = {
  'estate.json': { contextCentral: 1, name: 'acme' },
  'CLAUDE.md': '# Acme estate\n\nStart at [[concepts/gateway]].\n',
  'concepts/gateway.md': '# The gateway\n\nSee [[edges/web-api]].\n',
  'edges/web-api.md': '# web to api\n',
}

test('the graph counts nodes and links and reports what nothing points at', () => {
  const root = tree(acme())

  const result = graph(root)

  assert.equal(
    result.stdout,
    [
      '7 nodes, 5 links',
      'ORPHAN repos/web.md',
      `UNREFERENCED ${DEEP}`,
      '',
    ].join('\n'),
  )
  assert.equal(result.code, 0)
})

test('a wiki link to a note that does not exist is broken and fails the run', () => {
  const root = tree(acme({ 'repos/web.md': '# web\n\nTalks through [[concepts/missing]].\n' }))

  const result = graph(root)

  assert.match(result.stdout, /^BROKEN repos\/web\.md -> concepts\/missing$/m)
  assert.equal(result.code, 1)
})

test('a relative Markdown link to a note that does not exist is broken', () => {
  const root = tree(acme({ 'repos/api.md': '# api\n\nSee [the limits](../concepts/limits.md).\n' }))

  const result = graph(root)

  assert.match(result.stdout, /^BROKEN repos\/api\.md -> \.\.\/concepts\/limits\.md$/m)
  assert.equal(result.code, 1)
})

test('a broken link in the hub is reported against the hub', () => {
  const root = tree(acme({ 'CLAUDE.md': '# Acme estate\n\nStart at [[concepts/nowhere]].\n' }))

  assert.match(graph(root).stdout, /^BROKEN CLAUDE\.md -> concepts\/nowhere$/m)
})

test('a broken link inside a deep file is not reported', () => {
  const root = tree(acme({ [DEEP]: '# PROJ-12 full text\n\nQuoted: [[concepts/long-gone]].\n' }))

  const result = graph(root)

  assert.doesNotMatch(result.stdout, /BROKEN/)
  assert.equal(result.code, 0)
})

test('a note the hub links to is not an orphan', () => {
  const root = tree(acme({ 'CLAUDE.md': '# Acme estate\n\nThe front end is [[repos/web]].\n' }))

  assert.doesNotMatch(graph(root).stdout, /ORPHAN repos\/web\.md/)
})

test('a note that only links to itself is still an orphan', () => {
  const root = tree(acme({ 'concepts/loop.md': '# Loop\n\nSee [[concepts/loop]].\n' }))

  assert.match(graph(root).stdout, /^ORPHAN concepts\/loop\.md$/m)
})

test('log notes and work item entry files are never orphans', () => {
  const root = tree(acme({ 'log/2026-01.md': '# January\n', 'work/PROJ-7.md': '# PROJ-7: Old shape\n' }))

  const result = graph(root)

  assert.doesNotMatch(result.stdout, /ORPHAN log\//)
  assert.doesNotMatch(result.stdout, /ORPHAN work\/PROJ-7\.md/)
  assert.doesNotMatch(result.stdout, /ORPHAN work\/PROJ-12\/STATE\.md/)
})

test('a deep file named in a note is referenced', () => {
  const state = `${ACME_FILES['work/PROJ-12/STATE.md']}\nFull ticket: \`sources/01-2026-01-09-PROJ-12-full-text.md\`.\n`
  const root = tree(acme({ 'work/PROJ-12/STATE.md': state }))

  assert.doesNotMatch(graph(root).stdout, /UNREFERENCED/)
})

test('a deep file named in the hub is referenced', () => {
  const root = tree(acme({ 'CLAUDE.md': '# Acme estate\n\nThe ticket is in 01-2026-01-09-PROJ-12-full-text.md.\n' }))

  assert.doesNotMatch(graph(root).stdout, /UNREFERENCED/)
})

test('a deep file named only by another deep file is unreferenced', () => {
  const root = tree(acme({ 'work/PROJ-12/sources/02-thread.md': '# Thread\n\nFollows 01-2026-01-09-PROJ-12-full-text.md.\n' }))

  const result = graph(root)

  assert.match(result.stdout, new RegExp(`^UNREFERENCED ${DEEP}$`, 'm'))
  assert.match(result.stdout, /^UNREFERENCED work\/PROJ-12\/sources\/02-thread\.md$/m)
})

test('a deep file a note links to is referenced', () => {
  const root = tree(acme({ 'repos/api.md': '# api\n\nThe ticket: [[work/PROJ-12/sources/01-2026-01-09-PROJ-12-full-text]].\n' }))

  assert.doesNotMatch(graph(root).stdout, /UNREFERENCED/)
})

test('a deep file is not referenced by a word that happens to be its name', () => {
  const root = tree(acme({ 'work/PROJ-12/sources/api.md': '# What api returned\n' }))

  assert.match(graph(root).stdout, /^UNREFERENCED work\/PROJ-12\/sources\/api\.md$/m)
})

test('a wiki link, a labelled one, one to a heading and a relative path each count as a link', () => {
  const root = tree(
    makeTree({
      ...TIDY,
      'concepts/a.md': '# A\n',
      'concepts/b.md': '# B\n',
      'concepts/c.md': '# C\n',
      'concepts/d.md': '# D\n',
      'edges/web-api.md': '# web to api\n\n[[concepts/a]], [[concepts/b|the second]], [[concepts/c#part]] and [the fourth](../concepts/d.md#part).\n',
    }),
  )

  const result = graph(root, '--strict')

  assert.equal(result.stdout, '6 nodes, 5 links\n')
  assert.equal(result.code, 0)
})

test('a link shown inside a code span or a code fence is not a link', () => {
  const api = '# api\n\nWrite a link as `[[concepts/name]]`.\n\n```sh\nif [[ -f limits ]]; then echo found; fi\n```\n'
  const root = tree(acme({ 'repos/api.md': api }))

  const result = graph(root)

  assert.doesNotMatch(result.stdout, /BROKEN/)
  assert.equal(result.code, 0)
})

test('a relative link with an encoded space reaches the note', () => {
  const root = tree(acme({ 'concepts/rate limits.md': '# Rate limits\n', 'repos/api.md': '# api\n\nSee [the limits](../concepts/rate%20limits.md).\n' }))

  const result = graph(root)

  assert.doesNotMatch(result.stdout, /BROKEN/)
  assert.doesNotMatch(result.stdout, /ORPHAN concepts\/rate limits\.md/)
})

test('a hub outside the note folders saves the notes it links to by relative path', () => {
  const root = tree(acme({ 'guide/START.md': '# Acme estate\n\nThe front end is [web](../repos/web.md).\n' }, { hub: 'guide/START.md' }))

  assert.doesNotMatch(graph(root).stdout, /ORPHAN repos\/web\.md/)
})

test("in a map inside a repo, the hub's relative links are read from the repo's root", () => {
  const root = tree(
    makeTree({
      '.context-central/estate.json': { contextCentral: 1, name: 'solo' },
      '.context-central/repos/web.md': '# web\n',
      'CLAUDE.md': '# Solo\n\nThe front end is [web](.context-central/repos/web.md), once [gone](.context-central/repos/gone.md).\n',
    }),
  )

  const result = graph(root)

  assert.equal(result.stdout, '1 node, 0 links\nBROKEN CLAUDE.md -> .context-central/repos/gone.md\n')
})

test('a hub kept among the notes is not an orphan and its broken link is reported once', () => {
  const root = tree(makeTree({ ...TIDY, 'estate.json': { contextCentral: 1, name: 'acme', hub: 'docs/index.md' }, 'docs/index.md': '# Acme estate\n\n[[concepts/gateway]] and [[concepts/nowhere]].\n' }))

  const result = graph(root)

  assert.equal(result.stdout, '3 nodes, 2 links\nBROKEN docs/index.md -> concepts/nowhere\n')
})

test('a hub path that is a folder is treated as no hub', () => {
  const root = tree(makeTree({ ...TIDY, 'estate.json': { contextCentral: 1, name: 'acme', hub: 'guide' }, 'guide/readme.md': '# Guide\n' }))

  const result = graph(root)

  assert.equal(result.stdout, '2 nodes, 1 link\nORPHAN concepts/gateway.md\n')
  assert.equal(result.code, 0)
})

test('strict fails the run on orphans and unreferenced files', () => {
  const root = tree(acme())

  assert.equal(graph(root, '--strict').code, 1)
})

test('a map with nothing to report passes strict', () => {
  const root = tree(makeTree(TIDY))

  const result = graph(root, '--strict')

  assert.equal(result.stdout, '2 nodes, 1 link\n')
  assert.equal(result.code, 0)
})

test('the same link written twice counts once', () => {
  const root = tree(makeTree({ ...TIDY, 'concepts/gateway.md': '# The gateway\n\nSee [[edges/web-api]] and [the edge](../edges/web-api.md).\n' }))

  assert.equal(graph(root).stdout, '2 nodes, 1 link\n')
})

test('json carries the counts and each list', () => {
  const root = tree(acme({ 'repos/web.md': '# web\n\nTalks to [[repos/api]] through [[concepts/missing]].\n' }))

  const result = graph(root, '--json')

  assert.deepEqual(JSON.parse(result.stdout) as unknown, {
    nodes: 7,
    links: 4,
    broken: [{ from: 'repos/web.md', target: 'concepts/missing' }],
    orphans: ['repos/web.md'],
    unreferenced: [DEEP],
  })
  assert.equal(result.code, 1)
})

test('outside a map the graph says there is none', () => {
  const root = tree(makeTree({ 'notes.md': '# Notes\n' }))

  const result = graph(root)

  assert.equal(result.code, 1)
  assert.match(result.stderr, /no context map found/)
})

test("the notes in a work item's folder are not orphans", () => {
  const root = tree(acme())

  const result = graph(root)

  assert.doesNotMatch(result.stdout, /ORPHAN work\/PROJ-12\//)
})


test('an evidence file that nothing names is unreferenced', () => {
  const root = tree(acme({ [ACME_SHOT]: 'x'.repeat(300) }))

  const result = graph(root)

  assert.equal(result.stdout, ['7 nodes, 5 links', 'ORPHAN repos/web.md', `UNREFERENCED ${DEEP}`, `UNREFERENCED ${ACME_SHOT}`, ''].join('\n'))
  assert.equal(result.code, 0)
})

test('an evidence file named in a note, in the state file or in the hub is referenced', () => {
  const inNote = tree(acme({ [ACME_SHOT]: 'x', 'work/PROJ-12/notes/2026-01-14-evidence.md': '# Evidence\n\n- `2026-01-14-limit-reached.png`: the limit reached, at abc1234.\n' }))
  const inState = tree(acme({ [ACME_SHOT]: 'x', 'work/PROJ-12/STATE.md': `${ACME_FILES['work/PROJ-12/STATE.md']}\nSee evidence/2026-01-14-limit-reached.png.\n` }))
  const inHub = tree(acme({ [ACME_SHOT]: 'x', 'CLAUDE.md': '# Acme estate\n\nThe shot is 2026-01-14-limit-reached.png.\n' }))

  for (const root of [inNote, inState, inHub]) assert.doesNotMatch(graph(root).stdout, /UNREFERENCED work\/PROJ-12\/evidence/)
})

test('an evidence file named only by a deep file or by another evidence file is unreferenced', () => {
  const root = tree(
    acme({
      [ACME_SHOT]: 'x',
      'work/PROJ-12/sources/02-thread.md': '# Thread\n\nShown in 2026-01-14-limit-reached.png.\n',
      'work/PROJ-12/evidence/2026-01-14-list.md': '# List\n\n2026-01-14-limit-reached.png and 2026-01-14-list.md, see [[concepts/missing]].\n',
    }),
  )

  const result = graph(root)

  assert.match(result.stdout, new RegExp(`^UNREFERENCED ${ACME_SHOT}$`, 'm'))
  assert.match(result.stdout, /^UNREFERENCED work\/PROJ-12\/evidence\/2026-01-14-list\.md$/m)
})

test('evidence is never a node and is never read for a link', () => {
  const root = tree(acme({ [ACME_SHOT]: 'x', 'work/PROJ-12/evidence/2026-01-14-list.md': '# List\n\nSee [[concepts/missing]] and [[repos/web]].\n' }))

  const result = graph(root)

  assert.equal(result.stdout.split('\n')[0], '7 nodes, 5 links')
  assert.doesNotMatch(result.stdout, /BROKEN/)
  assert.match(result.stdout, /^ORPHAN repos\/web\.md$/m)
  assert.equal(result.code, 0)
})

test('strict fails the run on an evidence file nothing names, in an item that is done too', () => {
  const root = tree(makeTree({ ...TIDY, 'work/PROJ-12/STATE.md': '---\nstatus: done\n---\n# PROJ-12\n', [ACME_SHOT]: 'x' }))

  assert.equal(graph(root).code, 0)
  assert.equal(graph(root, '--strict').code, 1)
  assert.deepEqual(JSON.parse(graph(root, '--json').stdout) as unknown, { nodes: 3, links: 1, broken: [], orphans: [], unreferenced: [ACME_SHOT] })
})
