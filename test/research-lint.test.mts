import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { ACME_FILES, acme, checkout, disposable, git, makeTree, notOnWindows, run } from './helpers.mts'
import type { Json, TreeFiles } from './helpers.mts'

const tree = disposable()

const DIR = 'research/gateway-limits'
const OK = { code: 0, stdout: 'ok\n', stderr: '' }
const BY_MODE = process.getuid?.() === 0 ? { skip: 'root reads a file whatever its mode' } : notOnWindows('a file on Windows is not closed to reading by its mode')
const HEAD = ['---', 'research: gateway-limits', 'title: How the gateway limits a shop', '---', '# How the gateway limits a shop', '', '## Facts', '']
const LOG_HEAD = ['# The log', '', '## Round 1, 2026-01-14', '', '- Stopped: every question was answered', '', '### Superseded', '']
const F3 = ['- **F3** `verified` The gateway retries a failed call twice.', '  - Source: https://example.com/pr/88']
const F4 = ['- **F4** `verified` A retry waits one second.', '  - Source: https://example.com/pr/88']
const F7 = ['- **F7** `verified` The gateway retries a failed call three times.', '  - Source: `api/src/gateway.js:41-58` at `3f2a9c1`']
const F8 = ['- **F8** `inferred` An export retries the same way, since it calls the gateway.', '  - From: F7']
const F9 = ['- **F9** `verified` `disputed` The limit is 100 calls a minute by one source and 60 by the other.', '  - Source: https://example.com/limits: 100', '  - Source: https://example.com/prices: 60']
const OVER_F3 = '  - Supersedes F3, 2026-01-14: the count was raised from two.'
const OVER_F4 = '  - Supersedes F4, 2026-01-14: the wait was doubled.'
const LINKS_OWN_FILES = "a research links its own files, a full address and its item's saved ticket or pull request"
const ONCE = 'a number is used once across the sheet and the log'
const LEAVES = 'a superseded fact leaves the sheet for the log'
const RETRIES = '03-2026-01-14-chat-retries-full-text.md'
const TICKET = '01-2026-01-09-PROJ-12-full-text.md'
const ACME_GRAPH = `7 nodes, 5 links\nORPHAN repos/web.md\nUNREFERENCED work/PROJ-12/sources/${TICKET}\n`
const TIDY = {
  'estate.json': { contextCentral: 1, name: 'acme' },
  'CLAUDE.md': '# Acme estate\n\nStart at [[concepts/gateway]].\n',
  'concepts/gateway.md': '# The gateway\n\nWhat is known of its limits is in [the research](../research/gateway-limits/index.md).\n',
}
const WHOLE = {
  [`${DIR}/index.md`]: text(HEAD, F7, OVER_F3, F8, F9, '', '## Sources', '', `- [${RETRIES}](sources/${RETRIES}): chat`, '', '[The brief](brief.md), [the log](log.md), [the set-aside list](set-aside.md) and [the reading](reading.md).'),
  [`${DIR}/log.md`]: text(LOG_HEAD, F3),
  [`${DIR}/brief.md`]: '# The brief\n\n## Questions\n\n- Q1: How many times does the gateway retry a failed call?\n',
  [`${DIR}/set-aside.md`]: '# The set-aside list\n\n## Set aside\n\n## Bring in\n',
  [`${DIR}/reading.md`]: '# The reading\n\nWhat is made of [the fact sheet](index.md), and of https://example.com/limits beside it.\n',
  [`${DIR}/sources/${RETRIES}`]: '# Retries, as the thread has it\n\nThree times.\n',
}

function text(...parts: (string | string[])[]) {
  return `${parts.flat().join('\n')}\n`
}

const lint = (root: string, ...flags: string[]) => run(['lint', ...flags], { cwd: root })
const graph = (root: string, ...flags: string[]) => run(['graph', ...flags], { cwd: root })
const withResearch = (facts: (string | string[])[], logged: (string | string[])[] = [], more: TreeFiles = {}, settings: { [key: string]: Json } = {}) =>
  tree(acme({ [`${DIR}/index.md`]: text(HEAD, ...facts), [`${DIR}/log.md`]: text(LOG_HEAD, ...logged), ...more }, settings))
