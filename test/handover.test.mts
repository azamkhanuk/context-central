import assert from 'node:assert/strict'
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { test } from 'node:test'
import { ACME_FILES, acme, disposable, makeTree, notOnWindows, run, solo, workTree } from './helpers.mts'
import type { TreeFiles } from './helpers.mts'

const tree = disposable()

const NAME = 'gateway-limits'
const DIR = 'research/gateway-limits'
const TICKET = '01-2026-01-09-PROJ-12-full-text.md'
const CHAT = '03-2026-01-14-chat-retries-full-text.md'
const MAIL = '04-2026-01-14-mail-limits-full-text.md'
const QUOTA = '05-2026-01-14-mail-quota-full-text.md'
const GONE = '(left out of this copy)'
const USAGE = 'expected one of: new <name> [--title <title>] [--item <item>] [--json], open <name> [--json], moved <name> [--json], handover <name> <folder> [--without <kind>]... [--reading]'
const BY_MODE = process.getuid?.() === 0 ? { skip: 'root writes a folder whatever its mode' } : notOnWindows('a folder on Windows is not closed to writing by its mode')
const LINKS = notOnWindows('symlinks need a right most Windows accounts lack')
const ONE_NAME_UNDER_BOTH_CASES = (() => {
  const probe = makeTree({ 'a.md': '' })
  const one = existsSync(join(probe, 'A.md'))
  rmSync(probe, { recursive: true, force: true })
  return one
})()
const BLIND_TO_CASE = ONE_NAME_UNDER_BOTH_CASES ? {} : { skip: 'this disk tells the cases of letters apart' }
const TELLS_CASES_APART = ONE_NAME_UNDER_BOTH_CASES ? { skip: 'this disk holds one name under both letter cases' } : {}

type Links = { item: string, reading: string, ticket: string, chat: string, mail: string, quota: string }

const IN_THE_MAP: Links = {
  item: 'item: PROJ-12\n',
  reading: '[The reading](reading.md)',
  ticket: `[${TICKET}](../../work/PROJ-12/sources/${TICKET})`,
  chat: `[${CHAT}](sources/${CHAT})`,
  mail: `[${MAIL}](sources/${MAIL})`,
  quota: `[${QUOTA}](sources/${QUOTA})`,
}
const COPIED: Links = { ...IN_THE_MAP, item: '', reading: `The reading ${GONE}`, ticket: `[${TICKET}](sources/item-${TICKET})` }
const WITH_THE_READING: Links = { ...COPIED, reading: IN_THE_MAP.reading }
const NO_MAIL: Links = { ...COPIED, mail: `${MAIL} ${GONE}`, quota: `${QUOTA} ${GONE}` }

const sheet = (links: Links) => `---
research: gateway-limits
title: How the gateway limits a shop
${links.item}---
# How the gateway limits a shop

[The brief](brief.md) holds the questions, [the log](log.md) one entry a round and [the set-aside list](set-aside.md) what was judged beside the point. ${links.reading} is one person's judgement of the facts.

## Questions

- Q1: How many calls a minute may a shop make?

## Check again by

2026-02-13

## Not reached

## Facts

- **F1** \`verified\` A shop may make 100 calls a minute.
  - Source: ${links.mail}
- **F2** \`verified\` The ticket asks for a limit on each client.
  - Source: ${links.ticket}
- **F3** \`verified\` A failed call is retried three times.
  - Source: ${links.chat}
  - Source: ${links.quota}
- **F4** \`verified\` The quota is reset at midnight.
  - Source: ${links.quota}
- **F5** \`inferred\` A burst is cut at the gateway.
  - From: F1 and \`api/src/gateway.js:9\` at \`3f2a9c1\`

## Sources

- ${links.chat}: chat
- ${links.mail}: mail
- ${links.quota}: mail
- ${links.ticket}: tickets
- \`api\` at \`3f2a9c1\`: code
`
const log = (links: Links) => `# How the gateway limits a shop: the log

## Round 1, 2026-01-14

- Answered: Q1 by F1
- New leads: The quota mail | ${links.quota} | 2026-01-12 | says when the quota is reset
- Stopped: every question was answered
`
const reading = (links: Links) => `# How the gateway limits a shop: the reading

## 2026-01-14

### Fine as it is

- The limit is known (F1), from ${links.mail} and from the ticket, ${links.ticket}. [The sheet](index.md) has the rest.
`
const BRIEF = '# How the gateway limits a shop: the brief\n\n## Questions\n\n- Q1: How many calls a minute may a shop make?\n'
const SET_ASIDE = '# How the gateway limits a shop: the set-aside list\n\n## Set aside\n\n## Bring in\n'
const SAVED = { [CHAT]: '# Retries\n\nThree tries.\n', [MAIL]: '# Limits\r\n\r\n100 a minute.\r\n', [QUOTA]: '# Quota\n\nReset at midnight.\n' }
const THE_TICKET = ACME_FILES[`work/PROJ-12/sources/${TICKET}`]

