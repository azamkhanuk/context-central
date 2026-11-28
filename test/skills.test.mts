import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { ACME_FILES, REPO, SOLO_STATE, acme, checkout, disposable, git, makeTree, run, solo, workTree } from './helpers.mts'
import type { Checkout, Json } from './helpers.mts'

const SKILLS = ['onboard', 'standards', 'research', 'prep', 'design', 'implement', 'checkpoint']
const USER_ONLY = ['onboard', 'standards', 'research', 'prep', 'design', 'implement']
const AGENTS = ['reader', 'fetcher', 'reviewer', 'sweeper', 'web-reader']
const COMMANDS = ['config', 'where', 'work', 'resolve', 'index', 'note', 'graph', 'lint', 'doctor', 'detect', 'init', 'wrapper', 'budget', 'slice', 'fetch', 'evidence', 'connections', 'standards', 'draft', 'take', 'proof', 'research']
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
  init: ['from', 'plain', 'dry-run', 'print-settings'],
  wrapper: ['write'],
  budget: ['json'],
  slice: ['toc', 'heading', 'lines', 'grep', 'context', 'max-bytes'],
  fetch: ['item', 'research', 'repo', 'connection', 'check'],
  connections: ['json', 'presets', 'ticket', 'pr', 'item'],
  evidence: ['item', 'as'],
  standards: ['json'],
  draft: [],
  take: ['over'],
  proof: ['check', 'exit'],
  research: ['title', 'item', 'json', 'without', 'reading'],
}
const STATE_PARTS = ['Where it stands', 'Done', 'Next', 'Blocked', 'Standing traps', 'Where the detail lives']
const STANDARDS_PARTS = ['Design', 'Code', 'Tests', 'Review']

const tree = disposable()

type Draft = { config: { [key: string]: Json } }

const skillFile = (name: string) => readFileSync(join(REPO, 'skills', name, 'SKILL.md'), 'utf8')
const referenceNames = (name: string) => (existsSync(join(REPO, 'skills', name, 'references')) ? readdirSync(join(REPO, 'skills', name, 'references')).sort().map(file => `references/${file}`) : [])
const referenceText = (name: string, file: string) => readFileSync(join(REPO, 'skills', name, file), 'utf8')
const skillText = (name: string) => [skillFile(name), ...referenceNames(name).map(file => referenceText(name, file))].join('\n')
const agentText = (name: string) => readFileSync(join(REPO, 'agents', `${name}.md`), 'utf8')
const partOf = (text: string, heading: string) => text.split(/^## /m).find(part => part.startsWith(`${heading}\n`)) ?? ''
const step = (name: string, heading: string) => partOf(skillFile(name), heading)
const lessons = () => step('checkpoint', '5. Lessons that outlive the item')
const everyHead = () => [...SKILLS.map(name => [`skills/${name}`, skillFile(name)]), ...AGENTS.map(name => [`agents/${name}`, agentText(name)])]
const everyFile = () => [...everyHead(), ...SKILLS.flatMap(name => referenceNames(name).map(file => [`skills/${name}/${file}`, referenceText(name, file)]))]

function frontmatter(text: string) {
  const block = /^---\n([\s\S]*?)\n---\n/.exec(text)
  assert.ok(block, 'the file opens with a frontmatter block')
  return Object.fromEntries(block[1].split('\n').map(line => [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 1).trim()]))
}

const skill = (name: string) => frontmatter(skillFile(name))
const agent = (name: string) => frontmatter(agentText(name))

test('every skill names the bin script by its place in the plugin, two folders above the skill, for a host that does not put the command on the PATH', () => {
  for (const name of SKILLS) {
    assert.ok(skillFile(name).includes('`bin/context-central`'), `${name} names the bin script`)
    assert.equal(existsSync(join(REPO, 'skills', name, '..', '..', 'bin', 'context-central')), true, `${name} is two folders below the bin script's folder`)
  }
})

test('research tells that the plugin is loaded by an agent of the plugin, named as its file names it, in each of the three places that say when it was taken alone', () => {
  assert.equal(agent('reader').name, 'reader')
  for (const text of [skillFile('research'), referenceText('research', 'references/agents.md'), referenceText('research', 'references/answer.md')]) {
    assert.ok(text.includes('`context-central:reader`'))
  }
})

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

test('every skill runs the plugin without a permission prompt, and one with reference files reads its own folder without one', () => {
  for (const name of SKILLS) assert.equal(skill(name)['allowed-tools'], referenceNames(name).length > 0 ? 'Bash(context-central *) Read(/${CLAUDE_SKILL_DIR}/**)' : 'Bash(context-central *)', name)
})

test('the skills that take an argument say which', () => {
  assert.equal(skill('research')['argument-hint'], '<question> [item]')
  assert.equal(skill('prep')['argument-hint'], '<item>')
  assert.equal(skill('implement')['argument-hint'], '<item>')
  assert.equal(skill('standards')['argument-hint'], '<repo>')
  assert.equal(skill('design')['argument-hint'], '<item>')
})

test('every skill is under 120 lines', () => {
  for (const name of SKILLS) assert.ok(skillFile(name).split('\n').length < 120, name)
})

test('only documented frontmatter fields are used', () => {
  for (const name of SKILLS) assert.deepEqual(Object.keys(skill(name)).filter(field => !SKILL_FIELDS.includes(field)), [], name)
  for (const name of AGENTS) assert.deepEqual(Object.keys(agent(name)).filter(field => !AGENT_FIELDS.includes(field)), [], name)
})

test('every reference file a skill names is in its folder, its folder holds none that the skill itself does not name, and a reference file names none that is not there', () => {
  const namedIn = (text: string) => [...new Set([...text.matchAll(/`(references\/[a-z0-9-]+\.md)`/g)].map(([, file]) => file))].sort()

  for (const name of SKILLS) {
    assert.deepEqual(namedIn(skillFile(name)), referenceNames(name), name)
    for (const file of referenceNames(name)) assert.deepEqual(namedIn(referenceText(name, file)).filter(named => !referenceNames(name).includes(named)), [], file)
  }
})