const warned = (...said: string[]) => ({ code: 0, stdout: said.map(line => `WARN research: ${line}\n`).join(''), stderr: '' })

test('a research whose facts, log and links are in order earns no line from lint', () => {
  const root = tree(acme(WHOLE))

  assert.deepEqual(lint(root), OK)
  assert.deepEqual(lint(root, '--strict'), OK)
})

test('a research that research new has just made earns no line from lint, for a work item and for none', () => {
  const root = tree(acme())
  run(['research', 'new', 'gateway-limits', '--title', 'How the gateway limits a shop'], { cwd: root })
  run(['research', 'new', 'retries', '--item', 'PROJ-12'], { cwd: root })

  assert.deepEqual(lint(root, '--strict'), OK)
})

test('a number used twice on the sheet, or on the sheet and one of its pages, is one line with both places', () => {
  const onTheSheet = withResearch([F7, F8, F8])
  const onAPage = withResearch([F7, F8], [], { [`${DIR}/facts-retries.md`]: text('# Retries', '', F8) })

  assert.deepEqual(lint(onTheSheet), warned(`${DIR} uses F8 twice (index.md:11 and index.md:13); ${ONCE}`))
  assert.deepEqual(lint(onAPage), warned(`${DIR} uses F8 twice (index.md:11 and facts-retries.md:3); ${ONCE}`))
  assert.equal(lint(onTheSheet, '--strict').code, 1)
})

test('several numbers used twice are one line, with their count and the first', () => {
  const root = withResearch([F7, F8, F7, F8, F9])

  assert.deepEqual(lint(root), warned(`${DIR} uses 2 numbers twice (first F7, index.md:9 and index.md:13); ${ONCE}`))
})

test('a number used on the sheet and again in the log is used twice, and the fact in the log is one no fact names as superseded', () => {
  const root = withResearch([F7, F8], [F8])

  assert.deepEqual(lint(root), warned(`${DIR} uses F8 twice (index.md:11 and log.md:9); ${ONCE}`, `${DIR}/log.md holds F8 (line 9), which no fact names as superseded`))
})

test('a fact still on the sheet that another fact supersedes is one line, with the fact that supersedes it, and several are counted', () => {
  const one = withResearch([F3, F7, OVER_F3])
  const two = withResearch([F3, F4, F7, OVER_F3, OVER_F4])

  assert.deepEqual(lint(one), warned(`${DIR} still holds F3 on its sheet (index.md:9), which F7 supersedes; ${LEAVES}`))
  assert.deepEqual(lint(two), warned(`${DIR} still holds 2 superseded facts on its sheet (first F3, index.md:9, which F7 supersedes); ${LEAVES}`))
})

test('a fact named as superseded that neither the log nor the sheet holds is one line, with the place that names it, and several are counted', () => {
  const one = withResearch([F7, OVER_F3])
  const two = withResearch([F7, OVER_F3, OVER_F4, F8, '  - Supersedes F3, 2026-01-15: said again.'])
  const noLog = tree(acme({ [`${DIR}/index.md`]: text(HEAD, F7, OVER_F3) }))

  assert.deepEqual(lint(one), warned(`${DIR} names F3 as superseded (index.md:11), and its log does not hold F3`))
  assert.deepEqual(lint(two), warned(`${DIR} names 2 facts as superseded that its log does not hold (first F3, index.md:11)`))
  assert.deepEqual(lint(noLog), warned(`${DIR} names F3 as superseded (index.md:11), and its log does not hold F3`))
})

test('a fact in the log that no fact names as superseded is one line, and several are counted', () => {
  const one = withResearch([F7], [F3])
  const two = withResearch([F7], [F3, F4])

  assert.deepEqual(lint(one), warned(`${DIR}/log.md holds F3 (line 9), which no fact names as superseded`))
  assert.deepEqual(lint(two), warned(`${DIR}/log.md holds 2 facts that no fact names as superseded (first F3, line 9)`))
})