const research = (more: TreeFiles = {}): TreeFiles => ({
  [`${DIR}/index.md`]: sheet(IN_THE_MAP),
  [`${DIR}/brief.md`]: BRIEF,
  [`${DIR}/log.md`]: log(IN_THE_MAP),
  [`${DIR}/set-aside.md`]: SET_ASIDE,
  [`${DIR}/reading.md`]: reading(IN_THE_MAP),
  ...Object.fromEntries(Object.entries(SAVED).map(([name, text]) => [`${DIR}/sources/${name}`, text])),
  ...more,
})
const withResearch = (more: TreeFiles = {}) => tree(acme(research(more)))
const elsewhere = () => join(tree(makeTree({})), 'handed')
const handover = (cwd: string, ...args: string[]) => run(['research', 'handover', ...args], { cwd })
const refused = (line: string, code = 1) => ({ code, stdout: '', stderr: `context-central research: ${line}\n` })
const inTheMap = (folder: string) => refused(`${folder} is inside the map, so nothing was handed over: a hand-over is a folder outside it`)
const inAMapInACheckout = () => solo(Object.fromEntries(Object.entries(research({ [`${DIR}/index.md`]: sheet({ ...IN_THE_MAP, item: '', ticket: TICKET }) })).map(([path, content]) => [`.context-central/${path}`, content])))
const linesOf = ({ stdout }: { stdout: string }) => stdout.trimEnd().split('\n').map(line => line.replace(/ \(\d[^)]*\)$/, ''))
const copied = (folder: string) =>
  Object.fromEntries(
    readdirSync(folder, { recursive: true, encoding: 'utf8' })
      .filter(rel => statSync(join(folder, rel)).isFile())
      .map(rel => [rel.split(sep).join('/'), readFileSync(join(folder, rel), 'utf8')] as const)
      .sort(([a], [b]) => (a < b ? -1 : 1)),
  )
const kept = (links: Links) => ({
  'brief.md': BRIEF,
  'index.md': sheet(links),
  'log.md': log(links),
  'set-aside.md': SET_ASIDE,
  [`sources/${CHAT}`]: SAVED[CHAT],
  [`sources/${MAIL}`]: SAVED[MAIL],
  [`sources/${QUOTA}`]: SAVED[QUOTA],
  [`sources/item-${TICKET}`]: THE_TICKET,
})

test('a hand-over copies the sheet, the brief, the log, the set-aside list and every saved source into a folder that was not there, leaves the reading out, and says how many files it wrote', () => {
  const root = withResearch()
  const out = elsewhere()

  const result = handover(root, NAME, out)

  assert.equal(result.code, 0)
  assert.equal(result.stderr, '')
  assert.deepEqual(linesOf(result), [`handed over research gateway-limits to ${out}: 8 files`])
  assert.deepEqual(copied(out), kept(COPIED))
})

test('the size a hand-over gives is that of the files it wrote, in bytes and then in kilobytes', () => {
  const tiny = '---\nresearch: tiny\n---\n# Tiny\n'
  const root = tree(acme({ 'research/tiny/index.md': tiny, 'research/wide/index.md': '---\nresearch: wide\n---\n# Wide\n', 'research/wide/sources/01-2026-01-14-paste-long-full-text.md': 'x'.repeat(2048) }))
  const out = elsewhere()

  assert.deepEqual(handover(root, 'tiny', out), { code: 0, stdout: `handed over research tiny to ${out}: 1 file (${Buffer.byteLength(tiny)} B)\n`, stderr: '' })
  assert.deepEqual(handover(root, 'wide', `${out}-wide`), { code: 0, stdout: `handed over research wide to ${out}-wide: 2 files (2.0 KB)\n`, stderr: '' })
})

test('with --reading the reading is copied too, and a link to it stays a link', () => {
  const root = withResearch()
  const out = elsewhere()

  const result = handover(root, NAME, out, '--reading')

  assert.deepEqual(linesOf(result), [`handed over research gateway-limits to ${out}: 9 files`])
  assert.deepEqual(copied(out), { ...kept(WITH_THE_READING), 'reading.md': reading(WITH_THE_READING) })
})

