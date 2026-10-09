import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { REPO, acme, disposable, makeTree, run } from './helpers.mts'
import type { Json } from './helpers.mts'

const SKILLS = ['onboard', 'standards', 'research', 'prep', 'design', 'implement', 'checkpoint']
const USER_ONLY = ['onboard', 'standards', 'research', 'prep', 'design', 'implement']
const AGENTS = ['reader', 'fetcher', 'reviewer']
const COMMANDS = ['config', 'where', 'work', 'resolve', 'index', 'note', 'graph', 'lint', 'doctor', 'detect', 'init', 'wrapper', 'budget', 'slice', 'fetch', 'evidence', 'connections', 'standards']
const SKILL_FIELDS = [
  'name', 'description', 'when_to_use', 'argument-hint', 'arguments', 'disable-model-invocation', 'user-invocable', 'allowed-tools',
  'disallowed-tools', 'model', 'effort', 'context', 'agent', 'background', 'hooks', 'paths', 'shell', 'metadata', 'license', 'compatibility',
]
const AGENT_FIELDS = [
  'name', 'description', 'tools', 'disallowedTools', 'model', 'permissionMode', 'maxTurns', 'skills', 'mcpServers', 'hooks', 'memory',
  'background', 'omitClaudeMd', 'effort', 'isolation', 'color', 'initialPrompt', 'experimental',
]

const FLAGS: Record<string, string[]> = {
  config: ['get'],
  where: ['json'],
  work: ['title', 'ticket', 'json', 'all'],
  resolve: ['max', 'json', 'absolute'],
  index: ['absolute', 'json'],
  note: ['new', 'title'],
  graph: ['json', 'strict'],
  lint: ['json', 'strict'],
  doctor: ['json'],
  detect: ['json'],
  init: ['from', 'dry-run', 'print-settings'],
  wrapper: ['write'],
  budget: ['json'],
  slice: ['toc', 'heading', 'lines', 'grep', 'context', 'max-bytes'],
  fetch: ['item', 'repo', 'connection', 'check'],
  connections: ['json', 'presets', 'ticket', 'pr', 'item'],
  evidence: ['item', 'as'],
  standards: ['json'],
}
const STATE_PARTS = ['Where it stands', 'Done', 'Next', 'Blocked', 'Standing traps', 'Where the detail lives']
const STANDARDS_PARTS = ['Design', 'Code', 'Tests', 'Review']

const tree = disposable()

type Draft = { config: { [key: string]: Json } }

const skillText = (name: string) => readFileSync(join(REPO, 'skills', name, 'SKILL.md'), 'utf8')
const agentText = (name: string) => readFileSync(join(REPO, 'agents', `${name}.md`), 'utf8')
const step = (name: string, heading: string) => skillText(name).split(/^## /m).find(part => part.startsWith(`${heading}\n`)) ?? ''
const lessons = () => step('checkpoint', '5. Lessons that outlive the item')
const everyFile = () => [...SKILLS.map(name => [`skills/${name}`, skillText(name)]), ...AGENTS.map(name => [`agents/${name}`, agentText(name)])]

function frontmatter(text: string) {
  const block = /^---\n([\s\S]*?)\n---\n/.exec(text)
  assert.ok(block, 'the file opens with a frontmatter block')
  return Object.fromEntries(block[1].split('\n').map(line => [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 1).trim()]))
}

const skill = (name: string) => frontmatter(skillText(name))
const agent = (name: string) => frontmatter(agentText(name))

test('every skill is named after its folder and says what it does', () => {
  for (const name of SKILLS) {
    assert.equal(skill(name).name, name)
    assert.ok(skill(name).description.length > 20, `${name} has a description`)
  }
})

test('the working skills run only when the person types them', () => {
  for (const name of USER_ONLY) assert.equal(skill(name)['disable-model-invocation'], 'true', name)
})

test('checkpoint can be reached by the model, on a description under 300 characters', () => {
  assert.equal('disable-model-invocation' in skill('checkpoint'), false)
  assert.equal('user-invocable' in skill('checkpoint'), false)
  assert.ok(skill('checkpoint').description.length < 300)
})

test('no skill sets a model or an effort level', () => {
  for (const name of SKILLS) {
    assert.equal('model' in skill(name), false, name)
    assert.equal('effort' in skill(name), false, name)
  }
})

test('every skill runs the plugin without a permission prompt', () => {
  for (const name of SKILLS) assert.equal(skill(name)['allowed-tools'], 'Bash(context-central *)', name)
})