test('a fact in the log is named as superseded by a fact that was itself superseded later and sits in the log too', () => {
  const root = withResearch([F9, '  - Supersedes F7, 2026-01-15: the two sources were read again.'], [F7, OVER_F3, F3])

  assert.deepEqual(lint(root), OK)
})

test('a superseding line with no date, or with no reason, is one line with its place, and several are counted', () => {
  for (const bare of ['  - Supersedes F3', '  - Supersedes F3, 2026-01-14', '  - Supersedes F3, 2026-01-14:', '  - Supersedes F3: the count was raised from two.', '  - Supersedes F3, in January: the count was raised.']) {
    assert.deepEqual(lint(withResearch([F7, bare], [F3])), warned(`${DIR} names F3 as superseded with no date and reason (index.md:11)`), bare)
  }
  assert.deepEqual(lint(withResearch([F7, '  - Supersedes F3', '  - Supersedes F4'], [F3, F4])), warned(`${DIR} names 2 facts as superseded with no date and reason (first F3, index.md:11)`))
})

test('a link out of a research is one line, with what it links and its line, and several are counted from the first', () => {
  const brief = text('# The brief', '', '## Sources to cover', '', '- As [the gateway note](../../concepts/gateway.md) has it.')
  const one = withResearch([F7], [], { [`${DIR}/brief.md`]: brief })
  const two = withResearch([F7], [], { [`${DIR}/brief.md`]: brief, [`${DIR}/reading.md`]: text('# The reading', '', 'See [[repos/api]] and [the state file](../../work/PROJ-12/STATE.md).') })

  assert.deepEqual(lint(one), warned(`${DIR}/brief.md links out of its research (../../concepts/gateway.md, at line 5); ${LINKS_OWN_FILES}`))
  assert.deepEqual(lint(two), warned(`${DIR} has 3 links out of its research (first ../../concepts/gateway.md, at brief.md:5); ${LINKS_OWN_FILES}`))
})

test('a link shown in a fenced block or in code is no link out of a research', () => {
  const brief = text('# The brief', '', '```', 'A link is written [so](../../concepts/gateway.md).', '```', '', 'In a line of prose it is `[so](../../concepts/gateway.md)`.')
  const root = withResearch([F7], [], { [`${DIR}/brief.md`]: brief })

  assert.deepEqual(lint(root), OK)
})

test("a research links its own files, a full address and, with a work item, a file of that item's saved sources", () => {
  const sources = text('', '## Sources', '', `- [the ticket](../../work/PROJ-12/sources/${TICKET}): tickets`, '- [the brief](brief.md), [[research/gateway-limits/log]], https://example.com/limits and [a page](https://example.com/page.md)')
  const withItem = tree(acme({ [`${DIR}/index.md`]: text(HEAD.toSpliced(3, 0, 'item: PROJ-12'), F7) + sources, [`${DIR}/brief.md`]: '# The brief\n' }))

  assert.deepEqual(lint(withItem), OK)
})

test("a link to a work item's saved source is a link out for a research with no item, or with another item, and so is a link to a note of its own item", () => {
  const toTheTicket = text('', '## Sources', '', `- [the ticket](../../work/PROJ-12/sources/${TICKET}): tickets`)
  const toANote = text('', `- [what prep found](../../work/PROJ-12/notes/2026-01-10-research-rate-limits.md)`)
  const out = (target: string, line: number) => warned(`${DIR}/index.md links out of its research (${target}, at line ${line}); ${LINKS_OWN_FILES}`)
  const sheet = (item: string[], below: string) => tree(acme({ [`${DIR}/index.md`]: text(HEAD.toSpliced(3, 0, ...item), F7) + below, 'work/PROJ-13/STATE.md': '---\nitem: PROJ-13\nstatus: active\n---\n# PROJ-13\n' }))

  assert.deepEqual(lint(sheet([], toTheTicket)), out(`../../work/PROJ-12/sources/${TICKET}`, 14))
  assert.deepEqual(lint(sheet(['item: PROJ-13'], toTheTicket)), out(`../../work/PROJ-12/sources/${TICKET}`, 15))
  assert.deepEqual(lint(sheet(['item: PROJ-99'], toTheTicket)), out(`../../work/PROJ-12/sources/${TICKET}`, 15))
  assert.deepEqual(lint(sheet(['item: PROJ-12'], toANote)), out('../../work/PROJ-12/notes/2026-01-10-research-rate-limits.md', 13))
})