test("the sheet's item line is left out of the copy, each file of the item's own sources that the research links is copied in under item-, every link to it leads there, and a file of the item that nothing links stays behind", () => {
  const root = withResearch({ 'work/PROJ-12/sources/02-2026-01-10-pr-88-full-text.md': '# PR 88\n' })
  const out = elsewhere()

  handover(root, NAME, out)
  const files = copied(out)

  assert.ok(!files['index.md'].includes('item:'))
  assert.equal(files[`sources/item-${TICKET}`], THE_TICKET)
  assert.deepEqual(Object.keys(files).filter(name => name.includes('item-')), [`sources/item-${TICKET}`])
  assert.ok(files['index.md'].includes(`  - Source: [${TICKET}](sources/item-${TICKET})\n`))
  assert.ok(files['index.md'].includes(`- [${TICKET}](sources/item-${TICKET}): tickets\n`))
  assert.ok(!Object.values(files).some(text => text.includes('work/PROJ-12')))
})

test("only the item line of the sheet's head is left out: a line of its body that opens the same way stays, with a head that names an item and with one that names none", () => {
  const body = '# Limits\n\nitem: a line of the body\n'
  const root = tree(acme({ [`${DIR}/index.md`]: `---\nresearch: gateway-limits\nitem: PROJ-12\n---\n${body}`, 'research/bare/index.md': `---\nresearch: bare\n---\n${body}` }))
  const out = elsewhere()

  handover(root, NAME, out)
  handover(root, 'bare', `${out}-bare`)

  assert.equal(copied(out)['index.md'], `---\nresearch: gateway-limits\n---\n${body}`)
  assert.equal(copied(`${out}-bare`)['index.md'], `---\nresearch: bare\n---\n${body}`)
})

test('--without leaves out every saved source of that kind, a link to one becomes its text and a mark, and the facts that rest only on sources left out are named', () => {
  const root = withResearch()
  const out = elsewhere()

  const result = handover(root, NAME, out, '--without', 'mail', '--reading')
  const { [`sources/${MAIL}`]: mail, [`sources/${QUOTA}`]: quota, ...rest } = kept({ ...NO_MAIL, reading: IN_THE_MAP.reading })

  assert.deepEqual(linesOf(result), [`handed over research gateway-limits to ${out}: 7 files`, 'left out: 2 sources of kind mail', 'F1 and F4 rest only on sources left out'])
  assert.deepEqual(copied(out), { ...rest, 'reading.md': reading({ ...NO_MAIL, reading: IN_THE_MAP.reading }) })
  assert.equal(mail, SAVED[MAIL])
  assert.equal(quota, SAVED[QUOTA])
})

test("--without takes several kinds, the item's ticket among them, and says each kind in the order asked, with one fact or several named", () => {
  const root = withResearch()
  const one = elsewhere()
  const three = elsewhere()

  const tickets = handover(root, NAME, one, '--without', 'tickets')
  const all = handover(root, NAME, three, '--without', 'tickets', '--without', 'chat', '--without', 'mail', '--without', 'chat')

  assert.deepEqual(linesOf(tickets), [`handed over research gateway-limits to ${one}: 7 files`, 'left out: 1 source of kind tickets', 'F2 rests only on sources left out'])
  assert.ok(copied(one)['index.md'].includes(`  - Source: ${TICKET} ${GONE}\n`))
  assert.deepEqual(linesOf(all), [`handed over research gateway-limits to ${three}: 4 files`, 'left out: 1 source of kind tickets', 'left out: 1 source of kind chat', 'left out: 2 sources of kind mail', 'F1, F2, F3 and F4 rest only on sources left out'])
  assert.deepEqual(Object.keys(copied(three)), ['brief.md', 'index.md', 'log.md', 'set-aside.md'])
})

test('a fact with a source that is kept, a line of code or a full address beside the one left out does not rest only on what was left out, and one that also names the fact it supersedes still does', () => {
  const facts = [
    '- **F1** `verified` One.',
    `  - Source: ${IN_THE_MAP.mail}`,
    '  - Source: `api/src/gateway.js:9` at `3f2a9c1`',
    '- **F2** `verified` Two.',
    `  - Source: ${IN_THE_MAP.mail}`,
    '  - Source: https://example.com/limits',
    '- **F3** `verified` Three.',
    `  - Source: ${IN_THE_MAP.mail}`,
    '- **F4** `inferred` Four.',
    '  - From: F3',
    '- **F5** `verified` Five.',
    `  - Source: ${IN_THE_MAP.mail}`,
    '  - Supersedes F9, 2026-01-14: the number was raised.',
  ]
  const root = tree(acme({ [`${DIR}/index.md`]: ['---', 'research: gateway-limits', '---', '# Limits', '', '## Facts', '', ...facts, '', '## Sources', '', `- ${IN_THE_MAP.mail}: mail`, ''].join('\n'), [`${DIR}/sources/${MAIL}`]: SAVED[MAIL] }))
  const out = elsewhere()

  assert.deepEqual(linesOf(handover(root, NAME, out, '--without', 'mail')), [`handed over research gateway-limits to ${out}: 1 file`, 'left out: 1 source of kind mail', 'F3 and F5 rest only on sources left out'])
})