test('the skills that take an argument say which', () => {
  assert.equal(skill('research')['argument-hint'], '<question> [item]')
  assert.equal(skill('prep')['argument-hint'], '<item>')
  assert.equal(skill('implement')['argument-hint'], '<item>')
  assert.equal(skill('standards')['argument-hint'], '<repo>')
  assert.equal(skill('design')['argument-hint'], '<item>')
})

test('every skill is under 120 lines', () => {
  for (const name of SKILLS) assert.ok(skillText(name).split('\n').length < 120, name)
})

test('only documented frontmatter fields are used', () => {
  for (const name of SKILLS) assert.deepEqual(Object.keys(skill(name)).filter(field => !SKILL_FIELDS.includes(field)), [], name)
  for (const name of AGENTS) assert.deepEqual(Object.keys(agent(name)).filter(field => !AGENT_FIELDS.includes(field)), [], name)
})

test('every plugin command a skill or agent mentions is a real command', () => {
  for (const [file, text] of everyFile()) {
    const mentioned = [...text.matchAll(/context-central ([a-z][a-z-]*)/g)].map(match => match[1])
    assert.deepEqual(mentioned.filter(command => !COMMANDS.includes(command)), [], file)
  }
})

test('every skill takes its estate facts from the plugin', () => {
  for (const name of SKILLS) assert.match(skillText(name), /context-central (config --get|resolve|detect) /, name)
})

test('the reader is a cheap, read-only agent that starts without the instruction files', () => {
  const { description, ...rest } = agent('reader')

  assert.ok(description.length > 20)
  assert.deepEqual(rest, { name: 'reader', tools: 'Read, Grep, Glob, Bash', model: 'sonnet', effort: 'medium', omitClaudeMd: 'true' })
})

test('the fetcher inherits whichever tracker and meeting tools the session has', () => {
  const { description, ...rest } = agent('fetcher')

  assert.ok(description.length > 20)
  assert.deepEqual(rest, { name: 'fetcher', model: 'sonnet', effort: 'low', omitClaudeMd: 'true' })
})

test('the reviewer keeps the instruction files and thinks hard', () => {
  const { description, ...rest } = agent('reviewer')

  assert.ok(description.length > 20)
  assert.deepEqual(rest, { name: 'reviewer', tools: 'Read, Grep, Glob, Bash', effort: 'high' })
})

test('skills name the agents by their plugin-scoped identifiers', () => {
  assert.match(skillText('research'), /context-central:reader/)
  assert.match(skillText('research'), /context-central:fetcher/)
  assert.match(skillText('implement'), /context-central:reviewer/)
  assert.match(skillText('implement'), /context-central:checkpoint/)
})

test('the text is plain: no em dashes and no emojis', () => {
  for (const [file, text] of everyFile()) assert.doesNotMatch(text, /—|\p{Extended_Pictographic}/u, file)
})

test('every flag a skill or agent passes to a plugin command is one that command takes', () => {
  for (const [file, text] of everyFile()) {
    for (const [, command, rest] of text.matchAll(/`context-central ([a-z]+)([^`]*)`/g)) {
      const flags = [...rest.matchAll(/--([a-z-]+)/g)].map(match => match[1])
      assert.deepEqual(flags.filter(flag => !FLAGS[command].includes(flag)), [], `${file}: ${command}`)
    }
  }
})

test('frontmatter values are plain YAML scalars, so the whole block parses', () => {
  for (const [file, text] of everyFile()) {
    for (const [field, value] of Object.entries(frontmatter(text))) {
      assert.doesNotMatch(value, /: | #|^[\[{>|*&!%@`'"]/, `${file}: ${field}`)
    }
  }
})

test('every description fits the 1,536 characters the skill listing keeps', () => {
  for (const [file, text] of everyFile()) assert.ok(frontmatter(text).description.length < 1536, file)
})

test('a user-only skill is only ever suggested to the person as a slash command', () => {
  for (const [file, text] of everyFile()) {
    for (const [, before, name] of text.matchAll(/(.)context-central:([a-z]+)/g)) {
      assert.ok([...SKILLS, ...AGENTS].includes(name), `${file}: ${name}`)
      if (USER_ONLY.includes(name)) assert.equal(before, '/', `${file}: ${name}`)
    }
  }
})