test('a line that opens as a fact and does not read as one is one line with its place, and several are counted across the sheet and the log', () => {
  for (const odd of ['- **F7** The gateway retries a failed call three times.', '- **F7** verified The gateway retries.', '- **F7** `checked` The gateway retries.', '- **F7** `verified`', '- **F7**`verified` The gateway retries.', '- **F7** `verified` `disputed`']) {
    assert.deepEqual(lint(withResearch([odd, '  - Source: https://example.com/retries'])), warned(`${DIR}/index.md has a line that opens as a fact and does not read as one (line 9)`), odd)
  }
  assert.deepEqual(lint(withResearch(['- **F7** The gateway retries.', F8, '- **F9** Twice.'], ['- **F3** Once.'])), warned(`${DIR} has 3 lines that open as a fact and do not read as one (first at index.md:9)`))
})

test('a heading of the log that opens as a round and does not read as one is one line with its place, and several are counted', () => {
  const entry = (heading: string) => [heading, '', '- Stopped: the cap was reached', '']
  const logged = (...headings: string[]) => withResearch([F7], [], { [`${DIR}/log.md`]: text('# The log', '', '## Round 1, 2026-01-13', '', '- Open: Q2', '', ...headings.flatMap(entry)) })

  for (const unread of ['## Round 2 2026-01-14', '## Round two, 2026-01-14', '## Round 2', '## Round']) {
    assert.deepEqual(lint(logged(unread)), warned(`${DIR}/log.md has a heading that opens as a round and does not read as one (line 7)`), unread)
  }
  assert.deepEqual(lint(logged('## Round 2 2026-01-14', '## Round 3, 2026-01-15', '## Round 4: 2026-01-16')), warned(`${DIR}/log.md has 2 headings that open as a round and do not read as one (first at line 7)`))
  assert.deepEqual(lint(logged('## Round 2, 2026-01-14', '### Superseded', '## Rounds of talks', '### Round 9', '```', '## Round 5 2026-01-16', '```')), OK)
})

test('a line that only looks like a fact is none: one that is indented, one in a quote, and one whose number is no number', () => {
  const root = withResearch([F7, '  - **F7** `verified` Said again under it, with its source at https://example.com/retries', '> - **F7** `verified` As the thread quotes it, at https://example.com/thread', '- **Fast** `verified` path, as https://example.com/fast has it.', '- **F7b** not a number'])

  assert.deepEqual(lint(root), OK)
})

test('a fact marked verified that names no source earns the mark warning, on the sheet, on a page and in the log', () => {
  const bare = '- **F5** `verified` A call over the limit is refused.'
  const root = withResearch([F7, OVER_F3, bare], [F3.slice(0, 1)], { [`${DIR}/facts-limits.md`]: text('# Limits', '', '- **F6** `verified` The limit is per shop.', F9) })

  assert.deepEqual(lint(root), {
    code: 0,
    stderr: '',
    stdout: [
      `WARN mark: ${DIR}/facts-limits.md has 1 claim marked verified that names no source (at line 3)`,
      `WARN mark: ${DIR}/index.md has 1 claim marked verified that names no source (at line 12)`,
      `WARN mark: ${DIR}/log.md has 1 claim marked verified that names no source (at line 9)`,
      '',
    ].join('\n'),
  })
})

test('a fact that names a saved source of its research by the name of the file alone is sourced', () => {
  const root = withResearch(['- **F7** `verified` The gateway retries a failed call three times.', `  - Source: ${RETRIES}`], [], { [`${DIR}/sources/${RETRIES}`]: '# Retries\n' })
  const notSaved = withResearch(['- **F7** `verified` The gateway retries a failed call three times.', `  - Source: ${RETRIES}`])

  assert.deepEqual(lint(root), OK)
  assert.equal(lint(notSaved).stdout, `WARN mark: ${DIR}/index.md has 1 claim marked verified that names no source (at line 9)\n`)
})