test('a hand-over with no name, no folder, a word too many or a flag of another action is wrong usage, and a flag of its own does not go with another action', () => {
  const root = withResearch()
  const out = elsewhere()

  assert.deepEqual(handover(root), refused(USAGE, 2))
  assert.deepEqual(handover(root, NAME), refused(USAGE, 2))
  assert.deepEqual(handover(root, NAME, out, 'more'), refused(USAGE, 2))
  assert.deepEqual(handover(root, NAME, out, '--json'), refused('--json does not go with handover', 2))
  assert.deepEqual(run(['research', 'open', NAME, '--reading'], { cwd: root }), refused('--reading does not go with open', 2))
  assert.deepEqual(run(['research', 'moved', NAME, '--without', 'mail'], { cwd: root }), refused('--without does not go with moved', 2))
  assert.deepEqual(run(['research', 'open', NAME, 'more'], { cwd: root }), refused(USAGE, 2))
  assert.ok(!existsSync(out))
})

test("a research that is not there, and a folder for researches that is not the plugin's to use, are refused in the lines research open has for them, with nothing written", () => {
  const root = withResearch()
  const taken = tree(acme({ 'scratch/research/gateway-limits/index.md': sheet(IN_THE_MAP) }, { researchDir: 'scratch/research' }))
  const out = elsewhere()

  assert.deepEqual(handover(root, 'retries', out), refused('no research "retries" in this map. Its researches: gateway-limits.'))
  assert.deepEqual(handover(taken, NAME, out), refused('scratch/research is under a leftAlone entry, so it holds no research: name another folder with "researchDir" in estate.json'))
  assert.match(handover(tree(makeTree({ 'readme.txt': 'x\n' })), NAME, out).stderr, /^context-central research: no context map found/)
  assert.ok(!existsSync(out))
})

test('a folder that is there and holds something, or is a file, is not written to, so a second hand-over to one folder is refused, and an empty folder is taken', () => {
  const root = withResearch()
  const base = tree(makeTree({ 'held/notes.txt': 'mine\n', 'a-file': 'mine\n' }))
  const empty = join(base, 'empty')
  mkdirSync(empty)
  const full = (folder: string) => refused(`${folder} is there already and is not an empty folder, so nothing was handed over`)

  assert.deepEqual(handover(root, NAME, join(base, 'held')), full(join(base, 'held')))
  assert.deepEqual(handover(root, NAME, join(base, 'a-file')), full(join(base, 'a-file')))
  assert.deepEqual(readdirSync(join(base, 'held')), ['notes.txt'])
  assert.equal(handover(root, NAME, empty).code, 0)
  assert.deepEqual(handover(root, NAME, empty), full(empty))
  assert.deepEqual(copied(empty), kept(COPIED))
})

test("a folder inside one of the map's own folders, the research's own among them, is refused, and one beside them is taken", () => {
  const root = withResearch()
  const inside = (folder: string) => refused(`${folder} is inside the map, so nothing was handed over: a hand-over is a folder outside it`)

  for (const folder of [`${DIR}/handed`, 'research/handed', 'concepts/handed', 'work/handed', join(root, 'repos', 'handed', 'deep')]) {
    assert.deepEqual(handover(root, NAME, folder), inside(folder), folder)
    assert.ok(!existsSync(resolve(root, folder)), folder)
  }
  assert.deepEqual(linesOf(handover(root, NAME, 'handed')), ['handed over research gateway-limits to handed: 8 files'])
  assert.deepEqual(copied(join(root, 'handed')), kept(COPIED))
})

test("where the map lies inside a checkout, a folder inside the map's own folder is refused and one in the checkout beside it is taken", () => {
  const one = solo(Object.fromEntries(Object.entries(research()).map(([path, text]) => [`.context-central/${path}`, text])))
  tree(one.base)
  const without = (links: Links) => sheet({ ...links, item: '', ticket: TICKET })
  writeFileSync(join(one.main, '.context-central', DIR, 'index.md'), without(IN_THE_MAP))

  const inside = handover(one.main, NAME, '.context-central/handed')
  const beside = handover(one.main, NAME, 'handed')

  assert.deepEqual(inside, refused('.context-central/handed is inside the map, so nothing was handed over: a hand-over is a folder outside it'))
  assert.deepEqual(linesOf(beside), ['handed over research gateway-limits to handed: 7 files'])
  assert.equal(copied(join(one.main, 'handed'))['index.md'], without(COPIED))
})