test('every setting a skill reads is one the onboard draft writes', () => {
  const draft = JSON.parse((/```json\n([\s\S]*?)```/.exec(skillText('onboard')) ?? [])[1]) as Draft
  const root = tree(makeTree({ 'estate.json': draft.config }))
  const keys = SKILLS.flatMap(name => [...skillText(name).matchAll(/context-central config --get ([A-Za-z.]+)/g)].map(match => match[1]))

  assert.deepEqual(Object.keys(draft), ['layout', 'git', 'config'])
  assert.ok(keys.includes('writeRules') && keys.includes('connections') && keys.includes('implement'))
  for (const key of keys) assert.equal(run(['config', '--get', key], { cwd: root }).code, 0, key)
})

test('the skills say what an unset setting looks like: config --get exits 1', () => {
  const root = tree(acme())

  assert.equal(run(['config', '--get', 'writeRules'], { cwd: root }).code, 1)
  for (const name of ['research', 'prep', 'implement']) assert.match(skillText(name), /absent makes `config --get` exit 1/, name)
})

test('checkpoint names the six parts of the state file that work new lays out', () => {
  const root = tree(acme())
  run(['work', 'new', 'PROJ-30'], { cwd: root })
  const state = readFileSync(join(root, 'work/PROJ-30/STATE.md'), 'utf8')

  for (const part of STATE_PARTS) {
    assert.ok(state.includes(`## ${part}\n`), part)
    assert.ok(skillText('checkpoint').includes(`- **${part}**:`), part)
  }
})

test('prep, design and implement tell an existing item from a near match by the resolver\'s first line', () => {
  const root = tree(acme())

  assert.equal(run(['resolve', 'PROJ-12'], { cwd: root }).stdout.split('\n')[0], 'Context for work item PROJ-12:')
  assert.equal(run(['resolve', 'PROJ-99 gateway web api'], { cwd: root }).stdout.split('\n')[0], 'Context for repo web:')
  for (const name of ['prep', 'design', 'implement']) assert.ok(skillText(name).includes('`Context for work item <item>:`'), name)
})

test('checkpoint names the message the plugin gives where no map covers the folder', () => {
  const root = tree(makeTree({ 'readme.md': '# no map here\n' }))
  const listed = run(['work', 'list'], { cwd: root })

  assert.equal(listed.code, 1)
  assert.match(listed.stderr, /no context map found/)
  assert.ok(skillText('checkpoint').includes('`no context map found`'))
})

test('the onboard draft carries whether evidence is committed', () => {
  const draft = JSON.parse((/```json\n([\s\S]*?)```/.exec(skillText('onboard')) ?? [])[1]) as Draft

  assert.deepEqual(draft.config.evidence, { commit: true })
})

test('the state file, both hub blocks and checkpoint agree on the name of the evidence folder', () => {
  const fresh = tree(makeTree({ 'answers.json': { layout: 'root', config: { name: 'acme' } } }))
  const lived = tree(makeTree({ 'answers.json': { layout: 'root', config: { name: 'acme' } }, 'CLAUDE.md': '# Our rules\n' }))
  for (const root of [fresh, lived]) run(['init', '--from', 'answers.json'], { cwd: root })
  run(['work', 'new', 'PROJ-30'], { cwd: fresh })

  assert.ok(readFileSync(join(fresh, 'work/PROJ-30/STATE.md'), 'utf8').includes('`evidence/`'))
  assert.ok(readFileSync(join(fresh, 'CLAUDE.md'), 'utf8').includes('`evidence/`'))
  assert.ok(readFileSync(join(lived, 'CLAUDE.md'), 'utf8').includes('`work/<item>/evidence/`'))
  assert.ok(skillText('checkpoint').includes('`work/<item>/evidence/'))
})

test('checkpoint asks the plugin where the glossary is, and the line of an entry that a correction fills is in the one init writes', () => {
  for (const [layout, map] of [['root', '.'], ['inner', '.context-central']]) {
    const root = tree(makeTree({ 'answers.json': { layout, config: { name: 'acme' } } }))
    run(['init', '--from', 'answers.json'], { cwd: root })

    assert.match(readFileSync(join(root, map, 'glossary.md'), 'utf8'), /^_Avoid_: /m, layout)
    assert.match(run(['where'], { cwd: root }).stdout, new RegExp(`^glossary: .*glossary\\.md$`, 'm'), layout)
  }
  assert.ok(lessons().includes('`context-central where`'))
  assert.ok(lessons().includes('`_Avoid_`'))
})