test('a fact inside a fenced block is no fact: its number is not used twice, it needs no source, and a line there that does not read as one is passed over', () => {
  const shown = ['```', '- **F7** `verified` How a fact is written, shown as an example.', '- **F8** not a fact at all', '```']
  const root = withResearch([F7, OVER_F3, F8, '', ...shown], [F3, '', '~~~', ...F3, '~~~'], { [`${DIR}/facts-retries.md`]: text('# Retries', '', '> ```', '> - **F7** `verified` Quoted, in a fence.', '> ```') })

  assert.deepEqual(lint(root), OK)
})

test('a fence that never closes covers every fact after it', () => {
  const root = withResearch([F7, '```', ...F7, ...F8, ...F8])

  assert.deepEqual(lint(root), OK)
})

test('every file of a research over the soft cap is warned of but its log, which only grows', () => {
  const long = `${'A line of what was found, long enough to count. '.repeat(430)}\n`
  const root = withResearch([F7, '', long], [long], { [`${DIR}/brief.md`]: `# The brief\n\n${long}` })

  assert.deepEqual(lint(root), { code: 0, stdout: `WARN node: ${DIR}/brief.md is 20 KB (soft cap 20 KB)\nWARN node: ${DIR}/index.md is 20 KB (soft cap 20 KB)\n`, stderr: '' })
})

test('lint says nothing of a cited line that has moved since its commit, or of a date to check again by that has passed', () => {
  const made = checkout({ 'estate.json': { contextCentral: 1, name: 'solo', repos: [{ name: 'solo', path: '.' }] }, 'CLAUDE.md': '# Solo\n', 'src/gateway.js': 'const RETRIES = 2\n' })
  tree(made.base)
  const first = git(made, made.main, 'rev-parse', '--short', 'HEAD').stdout.trim()
  writeFileSync(join(made.main, 'src/gateway.js'), 'const RETRIES = 3\n')
  git(made, made.main, 'commit', '-q', '-am', 'three')
  mkdirSync(join(made.main, DIR), { recursive: true })
  writeFileSync(join(made.main, DIR, 'index.md'), text(HEAD.toSpliced(5, 0, '', '## Check again by', '', '2025-12-01'), '- **F7** `verified` The gateway retries a failed call twice.', `  - Source: \`src/gateway.js:1\` at \`${first}\``))

  assert.match(first, /^[0-9a-f]{7,}$/)
  assert.deepEqual(run(['lint', '--strict'], { cwd: made.main, env: made.env }), OK)
})

test('graph counts the files of a research as nodes and its saved sources as deep files, and prints no line for one that is whole and linked', () => {
  const root = tree(makeTree({ ...TIDY, ...WHOLE }))

  assert.deepEqual(graph(root, '--strict'), { code: 0, stdout: '6 nodes, 7 links\n', stderr: '' })
})

test('a saved source of a research that no file names is unreferenced, and a link in a research to a file that is not there is broken', () => {
  const root = tree(makeTree({ ...TIDY, ...WHOLE, [`${DIR}/sources/04-2026-01-14-mail-limits-full-text.md`]: '# Limits, as the mail has them\n', [`${DIR}/brief.md`]: '# The brief\n\nSee [what was asked](asked.md).\n' }))

  const result = graph(root)

  assert.deepEqual(result, { code: 1, stdout: `6 nodes, 7 links\nBROKEN ${DIR}/brief.md -> asked.md\nUNREFERENCED ${DIR}/sources/04-2026-01-14-mail-limits-full-text.md\n`, stderr: '' })
})

test('a fact sheet that nothing outside its research links is an orphan, though its own reading links it, and the run fails only under --strict', () => {
  const root = tree(makeTree({ ...TIDY, ...WHOLE, 'concepts/gateway.md': '# The gateway\n' }))

  assert.deepEqual(graph(root), { code: 0, stdout: `6 nodes, 6 links\nORPHAN ${DIR}/index.md\n`, stderr: '' })
  assert.equal(graph(root, '--strict').code, 1)
})