test('--without with a kind that no source has is refused with the kinds there are, so a misspelt kind passes nothing on', () => {
  const root = withResearch()
  const bare = tree(acme({ 'research/bare/index.md': '---\nresearch: bare\n---\n# Bare\n' }))
  const out = elsewhere()

  assert.deepEqual(handover(root, NAME, out, '--without', 'Mail'), refused('no source of gateway-limits is of kind "Mail"; its kinds are: chat, mail, tickets'))
  assert.deepEqual(handover(root, NAME, out, '--without', 'mail', '--without', 'code'), refused('no source of gateway-limits is of kind "code"; its kinds are: chat, mail, tickets'))
  assert.deepEqual(handover(bare, 'bare', out, '--without', 'mail'), refused('no source of bare is of kind "mail"; none of its sources has a kind'))
  assert.ok(!existsSync(out))
})

test('with --without a saved source that the sheet gives no kind under Sources stops the hand-over, and without it the source is copied as any other', () => {
  const more = { [`${DIR}/sources/06-2026-01-14-paste-memo-full-text.md`]: '# Memo\n', [`${DIR}/sources/07-2026-01-14-paste-note-full-text.md`]: '# Note\n' }
  const one = withResearch({ [`${DIR}/sources/06-2026-01-14-paste-memo-full-text.md`]: '# Memo\n' })
  const two = withResearch(more)
  const out = elsewhere()

  assert.deepEqual(handover(one, NAME, out, '--without', 'mail'), refused(`nothing was handed over: ${DIR}/sources/06-2026-01-14-paste-memo-full-text.md has no kind under Sources on the fact sheet, so --without cannot tell whether to leave it out`))
  assert.deepEqual(handover(two, NAME, out, '--without', 'mail'), refused(`nothing was handed over: 2 saved sources have no kind under Sources on the fact sheet (first ${DIR}/sources/06-2026-01-14-paste-memo-full-text.md), so --without cannot tell whether to leave them out`))
  assert.ok(!existsSync(out))
  assert.deepEqual(linesOf(handover(one, NAME, out)), [`handed over research gateway-limits to ${out}: 9 files`])
})

test('a link in what would be copied that leads outside the research, or to a file that is not there, stops the hand-over with its place, and nothing is written', () => {
  const outside = withResearch({ [`${DIR}/brief.md`]: `${BRIEF}\nSee [the gateway](../../concepts/gateway.md).\n` })
  const missing = withResearch({ [`${DIR}/log.md`]: `${log(IN_THE_MAP)}\nSee [the page](facts-retries.md).\n` })
  const anothers = withResearch({ [`${DIR}/log.md`]: `${log(IN_THE_MAP)}\nSee [the spec](../../work/PROJ-12/SPEC.md).\n` })
  const out = elsewhere()

  assert.deepEqual(handover(outside, NAME, out), refused(`nothing was handed over: ${DIR}/brief.md:7 links ../../concepts/gateway.md, which is outside the research`))
  assert.deepEqual(handover(missing, NAME, out), refused(`nothing was handed over: ${DIR}/log.md:9 links facts-retries.md, which is not there`))
  assert.deepEqual(handover(anothers, NAME, out), refused(`nothing was handed over: ${DIR}/log.md:9 links ../../work/PROJ-12/SPEC.md, which is outside the research`))
  assert.ok(!existsSync(out))
})

test('a link in the reading stops a hand-over only where the reading is copied', () => {
  const root = withResearch({ [`${DIR}/reading.md`]: `${reading(IN_THE_MAP)}\nSee [the gateway](../../concepts/gateway.md).\n` })
  const out = elsewhere()

  assert.deepEqual(handover(root, NAME, out, '--reading'), refused(`nothing was handed over: ${DIR}/reading.md:9 links ../../concepts/gateway.md, which is outside the research`))
  assert.ok(!existsSync(out))
  assert.equal(handover(root, NAME, out).code, 0)
})

test('a research just made, with no fact and no source, is handed over as it is', () => {
  const root = tree(acme())
  run(['research', 'new', NAME, '--title', 'How the gateway limits a shop'], { cwd: root })
  const out = elsewhere()
  const inTheMap = (file: string) => readFileSync(join(root, DIR, file), 'utf8')

  const result = handover(root, NAME, out)

  assert.deepEqual(linesOf(result), [`handed over research gateway-limits to ${out}: 4 files`])
  assert.deepEqual(copied(out), { 'brief.md': inTheMap('brief.md'), 'index.md': inTheMap('index.md').replace('[The reading](reading.md)', `The reading ${GONE}`), 'log.md': inTheMap('log.md'), 'set-aside.md': inTheMap('set-aside.md') })
})