test('no skill and no agent names a vendor or the program one starts', () => {
  const presets = run(['connections', '--presets'], { cwd: REPO }).stdout.trimEnd().split('\n').map(line => line.split(' | '))
  const words = presets.flatMap(([name, , starts]) => [name, ...name.split('-'), starts.replace(/^starts /, '')])

  assert.ok(words.length >= 3)
  for (const [file, text] of everyFile()) {
    assert.deepEqual(words.filter(word => new RegExp(`(?<![A-Za-z0-9])${word}(?![A-Za-z0-9])`, 'i').test(text)), [], file)
  }
})

test('the resolver says when a reference reads as a ticket that no work item answers to', () => {
  const root = tree(acme())

  assert.equal(run(['resolve', 'PROJ-99'], { cwd: root }).stdout, 'PROJ-99 reads as a ticket of connection jira. No work item answers to it.\n')
})

const TWO_TRACKERS = {
  tracker: { holds: 'tickets', references: ['PROJ-\\d+'], how: 'open the tracker' },
  desk: { holds: 'tickets', references: ['DESK-\\d+'], server: 'acme-desk' },
}

const state = (id: string, ticket: string | null) => `---\nitem: ${id}\ntitle: Something\nstatus: active\n${ticket ? `ticket: "${ticket}"\n` : ''}---\n# ${id}: Something\n`
const twoTrackers = () => tree(acme({ 'work/DESK-7/STATE.md': state('DESK-7', 'DESK-7'), 'work/tidy-up/STATE.md': state('tidy-up', null), 'work/odd/STATE.md': state('odd', 'OTHER-1') }, { connections: TWO_TRACKERS }))

test('fetch says when a session reads the connection, and when more than one connection holds the kind', () => {
  const root = twoTrackers()

  const itsOwn = run(['fetch', 'ticket', '--item', 'DESK-7'], { cwd: root })
  const unclaimed = run(['fetch', 'ticket', 'OTHER-1', '--check'], { cwd: root })

  assert.equal(itsOwn.stderr, 'context-central fetch: connection desk is not read by fetch: it has no preset that reads tickets. A session reads it through the server acme-desk.\n')
  assert.equal(unclaimed.stderr, 'context-central fetch: more than one connection holds tickets: tracker, desk; name one with --connection\n')
})

test('fetch says when the item has no ticket', () => {
  assert.equal(run(['fetch', 'ticket', '--item', 'tidy-up'], { cwd: twoTrackers() }).stderr, 'context-central fetch: tidy-up has no ticket; name the reference to read\n')
})

test("connections --item names the connection the item's ticket belongs to", () => {
  assert.equal(run(['connections', '--item', 'DESK-7'], { cwd: twoTrackers() }).stdout, 'desk | tickets | by a session, through the server acme-desk\n')
})

test("connections --item says when no connection claims the item's ticket", () => {
  assert.equal(run(['connections', '--item', 'odd'], { cwd: twoTrackers() }).stderr, 'context-central connections: more than one connection holds tickets and none claims "OTHER-1": tracker, desk\n')
})

test('a map that records no connection says so of a reference, and its setting reads as empty', () => {
  const unrecorded = tree(makeTree({ 'estate.json': { contextCentral: 1, name: 'acme' }, 'CLAUDE.md': '# Acme\n' }))

  assert.match(run(['connections', '--ticket', '#41'], { cwd: unrecorded }).stdout, / \| not recorded in this map: its preset applies unasked\n$/)
  assert.equal(run(['config', '--get', 'connections'], { cwd: unrecorded }).stdout, '{}\n')
})

test("the draft that onboard shows is one the plugin reads, with every connection it holds", () => {
  const draft = JSON.parse((/```json\n([\s\S]*?)```/.exec(skillText('onboard')) ?? [])[1]) as Draft
  const root = tree(makeTree({ 'estate.json': draft.config, 'CLAUDE.md': '# Acme\n' }))

  const listed = run(['connections'], { cwd: root, env: { PATH: tree(makeTree({})) } })

  assert.equal(listed.stderr, '')
  assert.equal(listed.stdout, 'tracker | tickets | by a session, through the server the name of the server\ncode | pull-requests | by hand | as the pinned account\nnotes | meetings | by hand: how a person gets at them\n')
})

test('a reference in a command that a skill or an agent gives is in quotes, since one may start with a sign the shell reads as a comment', () => {
  for (const [file, text] of everyFile()) assert.doesNotMatch(text, /(--ticket|--pr|fetch (ticket|pr|issue)) <reference>/, file)
})

test('standards names the four parts that a new standards note lays out', () => {
  const root = tree(acme())
  run(['note', '--new', 'standards/api'], { cwd: root })
  const note = readFileSync(join(root, 'standards/api.md'), 'utf8')

  for (const part of STANDARDS_PARTS) {
    assert.ok(note.includes(`## ${part}\n`), part)
    assert.ok(skillText('standards').includes(`- **${part}**:`), part)
  }
})