test("a page of facts that its sheet does not list is an orphan, and one the sheet links is not", () => {
  const page = { [`${DIR}/facts-retries.md`]: text('# Retries', '', F4) }
  const listed = tree(makeTree({ ...TIDY, ...WHOLE, ...page, [`${DIR}/index.md`]: `${WHOLE[`${DIR}/index.md`]}\n- [Retries](facts-retries.md): F4\n` }))
  const unlisted = tree(makeTree({ ...TIDY, ...WHOLE, ...page }))

  assert.equal(graph(listed).stdout, '7 nodes, 8 links\n')
  assert.equal(graph(unlisted).stdout, `7 nodes, 7 links\nORPHAN ${DIR}/facts-retries.md\n`)
})

test("where an estate lists research's folder among its own kinds of folder, each file of a research is still taken once", () => {
  const long = `${'A line of what was found, long enough to count. '.repeat(430)}\n`
  const settings = { nodeDirs: ['repos', 'areas', 'concepts', 'edges', 'decisions', 'docs', 'standards', 'log', 'work', 'research'] }
  const root = withResearch([F7, F8, F8, '- **F5** `verified` A call over the limit is refused.', '', long], [long], {}, settings)
  const whole = tree(makeTree({ ...TIDY, ...WHOLE, 'estate.json': { ...TIDY['estate.json'], nodeDirs: ['concepts', 'research'] } }))

  assert.deepEqual(lint(root), {
    code: 0,
    stderr: '',
    stdout: [
      `WARN node: ${DIR}/index.md is 21 KB (soft cap 20 KB)`,
      `WARN mark: ${DIR}/index.md has 1 claim marked verified that names no source (at line 15)`,
      `WARN research: ${DIR} uses F8 twice (index.md:11 and index.md:13); ${ONCE}`,
      '',
    ].join('\n'),
  })
  assert.deepEqual(graph(whole, '--strict'), { code: 0, stdout: '6 nodes, 7 links\n', stderr: '' })
})

test("a folder of the estate's own under research's name, and a research in a folder that is not the plugin's to use, are read by neither lint nor graph", () => {
  const faulty = text(HEAD, F8, F8, '- **F7** not a fact', '[out](../../concepts/gateway.md)')
  const ownFolder = tree(acme({ 'research/market/index.md': faulty.replace('research: gateway-limits\n', '') }))
  const leftAlone = tree(acme({ 'scratch/research/gateway-limits/index.md': faulty }, { researchDir: 'scratch/research' }))

  for (const root of [ownFolder, leftAlone]) {
    assert.deepEqual(lint(root, '--strict'), OK)
    assert.equal(graph(root).stdout, ACME_GRAPH)
  }
})

test('with --json a fault in a research is a finding of the check research, with the file it is in', () => {
  const root = withResearch([F7], [F3])

  assert.deepEqual(JSON.parse(lint(root, '--json').stdout), [{ level: 'WARN', check: 'research', rel: `${DIR}/log.md`, message: `research: ${DIR}/log.md holds F3 (line 9), which no fact names as superseded` }])
})

test('a fact sheet that cannot be read earns the one line any file earns, and none of its own', BY_MODE, () => {
  const root = withResearch([F8, F8], [F3])
  chmodSync(join(root, DIR, 'index.md'), 0o000)

  const result = lint(root)
  chmodSync(join(root, DIR, 'index.md'), 0o644)

  assert.deepEqual(result, { code: 1, stdout: `ERROR read: ${DIR}/index.md cannot be read (EACCES), so the listings pass over it\n`, stderr: '' })
})

test('a map with no research is linted and graphed as it was', () => {
  const root = tree(acme())

  assert.deepEqual(lint(root), OK)
  assert.equal(graph(root).stdout, ACME_GRAPH)
  assert.equal(Object.keys(ACME_FILES).some(file => file.startsWith('research/')), false)
})