test('a skill with reference files gives the command that prints one where its read is refused, and that command prints each of them whole', () => {
  const withReferences = SKILLS.filter(name => referenceNames(name).length > 0)

  assert.ok(withReferences.includes('research'))
  for (const name of withReferences) {
    assert.ok(skillFile(name).includes("`context-central slice <the file's full path> --lines 1-400`"), name)
    for (const file of referenceNames(name)) {
      const { stdout } = run(['slice', join(REPO, 'skills', name, file), '--lines', '1-400'])

      assert.equal(stdout.slice(stdout.indexOf('\n') + 1), referenceText(name, file), file)
    }
  }
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

test('the sweeper is a cheap agent that starts without the instruction files and is denied the tools that write a file', () => {
  const { description, ...rest } = agent('sweeper')

  assert.ok(description.length > 20)
  assert.deepEqual(rest, { name: 'sweeper', disallowedTools: 'Write, Edit, NotebookEdit', model: 'sonnet', effort: 'medium', omitClaudeMd: 'true' })
})

test('the web reader is a cheap agent that holds the two tools that read the web and no other', () => {
  const { description, ...rest } = agent('web-reader')

  assert.ok(description.length > 20)
  assert.deepEqual(rest, { name: 'web-reader', tools: 'WebFetch, WebSearch', model: 'sonnet', effort: 'medium', omitClaudeMd: 'true' })
})

test("the brief research hands a host's own subagent, where the session holds no agent of the plugin, is that agent's own text, word for word", () => {
  for (const name of ['sweeper', 'web-reader']) assert.equal(referenceText('research', `references/${name}.md`), agentText(name).replace(/^---\n[\s\S]*?\n---\n\n/, ''), name)
})

test("the brief research hands a host's own subagent for reading or for fetching ends in that agent's own text, word for word, after one paragraph on what it is handed", () => {
  for (const name of ['reader', 'fetcher']) {
    const brief = referenceText('research', `references/${name}.md`)
    const own = agentText(name).replace(/^---\n[\s\S]*?\n---\n\n/, '')

    assert.ok(brief.endsWith(own), name)
    assert.equal(brief.slice(0, -own.length).split('\n\n').filter(Boolean).length, 1, name)
  }
})

test('research says in its head, for a host that reads the open skill format, the Node and the command it needs, as the package gives them, and no other skill says it', () => {
  const { engines, bin } = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as { engines: { node: string }, bin: { [name: string]: string } }
  const needs = skill('research').compatibility ?? ''

  assert.deepEqual(Object.keys(bin), ['context-central'])
  assert.ok(needs.includes(`Node ${engines.node.replace(/^>=/, '')} `), needs)
  assert.ok(needs.includes('`context-central`'), needs)
  assert.ok(needs.length <= 500)
  assert.deepEqual(SKILLS.filter(name => 'compatibility' in skill(name)), ['research'])
})

test('research is kept to the person on a host that reads agents/openai.yaml beside the skill, as its head keeps it on Claude Code, and the file reads a key a line', () => {
  const lines = readFileSync(join(REPO, 'skills', 'research', 'agents', 'openai.yaml'), 'utf8').split('\n').filter(line => line !== '')
  const above: string[] = []
  const read = lines.flatMap(line => {
    const match = /^( *)([a-z_]+):(?: (\S.*))?$/.exec(line)
    assert.ok(match, line)
    above.length = match[1].length / 2
    above.push(match[2])
    return match[3] === undefined ? [] : [[above.join('.'), match[3]]]
  })

  assert.deepEqual(Object.fromEntries(read), { 'policy.allow_implicit_invocation': 'false' })
  assert.equal(skill('research')['disable-model-invocation'], 'true')
  assert.deepEqual(SKILLS.filter(name => existsSync(join(REPO, 'skills', name, 'agents'))), ['research'])
})

test('skills name the agents by their plugin-scoped identifiers', () => {
  for (const name of ['reader', 'fetcher', 'sweeper', 'web-reader']) assert.ok(step('research', '2. Gather from primary sources').includes(`\`context-central:${name}\``), name)
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
  for (const [file, text] of everyHead()) {
    for (const [field, value] of Object.entries(frontmatter(text))) {
      assert.doesNotMatch(value, /: | #|^[\[{>|*&!%@`'"]/, `${file}: ${field}`)
    }
  }
})

test('every description fits the 1,536 characters the skill listing keeps', () => {
  for (const [file, text] of everyHead()) assert.ok(frontmatter(text).description.length < 1536, file)
})

test('a user-only skill is only ever suggested to the person as a slash command', () => {
  for (const [file, text] of everyFile()) {
    for (const [, before, name] of text.matchAll(/(.)context-central:([a-z-]+)/g)) {
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

test('the four steps and checkpoint name the message the plugin gives where no map covers the folder, and the steps name the two commands that make a plain one', () => {
  const root = tree(makeTree({ 'readme.md': '# no map here\n' }))
  const listed = run(['work', 'list'], { cwd: root })
  const resolved = run(['resolve', 'PROJ-12', '--absolute'], { cwd: root })

  assert.equal(listed.code, 1)
  assert.match(listed.stderr, /no context map found/)
  assert.equal(resolved.code, 1)
  assert.match(resolved.stderr, /no context map found/)
  for (const name of ['research', 'prep', 'design', 'implement', 'checkpoint']) assert.ok(skillText(name).includes('`no context map found`'), name)
  for (const name of ['research', 'prep', 'design', 'implement']) {
    assert.ok(skillText(name).includes('`context-central init --plain --dry-run`'), name)
    assert.ok(skillText(name).includes('`context-central init --plain`'), name)
  }
})

test('design and implement name the line standards prints for a repo the map does not register', () => {
  const root = tree(acme())

  const result = run(['standards', 'billing'], { cwd: root })

  assert.equal(result.code, 1)
  assert.match(result.stderr, /^context-central standards: no repo "billing" in this estate\./)
  for (const name of ['design', 'implement']) assert.ok(skillText(name).includes('`no repo "<repo>" in this estate`'), name)
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

test("the draft that onboard shows carries a repo's remote, which the plugin reads back and doctor puts in the line that clones the repo", () => {
  const draft = JSON.parse((/```json\n([\s\S]*?)```/.exec(skillText('onboard')) ?? [])[1]) as Draft
  const root = tree(makeTree({ 'estate.json': draft.config, 'CLAUDE.md': '# Acme\n' }))

  assert.deepEqual((JSON.parse(run(['config', '--get', 'repos'], { cwd: root }).stdout) as { remote: string }[]).map(repo => repo.remote), ['https://git.example.com/acme/web.git'])
  assert.match(run(['doctor'], { cwd: root, env: { PATH: tree(makeTree({})) } }).stdout, new RegExp(`^FIX {2}repos: no folder at web; from ${root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} run git clone https://git\\.example\\.com/acme/web\\.git web, or take the entry out of estate\\.json$`, 'm'))
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

test('standards names the commit line a new standards note lays out, and says to fill it', () => {
  const root = tree(acme())
  run(['note', '--new', 'standards/api'], { cwd: root })
  const note = readFileSync(join(root, 'standards/api.md'), 'utf8')

  assert.ok(note.includes('at `<commit>`, on <date>.'))
  assert.ok(step('standards', '5. Write').includes('`<commit>`'))
  assert.ok(step('standards', '5. Write').includes('`<date>`'))
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

test("a fault the map's checks print starts with a word in capitals, which is how standards and checkpoint tell one from the rest", () => {
  const hub = '# Acme estate\n\nShipped the limiter on 2026-01-09.\nReviewed 12 Sep.\nPaused 3 January.\n\nResumed 2026-01-14.\n'
  const faulty = tree(acme({ 'CLAUDE.md': hub, 'work/PROJ-13/STATE.md': `# PROJ-13\n${'a'.repeat(395)}`, 'repos/web.md': '# web\n\nTalks through [[concepts/missing]].\n' }, { budgets: { stateChars: 400 } }))
  const misconfigured = tree(acme({}, { evidence: { commit: 'yes' } }))
  const printed = (command: string, root: string) => run([command], { cwd: root }).stdout.split('\n')
  const inCapitals = (lines: string[]) => [...new Set(lines.flatMap(line => /^[A-Z]{2,}(?= )/.exec(line) ?? []))].sort()
  const others = (lines: string[]) => lines.filter(line => !/^[A-Z]{2,} /.test(line))

  assert.deepEqual(inCapitals(printed('lint', faulty)), ['ERROR', 'WARN'])
  assert.deepEqual(inCapitals(printed('graph', faulty)), ['BROKEN', 'ORPHAN', 'UNREFERENCED'])
  assert.deepEqual(inCapitals(printed('doctor', misconfigured)), ['FIX'])
  assert.deepEqual(others(printed('lint', faulty)), [''])
  assert.deepEqual(others(printed('lint', tree(acme()))), ['ok', ''])
  assert.deepEqual(others(printed('graph', faulty)).map(line => line.replace(/\d+/g, 'N')), ['N nodes, N links', ''])
  assert.deepEqual(others(printed('doctor', misconfigured)), ['ok   node', ''])
  for (const line of printed('doctor', tree(acme()))) assert.match(line, /^(ok {3}|note |FIX {2}|$)/)
  for (const name of ['`ERROR`', '`BROKEN`']) assert.ok(step('standards', '6. Check').includes(name) && step('checkpoint', '7. Check').includes(name), name)
})

test("note --new refuses a kind the map does not list, and a name that cannot be a note's", () => {
  const ownKinds = run(['note', '--new', 'standards/api'], { cwd: tree(acme({}, { nodeDirs: ['repos', 'work'] })) })
  const oddName = run(['note', '--new', 'standards/api tools'], { cwd: tree(acme()) })

  assert.equal(ownKinds.code, 2)
  assert.equal(ownKinds.stderr, 'context-central note: expected --new <kind>/<name>, where the kind is one of: repos\n')
  assert.equal(oddName.code, 2)
  assert.match(oddName.stderr, /the kind is one of: .*standards\n$/)
})

test('a design beside the spec is a pointer of its item under its own label, and the design skill links it from the state file', () => {
  const state = '---\nitem: PROJ-12\ntitle: Rate limit the gateway\nstatus: active\n---\n# PROJ-12\n\n## Where the detail lives\n\n- Design: [DESIGN.md](DESIGN.md)\n'
  const root = tree(acme({ 'work/PROJ-12/STATE.md': state, 'work/PROJ-12/DESIGN.md': '# Design\n' }))

  const pointers = run(['resolve', 'PROJ-12'], { cwd: root }).stdout.split('\n')

  assert.ok(pointers.includes('- work/PROJ-12/DESIGN.md (9 B) design of the work item'))
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

test('every skill writes the files of the map through draft and take', () => {
  for (const name of SKILLS) {
    assert.match(skillText(name), /`context-central draft /, name)
    assert.match(skillText(name), /`context-central take`/, name)
  }
})

test('the skills name the lines take prints for a draft it took and for one it kept', () => {
  const made = solo()
  tree(made.base)
  const inside = workTree(made, join(made.main, '.claude', 'worktrees', 'limit'))
  mkdirSync(join(inside, '.context-central', 'work', 'PROJ-12'), { recursive: true })
  writeFileSync(join(inside, '.context-central', 'work', 'PROJ-12', 'SPEC.md'), '# Spec\n')
  writeFileSync(join(inside, '.context-central', SOLO_STATE), '# PROJ-12, written with no draft\n')

  const result = run(['take'], { cwd: inside, env: made.env })

  assert.equal(result.stdout, 'took work/PROJ-12/SPEC.md\n')
  assert.match(result.stderr, /^context-central take: kept work\/PROJ-12\/STATE\.md: .* then run context-central take --over work\/PROJ-12\/STATE\.md\n$/)
  for (const name of ['checkpoint', 'prep', 'design', 'research', 'standards', 'implement']) {
    assert.ok(skillText(name).includes('`took <path>`'), name)
    assert.ok(skillText(name).includes('`kept <path>: <why>`'), name)
  }
})

function soloWorkTree() {
  const made = solo()
  tree(made.base)
  return { ...made, inside: workTree(made, join(made.main, '.claude', 'worktrees', 'limit')) }
}

test('implement names the line where prints in a work tree', () => {
  const made = soloWorkTree()

  const where = run(['where'], { cwd: made.inside, env: made.env }).stdout.split('\n')

  assert.equal(where[4], `work tree: ${made.inside}, of the checkout at ${made.main}`)
  assert.ok(skillText('implement').includes('`work tree:`'))
})

test("implement and checkpoint name the one note an item's review is kept in, at a place draft prints a path for", () => {
  const made = soloWorkTree()

  const drafted = run(['draft', 'work/PROJ-12/notes/review.md'], { cwd: made.inside, env: made.env })

  assert.deepEqual(drafted, { code: 0, stdout: `${join(made.inside, '.context-central', 'work', 'PROJ-12', 'notes', 'review.md')}\n`, stderr: '' })
  assert.ok(step('implement', '5. Review').includes('`work/<item>/notes/review.md`'))
  assert.ok(lessons().includes('`work/<item>/notes/review.md`'))
})

test("checkpoint ends a rule learned from review in the form lint reads as the rule's own commit, a line and then the commit it was read at", () => {
  const form = '`<file:line>` at `<short commit>`'
  const made = solo()
  tree(made.base)
  const read = git(made, made.main, 'rev-parse', '--short', 'HEAD').stdout.trim()
  writeFileSync(join(made.main, 'src', 'app.js'), 'export const limited = true\n')
  git(made, made.main, 'commit', '-q', '-am', 'second')
  const built = git(made, made.main, 'rev-parse', '--short', 'HEAD').stdout.trim()
  const note = (source: string) => `# solo\n\nRead at \`${read}\`.\n\n## Code\n\n- A module says what it limits. Source: review round 1 of the work item \`PROJ-12\`, 2026-01-15, ${source}.\n`
  mkdirSync(join(made.main, '.context-central', 'standards'))
  const printedFor = (source: string) => {
    writeFileSync(join(made.main, '.context-central', 'standards', 'solo.md'), note(source))
    return run(['lint'], { cwd: made.main, env: made.env }).stdout
  }

  assert.match(printedFor('`src/app.js:1`'), /^WARN standards: .* has 1 citation that has moved /)
  assert.equal(printedFor(form.replace('<file:line>', 'src/app.js:1').replace('<short commit>', built)), 'ok\n')
  assert.ok(lessons().includes(form))
})

test('design and implement name the start of the line lint prints for a standards note whose citation has moved', () => {
  const made = solo()
  tree(made.base)
  const read = git(made, made.main, 'rev-parse', '--short', 'HEAD').stdout.trim()
  mkdirSync(join(made.main, '.context-central', 'standards'))
  writeFileSync(join(made.main, '.context-central', 'standards', 'solo.md'), `# solo\n\nRead at \`${read}\`.\n\n## Code\n\n- A module exports what it has, as \`src/app.js:1\`.\n`)
  writeFileSync(join(made.main, 'src', 'app.js'), 'export const limited = true\n')
  git(made, made.main, 'commit', '-q', '-am', 'second')

  const printed = run(['lint'], { cwd: made.main, env: made.env }).stdout

  assert.match(printed, /^WARN standards: .* \/context-central:standards solo refreshes the note\n$/)
  assert.ok(step('design', '2. Load the standards').includes('`WARN standards:`'))
  assert.ok(step('implement', "2. Read the estate's settings").includes('`WARN standards:`'))
})

test("checkpoint reads an item's pull request with fetch, which saves a copy in the item, or through the fetcher", () => {
  assert.ok(step('checkpoint', '2. Establish the facts').includes('`context-central fetch pr "<reference>" --item <item>`'))
  assert.ok(step('checkpoint', '2. Establish the facts').includes('`context-central:fetcher`'))
})

test('checkpoint and standards log a change to the rules of a standards note as a line that opens with the repo', () => {
  assert.ok(step('checkpoint', '6. Log').includes('`context-central note "standards <repo>: '))
  assert.ok(step('standards', '5. Write').includes('`context-central note "standards <repo>: '))
})

test('standards logs the refresh of a note that was there as a line of its own, with the commit the note was read again at', () => {
  assert.ok(step('standards', '5. Write').includes('`context-central note "standards <repo>: refreshed at <short commit>: '))
})

test("standards, design and implement take a repo's folder from the root standards gives as JSON", () => {
  const made = soloWorkTree()

  const [recorded] = JSON.parse(run(['standards', 'solo', '--json'], { cwd: made.inside, env: made.env }).stdout) as { root: unknown }[]

  assert.equal(recorded.root, made.inside)
  for (const name of ['standards', 'design', 'implement']) {
    assert.ok(skillText(name).includes('`context-central standards <repo> --json`'), name)
    assert.ok(skillText(name).includes('`root`'), name)
  }
})

test('onboard names every key of a connection that the plugin reads', () => {
  const source = readFileSync(join(REPO, 'lib', 'connections.mts'), 'utf8')
  const textKeys = [...(/const TEXT_KEYS = \[([^\]]+)\]/.exec(source)?.[1] ?? '').matchAll(/'([A-Za-z]+)'/g)].map(([, key]) => key)
  const read = [...new Set([...textKeys, ...[...source.matchAll(/entry\.([A-Za-z]+)/g)].map(([, key]) => key)])]
  const drafting = step('onboard', '3. Draft the config')
  const [, json = '{}'] = /```json\n([\s\S]*?)```/.exec(drafting) ?? []
  const entries = Object.values((JSON.parse(json) as { config: { connections: Record<string, Record<string, Json>> } }).config.connections)
  const named = new Set([...[...drafting.replace(json, '').matchAll(/[`"]([A-Za-z]+)[`"]/g)].map(([, key]) => key), ...entries.flatMap(entry => Object.keys(entry))])

  assert.ok(read.length >= 9)
  assert.ok(read.includes('researchSkill'))
  assert.deepEqual(read.filter(key => !named.has(key)), [])
})

test("research starts the estate's own skill for research where config --get prints one, and a connection's in place of its sweep where connections gives that skill as the way it is searched", () => {
  const root = tree(acme({}, { researchSkill: 'acme-kit:deep-dig', connections: { wiki: { holds: 'documents', server: 'pages', researchSkill: 'acme-kit:wiki-search' } } }))
  const skills = partOf(referenceText('research', 'references/agents.md'), "Skills of the estate's own")

  assert.equal(run(['config', '--get', 'researchSkill'], { cwd: root }).stdout, 'acme-kit:deep-dig\n')
  assert.equal(run(['config', '--get', 'researchSkill'], { cwd: tree(acme()) }).code, 1)
  assert.deepEqual((JSON.parse(run(['connections', '--json'], { cwd: root }).stdout) as { search: unknown }[]).map(({ search }) => search), [{ by: 'skill', skill: 'acme-kit:wiki-search' }])
  for (const named of ['`context-central config --get researchSkill`', '`context-central connections --json`', '`search`', '`skill`', '`context-central standards <repo>`', '`- research: <skill>`']) assert.ok(skills.includes(named), named)
})

test("research lays a run's part of the reading out as the estate's own template does where config --get prints its place, which is the file research new wrote as the reading", () => {
  const template = '# What we make of it\n\n## <the day>\n\n### For the board\n'
  const root = tree(acme({ 'templates/reading.md': template }, { readingTemplate: 'templates/reading.md' }))
  run(['research', 'new', 'gateway-limits'], { cwd: root })

  assert.equal(run(['config', '--get', 'readingTemplate'], { cwd: root }).stdout, 'templates/reading.md\n')
  assert.equal(run(['config', '--get', 'readingTemplate'], { cwd: tree(acme()) }).code, 1)
  assert.equal(readFileSync(join(root, 'research', 'gateway-limits', 'reading.md'), 'utf8'), template)
  assert.ok(partOf(referenceText('research', 'references/folder.md'), 'The reading').includes('`context-central config --get readingTemplate`'))
  assert.ok(step('research', "4. Write the research's folder").includes('`context-central config --get readingTemplate`'))
})

test('research makes its folder with research new, whose answer gives the place of the fact sheet, and names the refusal of a name that is taken', () => {
  const root = tree(acme())

  const made = run(['research', 'new', 'gateway-limits', '--title', 'How the gateway limits a shop', '--json'], { cwd: root })
  const again = run(['research', 'new', 'gateway-limits'], { cwd: root })

  assert.deepEqual(JSON.parse(made.stdout) as unknown, { sheet: 'research/gateway-limits/index.md', git: null })
  assert.equal(again.stderr, 'context-central research: research/gateway-limits is there already\n')
  for (const named of ['`context-central research new <name> --title "<title>" --json`', '`sheet`', '`is there already`']) assert.ok(step('research', '1. Place the question').includes(named), named)
})

test('research goes on where resolve finds nothing in the map for the question, which it tells by the words that answer opens with', () => {
  const root = tree(acme())

  assert.equal(run(['resolve', 'supplier rate card overage', '--absolute'], { cwd: root }).stdout, 'No confident match for "supplier rate card overage".\n')
  assert.ok(step('research', '1. Place the question').includes('`No confident match`'))
})

test('research opens each round with research open, and takes the last round, the next numbers of a fact and of a source and the day from the lines it prints', () => {
  const root = tree(acme())
  run(['research', 'new', 'gateway-limits'], { cwd: root })

  const printed = run(['research', 'open', 'gateway-limits'], { cwd: root }).stdout.split('\n')

  assert.deepEqual(printed.filter(line => /^(facts|sources|rounds|dates):/.test(line)), [
    'facts: none; the next is F1',
    'sources: none saved; the next is 01',
    'rounds: none',
    'dates: today is 2026-01-15, 30 days on is 2026-02-14, 7 days on is 2026-01-22',
  ])
  assert.ok(printed.some(line => line.startsWith('sheet: ')))
  for (const label of ['`sources:`', '`dates:`']) assert.ok(step('research', '2. Gather from primary sources').includes(label), label)
  for (const label of ['`facts:`', '`rounds:`', '`dates:`', '`sheet:`']) assert.ok(referenceText('research', 'references/folder.md').includes(label), label)
  for (const label of ['`context-central research open <name>`', '`rounds:`', '`none`', '`facts:`', '`sources:`', '`dates:`']) assert.ok(partOf(referenceText('research', 'references/run.md'), 'Rounds').includes(label), label)
})

const fencedUnder = (text: string, heading: string) => (/^````\n([\s\S]*?)^````$/m.exec(text.slice(text.indexOf(`\n## ${heading}\n`))) ?? [])[1] ?? ''

test("a research written as the skill's layout shows it is one the plugin reads whole: research open counts its facts and its rounds, and lint and graph say nothing of it", () => {
  const layout = referenceText('research', 'references/folder.md')
  const sheet = fencedUnder(layout, 'The fact sheet')
  const log = fencedUnder(layout, 'The log')
  const saved = [...new Set([...`${sheet}${log}`.matchAll(/\]\((sources\/[^)]+)\)/g)].map(([, file]) => file))]
  const state = `${ACME_FILES['work/PROJ-12/STATE.md']}\n## Where the detail lives\n\n- Research: [the fact sheet](../../research/gateway-limits/index.md).\n`
  const root = tree(acme({ 'work/PROJ-12/STATE.md': state }))
  run(['research', 'new', 'gateway-limits', '--item', 'PROJ-12'], { cwd: root })
  const written = (file: string) => readFileSync(join(root, 'research/gateway-limits', file), 'utf8')
  writeFileSync(join(root, 'research/gateway-limits/index.md'), `${written('index.md').split('## Questions\n')[0]}${sheet}`)
  writeFileSync(join(root, 'research/gateway-limits/log.md'), `${written('log.md')}\n${log}`)
  for (const file of saved) writeFileSync(join(root, 'research/gateway-limits', file), '# A source, in full\n')

  const opened = run(['research', 'open', 'gateway-limits'], { cwd: root }).stdout.split('\n')
  const linted = run(['lint'], { cwd: root }).stdout
  const graphed = run(['graph'], { cwd: root }).stdout

  assert.ok(sheet.startsWith('## Questions\n') && log.startsWith('## Round 3, 2026-11-22\n'))
  assert.equal(saved.length, 3)
  assert.deepEqual(opened.slice(2, 6), [
    'facts: 4 stand, 1 superseded; the next is F11',
    'sources: 3 saved; the next is 05',
    'rounds: 3, the last on 2026-11-22, stopped: a round added no fact and no lead',
    'check again by: 2026-11-29, 318 days off',
  ])
  assert.equal(linted, 'ok\n')
  assert.deepEqual(graphed.split('\n').filter(line => line.includes('research/')), [])
})

test('what lint and graph print of a research names its folder, which is how research tells the lines that are its own to mend, and a sheet nothing links is the line the skill names', () => {
  const twice = '- **F1** `verified` The gateway retries three times.\n  - Source: https://example.com/retries\n- **F1** `verified` The gateway waits a second between tries.\n  - Source: https://example.com/retries\n'
  const root = tree(acme())
  run(['research', 'new', 'gateway-limits'], { cwd: root })
  const sheet = join(root, 'research/gateway-limits/index.md')
  writeFileSync(sheet, readFileSync(sheet, 'utf8').replace('## Facts\n', `## Facts\n\n${twice}`))

  const linted = run(['lint'], { cwd: root }).stdout.split('\n')
  const graphed = run(['graph'], { cwd: root }).stdout.split('\n')

  assert.deepEqual(linted.filter(line => line.includes('research/gateway-limits')), ['WARN research: research/gateway-limits uses F1 twice (index.md:23 and index.md:25); a number is used once across the sheet and the log'])
  assert.deepEqual(graphed.filter(line => line.includes('research/gateway-limits')), ['ORPHAN research/gateway-limits/index.md'])
  for (const named of ['`context-central lint`', '`context-central graph`', '`ORPHAN`']) assert.ok(step('research', "4. Write the research's folder").includes(named), named)
})

const waysOf = (type: string) => [...(new RegExp(`^export type ${type} = (.+)$`, 'm').exec(readFileSync(join(REPO, 'lib', 'connections.mts'), 'utf8'))?.[1] ?? '').matchAll(/'([a-z]+)'/g)].map(([, way]) => way)

test('research writes its start line from what connections gives as JSON, with a line for each way the plugin can say a connection is reached and each way it can say one is searched, and for no other', () => {
  const root = tree(acme({}, { connections: { desk: { holds: 'tickets', commands: { search: ['desk', 'find'] } }, talk: { holds: 'chat', server: 'threads' }, post: { holds: 'mail', how: 'Ask the office.' }, wiki: { holds: 'documents', route: { via: 'the wiki tool' }, researchSkill: 'wiki-search' } } }))

  const listed = JSON.parse(run(['connections', '--json'], { cwd: root }).stdout) as { name: string, holds: string, by: string, missing: unknown, search: { by: string }, entry: { [key: string]: unknown } }[]
  const brief = partOf(referenceText('research', 'references/run.md'), 'The brief')
  const headed = brief.split('\n').filter(line => /^- `[a-z]+`/.test(line)).flatMap(line => [...line.slice(0, line.indexOf(':')).matchAll(/`([a-z]+)`/g)].map(([, way]) => way))

  assert.deepEqual(listed.map(({ name, holds, by, search }) => [name, holds, by, search.by]), [['desk', 'tickets', 'command', 'command'], ['talk', 'chat', 'server', 'server'], ['post', 'mail', 'hand', 'name'], ['wiki', 'documents', 'route', 'skill']])
  assert.deepEqual([listed[2].missing, listed[2].entry.how], [null, 'Ask the office.'])
  assert.deepEqual([waysOf('Way'), waysOf('Search')], [['fetch', 'server', 'command', 'route', 'hand'], ['skill', 'command', 'server', 'name']])
  assert.deepEqual(headed.sort(), [...waysOf('Way'), ...waysOf('Search')].sort())
  for (const named of ['`context-central connections --json`', '`holds`', '`by`', '`search`', '`missing`', '`how`']) assert.ok(brief.includes(named), named)
  for (const named of ['`context-central connections --json`', '`holds`']) assert.ok(referenceText('research', 'references/folder.md').includes(named), named)
})

test('research writes a line of its start line for a connection that a preset applies unasked, which connections gives as JSON on a map made before connections and marks', () => {
  const root = tree(acme({}, { tracker: { type: 'desk', keyPatterns: ['DESK-\\d+'] } }))

  const listed = JSON.parse(run(['connections', '--json'], { cwd: root }).stdout) as { holds: string, unasked?: boolean }[]

  assert.deepEqual(listed.map(({ holds, unasked }) => [holds, unasked ?? false]), [['tickets', false], ['tickets', true], ['pull-requests', true]])
  assert.ok(partOf(referenceText('research', 'references/run.md'), 'The brief').includes('`unasked`'))
})

test("research names where for the place of the estate's glossary, which that command prints", () => {
  const root = tree(acme())

  const printed = run(['where'], { cwd: root }).stdout.split('\n')

  assert.deepEqual(printed.filter(line => line.startsWith('glossary: ')).map(line => line.endsWith('glossary.md')), [true])
  assert.ok(partOf(referenceText('research', 'references/run.md'), 'Gaps').includes('`context-central where`'))
})

test('research says in its start line what research new answers as git for a map that git tracks, kept or ignored', () => {
  const files = { 'estate.json': { contextCentral: 1, name: 'solo', repos: [{ name: 'solo', path: '.' }] }, 'CLAUDE.md': '# Solo\n', 'src/app.js': 'export {}\n' }
  const kept = checkout(files)
  const ignored = checkout({ ...files, '.gitignore': '/research/\n' })
  for (const made of [kept, ignored]) tree(made.base)
  const answered = (made: Checkout) => (JSON.parse(run(['research', 'new', 'gateway-limits', '--json'], { cwd: made.main, env: made.env }).stdout) as { git: unknown }).git

  assert.deepEqual([answered(kept), answered(ignored)], ['kept', 'ignored'])
  assert.ok(step('research', '1. Place the question').includes('`git`'))
  for (const named of ['`git`', '`kept`', '`ignored`']) assert.ok(referenceText('research', 'references/run.md').includes(named), named)
})

test("research reads the two caps of a depth with config, a key for each, which a map that sets none answers with the number the text gives as the plugin's own, and which prints as it was written a cap that is no whole number above zero", () => {
  const root = tree(acme())
  const odd = tree(acme({}, { budgets: { researchQuickRounds: 0, researchQuickAgents: 2.5, researchDeepAgents: 'many' } }))
  const printed = (cwd: string, key: string) => run(['config', '--get', key], { cwd }).stdout
  const rows = [...referenceText('research', 'references/run.md').matchAll(/^ *\| (quick|standard|deep) \| `context-central config --get (budgets\.research[A-Za-z]+)` \| `context-central config --get (budgets\.research[A-Za-z]+)` \| (\d+) and (\d+) \|$/gm)].map(([, depth, rounds, agents, ownRounds, ownAgents]) => ({ depth, keys: [rounds, agents], own: [`${ownRounds}\n`, `${ownAgents}\n`] }))

  assert.deepEqual(rows.map(({ depth, keys }) => [depth, ...keys]), [['quick', 'budgets.researchQuickRounds', 'budgets.researchQuickAgents'], ['standard', 'budgets.researchStandardRounds', 'budgets.researchStandardAgents'], ['deep', 'budgets.researchDeepRounds', 'budgets.researchDeepAgents']])
  assert.deepEqual(rows.map(({ keys }) => keys.map(key => printed(root, key))), [['1\n', '2\n'], ['3\n', '3\n'], ['6\n', '5\n']])
  assert.deepEqual(rows.map(({ own }) => own), [['1\n', '2\n'], ['3\n', '3\n'], ['6\n', '5\n']])
  assert.deepEqual(['budgets.researchQuickRounds', 'budgets.researchQuickAgents', 'budgets.researchDeepAgents'].map(key => printed(odd, key)), ['0\n', '2.5\n', 'many\n'])
})

const later = () => referenceText('research', 'references/later.md')
const checks = () => referenceText('research', 'references/checks.md')

test('research tells a research that is there from a new question by what research open answers for the first word typed: where it stands, or the line for a name that is no research, or the one for a folder no map covers', () => {
  const root = tree(acme())
  run(['research', 'new', 'gateway-limits'], { cwd: root })
  const waysIn = partOf(skillFile('research'), 'The ways in')

  assert.equal(run(['research', 'open', 'gateway-limits'], { cwd: root }).stdout.split('\n')[0], 'research gateway-limits: gateway-limits')
  assert.equal(run(['research', 'open', 'What'], { cwd: root }).stderr, 'context-central research: no research "What" in this map. Its researches: gateway-limits.\n')
  assert.match(run(['research', 'open', 'What'], { cwd: tree(makeTree({ 'readme.txt': 'x\n' })) }).stderr, /^context-central research: no context map found/)
  for (const named of ['`context-central research open <that word>`', '`no research "`', '`no context map found`', '`references/later.md`']) assert.ok(waysIn.includes(named), named)
})

test('research reads from the lines research open prints that a research has an item, that its last run was cut off and that its day to check again by has passed', () => {
  const sheet = '---\nresearch: gateway-limits\nitem: PROJ-12\n---\n# Limits\n\n## Check again by\n\n2026-01-08: it may move.\n'
  const root = tree(acme({ 'research/gateway-limits/index.md': sheet, 'research/gateway-limits/log.md': '# Limits: the log\n\n## Round 1, 2026-01-08\n\n- Answered: none\n' }))

  const printed = run(['research', 'open', 'gateway-limits'], { cwd: root, env: { TZ: 'UTC' } }).stdout.split('\n')

  assert.deepEqual(printed.filter(line => /^(item|rounds|check again by):/.test(line)), ['item: PROJ-12', 'rounds: 1, the last on 2026-01-08, not stopped', 'check again by: 2026-01-08, passed 7 days ago'])
  for (const named of ['`item:`', '`rounds:`', '`not stopped`', '`check again by:`', '`passed <N> days ago`', '`context-central resolve <name> --absolute`']) assert.ok(partOf(later(), 'Where it stands').includes(named), named)
  assert.equal(run(['resolve', 'gateway-limits', '--absolute'], { cwd: root }).stdout.split('\n')[0], 'Context for research gateway-limits:')
})

test('research names what research open prints for a research with no round and no day yet, and for a day that passed one day ago', () => {
  const root = tree(acme())
  run(['research', 'new', 'gateway-limits'], { cwd: root })
  const made = run(['research', 'open', 'gateway-limits'], { cwd: root }).stdout.split('\n')
  writeFileSync(join(root, 'research/gateway-limits/index.md'), '---\nresearch: gateway-limits\n---\n# Limits\n\n## Check again by\n\n2026-01-14: it may move.\n')

  const aDayLate = run(['research', 'open', 'gateway-limits'], { cwd: root, env: { TZ: 'UTC' } }).stdout.split('\n')

  assert.deepEqual(made.filter(line => /^(rounds|check again by):/.test(line)), ['rounds: none', 'check again by: no date on the sheet'])
  assert.deepEqual(aDayLate.filter(line => line.startsWith('check again by:')), ['check again by: 2026-01-14, passed 1 day ago'])
  for (const named of ['`rounds: none`', '`no date on the sheet`', '`passed 1 day ago`']) assert.ok(partOf(later(), 'Where it stands').includes(named), named)
})

test('research names each opening of the last line research moved prints: for some of several facts, for none of several, for the one fact there is, and for no fact that cites a line', () => {
  const one = solo({ 'src/limit.js': 'const LIMIT = 60\n', 'src/window.js': 'const WINDOW = 1\n' })
  tree(one.base)
  const read = git(one, one.main, 'rev-parse', '--short', 'HEAD').stdout.trim()
  const limit = ['- **F1** `verified` A limit is a constant.', `  - Source: \`src/limit.js:1\` at \`${read}\``]
  const others = ['- **F2** `verified` A window is a constant.', `  - Source: \`src/window.js:1\` at \`${read}\``, '- **F3** `verified` A window is counted in minutes.', `  - Source: \`src/window.js:1\` at \`${read}\``]
  const thread = ['- **F4** `verified` A shop asked for more.', '  - Source: [01-2026-01-09-thread-full-text.md](sources/01-2026-01-09-thread-full-text.md)']
  mkdirSync(join(one.main, '.context-central/research/limits'), { recursive: true })
  const lastLine = (facts: string[]) => {
    writeFileSync(join(one.main, '.context-central/research/limits/index.md'), ['---', 'research: limits', '---', '# Limits', '', '## Facts', '', ...facts, ''].join('\n'))
    return run(['research', 'moved', 'limits'], { cwd: one.main, env: one.env }).stdout.trimEnd().split('\n').at(-1)
  }
  const held = [lastLine([...limit, ...others]), lastLine(limit), lastLine(thread)]
  writeFileSync(join(one.main, 'src/limit.js'), 'const LIMIT = 90\n')
  writeFileSync(join(one.main, 'src/window.js'), 'const WINDOW = 5\n')
  git(one, one.main, 'commit', '-q', '-am', 'more')
  const check = checks().slice(checks().indexOf('\n## Does it still hold\n'), checks().indexOf('\n## Does this agree\n'))

  assert.deepEqual(held, ['None of 3 facts that cite a line of a repo has moved since the commit it was read at.', 'The one fact that cites a line of a repo has not moved since the commit it was read at.', 'No fact of limits cites a line of a repo.'])
  assert.deepEqual([lastLine([...limit, ...others]), lastLine(limit)], ['3 of 3 facts that cite a line of a repo have moved since the commit they were read at.', 'The one fact that cites a line of a repo has moved since the commit it was read at.'])
  for (const named of ['`2 of 9 facts that cite a line of a repo have moved`', '`has moved`', '`None of 9 facts that cite a line of a repo has moved`', '`The one fact that cites a line of a repo has moved`', '`has not moved`', '`No fact of <name> cites a line of a repo.`']) assert.ok(check.includes(named), named)
})

test('research asks research moved which cited lines read another way, and names the two kinds of line it prints and the two reasons it mends', () => {
  const limit = 'const LIMIT = 60\n\nexport function limited(calls) {\n  return calls > LIMIT\n}\n'
  const one = solo({ 'src/limit.js': limit })
  tree(one.base)
  const read = git(one, one.main, 'rev-parse', '--short', 'HEAD').stdout.trim()
  const facts = ['- **F1** `verified` A limit is compared in one place.', `  - Source: \`src/limit.js:4\` at \`${read}\``, '- **F2** `verified` A limit is a constant.', '  - Source: `src/limit.js:1`', '- **F3** `verified` A window is a constant.', `  - Source: \`src/window.js:1\` at \`${read}\``]
  mkdirSync(join(one.main, '.context-central/research/limits'), { recursive: true })
  writeFileSync(join(one.main, '.context-central/research/limits/index.md'), ['---', 'research: limits', '---', '# Limits', '', '## Facts', '', ...facts, ''].join('\n'))
  writeFileSync(join(one.main, 'src/limit.js'), limit.replace('calls > LIMIT', 'calls >= LIMIT'))
  git(one, one.main, 'commit', '-q', '-am', 'more')

  const printed = run(['research', 'moved', 'limits'], { cwd: one.main, env: one.env }).stdout.split('\n')
  const check = partOf(checks(), 'Does it still hold')

  assert.match(printed[0], /^F1 has moved: /)
  assert.match(printed[1], /^F2 was not compared: its line names no commit /)
  assert.match(printed[2], /^F3 was not compared: repo solo holds no such file at the commit /)
  for (const named of ['`context-central research moved <name>`', '`has moved`', '`was not compared`', '`its line names no commit`', '`holds no such file at the commit`']) assert.ok(check.includes(named), named)
})

test('the entry a check of a research writes in its log, as the skill shows it for each of the two checks, is a round the plugin reads, with what stopped it', () => {
  const entries = [fencedUnder(checks(), 'Does it still hold'), fencedUnder(checks(), 'Does this agree')]
  const root = tree(acme())
  run(['research', 'new', 'gateway-limits'], { cwd: root })
  const log = join(root, 'research/gateway-limits/log.md')
  const empty = readFileSync(log, 'utf8')
  const rounds = () => run(['research', 'open', 'gateway-limits'], { cwd: root }).stdout.split('\n').find(line => line.startsWith('rounds:'))
  writeFileSync(log, `${empty}\n${entries[0]}`)
  const afterTheFirst = rounds()
  writeFileSync(log, `${empty}\n${entries.join('\n')}`)

  assert.ok(entries[0].startsWith('## Round 4, 2026-11-29\n') && entries[1].startsWith('## Round 5, 2026-11-29\n'))
  assert.equal(afterTheFirst, 'rounds: 4, the last on 2026-11-29, stopped: the check was done')
  assert.equal(rounds(), 'rounds: 5, the last on 2026-11-29, stopped: the check was done')
  assert.deepEqual(run(['lint'], { cwd: root }).stdout.split('\n').filter(line => line.includes('research/gateway-limits')), [])
})

test("research hands a research over with research handover, and names the two flags it takes, how each line it prints opens or ends, and how a refusal opens on the error stream, for a link, for a kind no source has and for a folder inside the map", () => {
  const mail = '[04-2026-01-14-mail-limits-full-text.md](sources/04-2026-01-14-mail-limits-full-text.md)'
  const sheet = ['---', 'research: gateway-limits', '---', '# Limits', '', '[The reading](reading.md) is one judgement.', '', '## Facts', '', '- **F1** `verified` A shop may make 100 calls a minute.', `  - Source: ${mail}`, '', '## Sources', '', `- ${mail}: mail`, ''].join('\n')
  const files = { 'research/gateway-limits/index.md': sheet, 'research/gateway-limits/reading.md': '# Limits: the reading\n', 'research/gateway-limits/sources/04-2026-01-14-mail-limits-full-text.md': '# Limits\n' }
  const root = tree(acme(files))
  const out = join(tree(makeTree({})), 'handed')
  const handing = partOf(later(), 'Handing it over')

  const printed = run(['research', 'handover', 'gateway-limits', out, '--without', 'mail', '--reading'], { cwd: root }).stdout.trimEnd().split('\n')
  const refused = run(['research', 'handover', 'gateway-limits', `${out}-2`], { cwd: tree(acme({ ...files, 'research/gateway-limits/brief.md': 'See [the gateway](../../concepts/gateway.md).\n' })) })

  assert.equal(printed.length, 3)
  assert.ok(printed[0].startsWith('handed over research gateway-limits to '))
  assert.ok(printed[1].startsWith('left out: '))
  assert.ok(printed[2].endsWith('only on sources left out'))
  const noSuchKind = run(['research', 'handover', 'gateway-limits', `${out}-3`, '--without', 'chat'], { cwd: root })
  const inTheMap = run(['research', 'handover', 'gateway-limits', join(root, 'research', 'handed')], { cwd: root })

  assert.ok(refused.stderr.startsWith('context-central research: nothing was handed over'))
  assert.equal(noSuchKind.stderr, 'context-central research: no source of gateway-limits is of kind "chat"; its kinds are: mail\n')
  assert.ok(inTheMap.stderr.startsWith('context-central research: ') && inTheMap.stderr.endsWith('is inside the map, so nothing was handed over: a hand-over is a folder outside it\n'))
  assert.deepEqual([refused, noSuchKind, inTheMap].map(({ code, stdout }) => [code, stdout]), [[1, ''], [1, ''], [1, '']])
  for (const named of ['`context-central research handover <name> <folder>`', '`context-central research handover <name> <folder> --reading`', '`--without <kind>`', '`handed over research`', '`left out:`', '`only on sources left out`', '`context-central research:`', '`nothing was handed over`', '`no source of`', '`## Sources`']) assert.ok(handing.includes(named), named)
})

test("research saves a copy of a note among a research's sources at a path draft prints, and finds what a build left through the item's own pointers", () => {
  const root = tree(acme())
  run(['research', 'new', 'gateway-limits'], { cwd: root })
  const build = partOf(checks(), 'What a build learned')

  assert.equal(run(['draft', 'research/gateway-limits/sources/01-2026-01-15-note-state-full-text.md'], { cwd: root }).stdout, `${join(root, 'research/gateway-limits/sources/01-2026-01-15-note-state-full-text.md')}\n`)
  assert.equal(run(['resolve', 'PROJ-12', '--absolute'], { cwd: root }).stdout.split('\n')[1], `- ${join(root, 'work/PROJ-12/STATE.md')} (${Buffer.byteLength(ACME_FILES['work/PROJ-12/STATE.md'])} B) state file: where the work stands and what is next`)
  for (const named of ['`context-central resolve <item> --absolute`', '`context-central draft research/<name>/sources/<NN>-<YYYY-MM-DD>-note-<what>-full-text.md`']) assert.ok(build.includes(named), named)
})

test('each of the four steps runs the skill a repo names for it, at the place the line standards prints is read', () => {
  const root = tree(acme({}, { repos: [{ name: 'web', steps: { research: 'page-kit', prep: 'page-kit', design: 'page-kit', implement: 'page-kit' } }] }))

  const printed = run(['standards', 'web'], { cwd: root }).stdout.split('\n')

  assert.deepEqual(printed.slice(-6), ['Step skills for repo web:', '- research: page-kit', '- prep: page-kit', '- design: page-kit', '- implement: page-kit', ''])
  for (const [name, heading] of [
    ['research', '2. Gather from primary sources'],
    ['prep', '1. Load the item'],
    ['design', '3. Read the code the design will meet'],
    ['implement', '4. Verify'],
  ]) {
    const part = step(name, heading)
    assert.ok(part.includes('`context-central standards <repo>`'), name)
    assert.ok(part.includes(`\`- ${name}: <skill>\` under \`Step skills for repo <repo>:\``), name)
  }
})