test('standards names the marks the command prints, and what it exits with for a repo the estate does not register', () => {
  const recorded = { name: 'api', standards: ['api/CONTRIBUTING.md', 'api'], checks: ['./check.sh'] }
  const root = tree(acme({ 'standards/api.md': '# api\n' }, { repos: [{ name: 'web' }, recorded] as Json[] }))
  const printed = run(['standards', 'api'], { cwd: root }).stdout.split('\n')

  assert.deepEqual(printed.slice(1, 4), [`- ${join(root, 'standards/api.md')} (the standards note)`, `- ${join(root, 'api/CONTRIBUTING.md')} (missing)`, `- ${join(root, 'api')} (a folder)`])
  assert.ok(step('standards', '1. Find the repo').includes('`(the standards note)`'))
  for (const mark of ['`(missing)`', '`(a folder)`']) assert.ok(step('standards', '6. Check').includes(mark), mark)
  assert.equal(run(['standards', 'billing'], { cwd: root }).code, 1)
  assert.ok(step('standards', '1. Find the repo').includes('`standards` exit 1'))
})

test('a repo entry written as a bare name reads back with its path and its name', () => {
  const root = tree(acme({}, { repos: ['web'] }))

  assert.deepEqual(JSON.parse(run(['config', '--get', 'repos'], { cwd: root }).stdout) as unknown, [{ path: 'web', name: 'web' }])
})

test('standards ends on doctor, whose notes line says when git would leave the note out', () => {
  const root = tree(acme())

  assert.match(run(['doctor'], { cwd: root }).stdout, /^ok {3}notes$/m)
  assert.match(step('standards', '6. Check'), /`FIX` line for `notes`/)
})

test("note --new refuses a kind the map does not list, and a name that cannot be a note's", () => {
  const ownKinds = run(['note', '--new', 'standards/api'], { cwd: tree(acme({}, { nodeDirs: ['repos', 'work'] })) })
  const oddName = run(['note', '--new', 'standards/api tools'], { cwd: tree(acme()) })

  assert.equal(ownKinds.code, 2)
  assert.equal(ownKinds.stderr, 'context-central note: expected --new <kind>/<name>, where the kind is one of: repos\n')
  assert.equal(oddName.code, 2)
  assert.match(oddName.stderr, /the kind is one of: .*standards\n$/)
})

test('a design linked from the state file is a pointer of its item, which is where design puts it', () => {
  const state = '---\nitem: PROJ-12\ntitle: Rate limit the gateway\nstatus: active\n---\n# PROJ-12\n\n## Where the detail lives\n\n- Design: [DESIGN.md](DESIGN.md)\n'
  const root = tree(acme({ 'work/PROJ-12/STATE.md': state, 'work/PROJ-12/DESIGN.md': '# Design\n' }))

  const pointers = run(['resolve', 'PROJ-12'], { cwd: root }).stdout.split('\n')

  assert.ok(pointers.includes('- work/PROJ-12/DESIGN.md (9 B) linked from the work item'))
  assert.ok(step('design', '5. Show it').includes('`[DESIGN.md](DESIGN.md)`'))
})

test('nothing calls an unfixed finding one that stands, which is what implement once called an answered one', () => {
  for (const [file, text] of everyFile()) assert.doesNotMatch(text, /finding[^.]*\bstand(s|ing)\b|\bstand(s|ing)\b[^.]*finding/, file)
  const docs = readdirSync(join(REPO, 'docs')).filter(name => name.endsWith('.md')).map(name => join('docs', name))
  for (const file of ['README.md', 'CONTEXT.md', ...docs]) assert.doesNotMatch(readFileSync(join(REPO, file), 'utf8'), /finding[^.|]*\bstanding\b/, file)
})

test('a review round count that is not a whole number of one or more is still a setting the plugin reads', () => {
  const root = tree(acme({}, { implement: { review: true, reviewRounds: 0 } }))

  assert.equal(run(['config', '--get', 'implement.reviewRounds'], { cwd: root }).stdout, '0\n')
})

test('the onboard draft carries the implement settings, with three review rounds', () => {
  const draft = JSON.parse((/```json\n([\s\S]*?)```/.exec(skillText('onboard')) ?? [])[1]) as Draft

  assert.deepEqual(draft.config.implement, { tests: true, review: true, deferTo: '', reviewRounds: 3 })
})