test('a link shown in a fenced block or in a code span is left as it is written, a full address and a link to a file that is not Markdown are kept, and a fragment stays on a link that is kept', () => {
  const shown = ['```', '[the gateway](../../concepts/gateway.md) and [the reading](reading.md)', '```', '', 'Written as `[the reading](reading.md)`, read at https://example.com/limits.md and [there](https://example.com/limits.md), drawn in [the chart](chart.png).', '', `See [the first round](log.md#round-1-2026-01-14) and [the ticket](../../work/PROJ-12/sources/${TICKET}#the-ask).`, '']
  const root = withResearch({ [`${DIR}/brief.md`]: `${BRIEF}\n${shown.join('\n')}` })
  const out = elsewhere()

  handover(root, NAME, out)

  assert.equal(copied(out)['brief.md'], `${BRIEF}\n${[...shown.slice(0, 6), `See [the first round](log.md#round-1-2026-01-14) and [the ticket](sources/item-${TICKET}#the-ask).`, ''].join('\n')}`)
})

test('a link written from the map in double brackets becomes a plain link inside the copy, with its own words where it has some, and one to a file left out becomes its words and the mark', () => {
  const wiki = `See [[research/gateway-limits/log]], [[research/gateway-limits/log|the rounds]], [[research/gateway-limits/reading|the reading]], [[research/gateway-limits/sources/${CHAT}]] and [[work/PROJ-12/sources/${TICKET}|the ticket]].\n`
  const root = withResearch({ [`${DIR}/brief.md`]: `${BRIEF}\n${wiki}` })
  const out = elsewhere()

  handover(root, NAME, out)

  assert.equal(copied(out)['brief.md'], `${BRIEF}\nSee [log](log.md), [the rounds](log.md), the reading ${GONE}, [${CHAT.slice(0, -3)}](sources/${CHAT}) and [the ticket](sources/item-${TICKET}).\n`)
})

test('a page of the sheet is copied with it, a file in a folder of the research keeps its place, and a link from either leads where it led', () => {
  const page = `# Retries\n\n- **F6** \`verified\` A retry waits two seconds.\n  - Source: ${IN_THE_MAP.chat}\n  - Source: ${IN_THE_MAP.ticket}\n`
  const deeper = `# By hand\n\nSee [the sheet](../index.md), ${IN_THE_MAP.chat.replace('(sources/', '(../sources/')} and [the ticket](../../../work/PROJ-12/sources/${TICKET}).\n`
  const root = withResearch({ [`${DIR}/facts-retries.md`]: page, [`${DIR}/notes/by-hand.md`]: deeper })
  const out = elsewhere()

  const result = handover(root, NAME, out)
  const files = copied(out)

  assert.deepEqual(linesOf(result), [`handed over research gateway-limits to ${out}: 10 files`])
  assert.equal(files['facts-retries.md'], `# Retries\n\n- **F6** \`verified\` A retry waits two seconds.\n  - Source: ${COPIED.chat}\n  - Source: ${COPIED.ticket}\n`)
  assert.equal(files['notes/by-hand.md'], `# By hand\n\nSee [the sheet](../index.md), [${CHAT}](../sources/${CHAT}) and [the ticket](../sources/item-${TICKET}).\n`)
})

test('a fact on a page that rests only on a source left out is named with those of the sheet', () => {
  const page = `# Retries\n\n- **F6** \`verified\` A retry waits two seconds.\n  - Source: ${IN_THE_MAP.chat}\n`
  const root = withResearch({ [`${DIR}/facts-retries.md`]: page })
  const out = elsewhere()

  assert.deepEqual(linesOf(handover(root, NAME, out, '--without', 'chat')).slice(1), ['left out: 1 source of kind chat', 'F6 rests only on sources left out'])
})

test('a folder that cannot be written leaves nothing of a copy behind, and the command says so', BY_MODE, () => {
  const root = withResearch()
  const base = tree(makeTree({ 'closed/keep.txt': 'mine\n' }))
  chmodSync(join(base, 'closed'), 0o555)
  const out = join(base, 'closed', 'handed')

  const result = handover(root, NAME, out)
  chmodSync(join(base, 'closed'), 0o755)

  assert.deepEqual(result, refused(`${out} could not be written (EACCES), and nothing of the copy is left there`))
  assert.deepEqual(readdirSync(join(base, 'closed')), ['keep.txt'])
})

test('a saved source that cannot be read stops the hand-over before anything is written', BY_MODE, () => {
  const root = withResearch()
  const out = elsewhere()
  chmodSync(join(root, DIR, 'sources', CHAT), 0o000)

  const result = handover(root, NAME, out)
  chmodSync(join(root, DIR, 'sources', CHAT), 0o644)

  assert.deepEqual(result, refused(`nothing was handed over: ${DIR}/sources/${CHAT} cannot be read`))
  assert.ok(!existsSync(out))
})

test('a hand-over changes nothing in the map', () => {
  const root = withResearch()
  const before = copied(join(root, 'research'))

  handover(root, NAME, elsewhere(), '--without', 'mail', '--reading')

  assert.deepEqual(copied(join(root, 'research')), before)
  assert.equal(readFileSync(join(root, 'work/PROJ-12/sources', TICKET), 'utf8'), THE_TICKET)
})

test("a folder that is a link to a folder inside the map, a path that leads through a link into the map, and a folder of the map reached by another spelling of the path to it are inside the map, and a link to an empty folder outside it is taken", LINKS, () => {
  const root = withResearch()
  const outside = tree(makeTree({}))
  mkdirSync(join(root, 'research/empty-in-map'))
  mkdirSync(join(outside, 'real'))
  for (const [to, link] of [[join(root, 'research/empty-in-map'), 'link'], [join(root, 'research'), 'r'], [root, 'estate'], [join(outside, 'real'), 'to-real']]) symlinkSync(to, join(outside, link))

  for (const folder of [join(outside, 'link'), join(outside, 'r', 'handed'), join(outside, 'estate', 'concepts', 'handed'), join(outside, 'estate', 'areas', 'handed')]) assert.deepEqual(handover(root, NAME, folder), inTheMap(folder), folder)
  assert.deepEqual(readdirSync(join(root, 'research')).sort(), ['empty-in-map', 'gateway-limits'])
  assert.deepEqual(readdirSync(join(root, 'research/empty-in-map')), [])
  assert.ok(!existsSync(join(root, 'concepts/handed')) && !existsSync(join(root, 'areas')))
  assert.deepEqual(linesOf(handover(root, NAME, join(outside, 'to-real'))), [`handed over research gateway-limits to ${join(outside, 'to-real')}: 8 files`])
  assert.deepEqual(copied(join(outside, 'real')), kept(COPIED))
})

test('on a disk that holds one name under both letter cases, a folder inside the map that is spelt in another case is inside the map, and so is one inside a folder of the map that is not there yet', BLIND_TO_CASE, () => {
  const root = withResearch()

  for (const folder of ['Research/gateway-limits/sources/x', 'CONCEPTS/handed', 'Areas/handed', join(root.toUpperCase(), 'work', 'handed')]) assert.deepEqual(handover(root, NAME, folder), inTheMap(folder), folder)
  assert.deepEqual(readdirSync(join(root, DIR, 'sources')).sort(), [CHAT, MAIL, QUOTA])
  assert.ok(!existsSync(join(root, 'concepts/handed')) && !existsSync(join(root, 'areas')) && !existsSync(join(root, 'work/handed')))
})

test('on a disk that tells the cases of letters apart, a folder whose name differs from a folder of the map only in the case of its letters is outside the map', TELLS_CASES_APART, () => {
  const root = withResearch()

  assert.deepEqual(linesOf(handover(root, NAME, 'Concepts/handed')), ['handed over research gateway-limits to Concepts/handed: 8 files'])
  assert.deepEqual(copied(join(root, 'Concepts/handed')), kept(COPIED))
})

test("in a git work tree the folder the session's drafts lie in is the map too, so nothing is handed over into it for take to carry into the map, and a folder beside it is taken", () => {
  const one = inAMapInACheckout()
  tree(one.base)
  const linked = workTree(one, join(one.base, 'tree'))
  const from = (...args: string[]) => run(['research', 'handover', NAME, ...args], { cwd: linked, env: one.env })

  assert.deepEqual(from('.context-central/handed'), inTheMap('.context-central/handed'))
  assert.deepEqual(from(join(one.main, '.context-central', 'handed')), inTheMap(join(one.main, '.context-central', 'handed')))
  assert.ok(!existsSync(join(linked, '.context-central')) && !existsSync(join(one.main, '.context-central', 'handed')))
  assert.deepEqual(linesOf(from('handed')), ['handed over research gateway-limits to handed: 7 files'])
  assert.ok(existsSync(join(linked, 'handed', 'index.md')))
})

test('a link that leads nowhere is there already, so nothing is written through it and it is still there afterwards', LINKS, () => {
  const root = withResearch()
  const base = tree(makeTree({}))
  const dangling = join(base, 'dangling')
  symlinkSync(join(base, 'not-there'), dangling)

  assert.deepEqual(handover(root, NAME, dangling), refused(`${dangling} is there already and is not an empty folder, so nothing was handed over`))
  assert.ok(lstatSync(dangling).isSymbolicLink())
  assert.ok(!existsSync(join(base, 'not-there')))
})

test("a folder below one that cannot be searched, a folder that cannot be listed and a name too long for a folder are each refused in the plugin's own words, with what the system said in brackets", BY_MODE, () => {
  const root = withResearch()
  const base = tree(makeTree({ 'closed/inner/keep.txt': 'mine\n' }))
  mkdirSync(join(base, 'unlisted'))
  chmodSync(join(base, 'closed'), 0o000)
  chmodSync(join(base, 'unlisted'), 0o300)
  const folders = [join(base, 'closed', 'inner', 'handed'), join(base, 'unlisted'), join(base, 'n'.repeat(300))]

  const results = folders.map(folder => handover(root, NAME, folder))
  chmodSync(join(base, 'closed'), 0o755)
  chmodSync(join(base, 'unlisted'), 0o755)

  assert.deepEqual(results, [
    refused(`${folders[0]} cannot be reached (EACCES), so nothing was handed over`),
    refused(`${folders[1]} cannot be reached (EACCES), so nothing was handed over`),
    refused(`${folders[2]} cannot be reached (ENAMETOOLONG), so nothing was handed over`),
  ])
  assert.deepEqual(readdirSync(join(base, 'unlisted')), [])
})

test("two files that would take one name in the copy stop the hand-over with both named, and nothing is written: a source of the research's own under the name an item's file is given, two files of the item that come to one name, two names that differ only in the case of their letters, and a file under the name of a folder", () => {
  const out = elsewhere()
  const link = (file: string) => `${BRIEF}\nSee [it](../../work/PROJ-12/sources/${file}).\n`
  const own = withResearch({ [`${DIR}/sources/item-${TICKET}`]: "# The research's own\n" })
  const two = withResearch({ 'work/PROJ-12/sources/a/b.md': '# One\n', 'work/PROJ-12/sources/a-b.md': '# Two\n', [`${DIR}/brief.md`]: `${link('a/b.md')}${link('a-b.md')}` })
  const cases = withResearch({ 'work/PROJ-12/sources/Notes.md': '# Notes\n', [`${DIR}/sources/item-notes.md`]: '# Own\n', [`${DIR}/brief.md`]: link('Notes.md') })
  const folder = withResearch({ [`${DIR}/sources/item-${TICKET}/x.md`]: '# In a folder\n' })

  assert.deepEqual(handover(own, NAME, out), refused(`nothing was handed over: ${DIR}/sources/item-${TICKET} and work/PROJ-12/sources/${TICKET} would both be written as sources/item-${TICKET}`))
  assert.deepEqual(handover(two, NAME, out), refused('nothing was handed over: work/PROJ-12/sources/a-b.md and work/PROJ-12/sources/a/b.md would both be written as sources/item-a-b.md'))
  assert.deepEqual(handover(cases, NAME, out), refused(`nothing was handed over: ${DIR}/sources/item-notes.md and work/PROJ-12/sources/Notes.md would be written as sources/item-notes.md and sources/item-Notes.md, which are one name on a disk that does not tell the cases of letters apart`))
  assert.deepEqual(handover(folder, NAME, out), refused(`nothing was handed over: work/PROJ-12/sources/${TICKET} would be written as sources/item-${TICKET}, and ${DIR}/sources/item-${TICKET}/x.md into a folder of that name`))
  assert.ok(!existsSync(out))
})

test('a copy that cannot be written part of the way through is taken away again, with every folder this run made for it, and what was there before the run stays', () => {
  const long = `${'n'.repeat(248)}.md`
  const root = withResearch({ [`work/PROJ-12/sources/${long}`]: '# Long\n', [`${DIR}/brief.md`]: `${BRIEF}\nSee [the long one](../../work/PROJ-12/sources/${long}).\n` })
  const base = tree(makeTree({ 'keep.txt': 'mine\n' }))
  mkdirSync(join(base, 'empty'))
  const notWritten = /^context-central research: .+ could not be written \([A-Z]+\), and nothing of the copy is left there\n$/

  const deep = handover(root, NAME, join(base, 'p', 'q', 'r', 'handed'))
  const there = handover(root, NAME, join(base, 'empty'))

  assert.equal(deep.code, 1)
  assert.match(deep.stderr, notWritten)
  assert.equal(there.code, 1)
  assert.match(there.stderr, notWritten)
  assert.deepEqual(readdirSync(base).sort(), ['empty', 'keep.txt'])
  assert.deepEqual(readdirSync(join(base, 'empty')), [])
})
