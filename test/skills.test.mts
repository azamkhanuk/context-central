import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { REPO, acme, disposable, makeTree, run } from './helpers.mts'
import type { Json } from './helpers.mts'

const SKILLS = ['onboard', 'research', 'prep', 'implement', 'checkpoint']
const USER_ONLY = ['onboard', 'research', 'prep', 'implement']
const AGENTS = ['reader', 'fetcher', 'reviewer']
const COMMANDS = ['config', 'where', 'work', 'resolve', 'index', 'note', 'graph', 'lint', 'doctor', 'detect', 'init', 'wrapper', 'budget', 'slice', 'fetch', 'evidence']
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
  work: ['title', 'json', 'all'],
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
  fetch: ['item', 'repo'],
  evidence: ['item', 'as'],
}
const STATE_PARTS = ['Where it stands', 'Done', 'Next', 'Blocked', 'Standing traps', 'Where the detail lives']

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

test('the four working skills run only when the person types them', () => {
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
  assert.ok(keys.includes('writeRules') && keys.includes('tracker.route') && keys.includes('implement'))
  for (const key of keys) assert.equal(run(['config', '--get', key], { cwd: root }).code, 0, key)
})

test('the skills say what an unset setting looks like: config --get exits 1', () => {
  const root = tree(acme())

  assert.equal(run(['config', '--get', 'writeRules'], { cwd: root }).code, 1)
  for (const name of ['research', 'prep', 'implement']) assert.match(skillText(name), /absent makes `config --get` exit 1/, name)
})

test('implement says what each of its settings defaults to when the estate leaves it out', () => {
  assert.match(skillText('implement'), /`tests` absent means on, `review` absent means on, `deferTo` absent or empty means nothing to defer to/)
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

test('prep and implement tell an existing item from a near match by the resolver\'s first line', () => {
  const root = tree(acme())

  assert.equal(run(['resolve', 'PROJ-12'], { cwd: root }).stdout.split('\n')[0], 'Context for work item PROJ-12:')
  assert.equal(run(['resolve', 'PROJ-99 gateway web api'], { cwd: root }).stdout.split('\n')[0], 'Context for repo web:')
  for (const name of ['prep', 'implement']) assert.ok(skillText(name).includes('`Context for work item <item>:`'), name)
})

test('checkpoint stops where no map covers the folder', () => {
  const root = tree(makeTree({ 'readme.md': '# no map here\n' }))
  const listed = run(['work', 'list'], { cwd: root })

  assert.equal(listed.code, 1)
  assert.match(listed.stderr, /no context map found/)
  assert.match(skillText('checkpoint'), /`no context map found`[^.]*stop/)
})

test('onboard puts the settings where a session starts, which for an inner map is the repo', () => {
  assert.match(skillText('onboard'), /layout `inner`, the repo that holds `\.context-central\/`/)
})

test('onboard runs the map commands from the directory it set up', () => {
  assert.match(skillText('onboard'), /find the map from the working directory/)
})

test('the fetcher is told outright never to write to an external system', () => {
  assert.match(agentText('fetcher'), /never post, comment, transition or edit there/)
})

test('the reader, which has no Write tool, is told how to write the one file it may', () => {
  assert.match(agentText('reader'), /no Write tool/)
  assert.match(agentText('reader'), /only that path/)
})

test('onboard asks whether evidence is committed straight after the layout, and its draft carries the answer', () => {
  const draft = JSON.parse((/```json\n([\s\S]*?)```/.exec(skillText('onboard')) ?? [])[1]) as Draft

  assert.match(skillText('onboard'), /^2\. Layout: .*\n3\. Whether evidence that is not text .* is committed\. Recommend yes exactly when the map is kept in git/m)
  assert.match(skillText('onboard'), /a screenshot can show personal data, and no text check reads an image/)
  assert.deepEqual(draft.config.evidence, { commit: true })
})

test('implement and checkpoint say where evidence that is not text goes, and checkpoint lists it in a note', () => {
  for (const name of ['implement', 'checkpoint']) assert.ok(skillText(name).includes('(a screenshot, a recording, an export)'), name)
  assert.ok(skillText('checkpoint').includes('`notes/<YYYY-MM-DD>-evidence.md` lists each by file name, with what it shows and the commit it was taken at'))
  assert.ok(skillText('checkpoint').includes('- **Where the detail lives**: paths to the spec, the notes, the saved sources and the evidence note.'))
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

test('implement and checkpoint save evidence with the command that puts it in place', () => {
  for (const name of ['implement', 'checkpoint']) assert.ok(skillText(name).includes('`context-central evidence add <file> --item <item>`'), name)
})

test('checkpoint sends a session with no work item to the step that names the glossary', () => {
  assert.ok(skillText('checkpoint').includes('If it is not, skip to step 5.'))
  assert.ok(lessons().includes('goes in `glossary.md` at the root of the map, in that file\'s entry format'))
})

test('checkpoint reads the glossary before it writes a term to it', () => {
  assert.ok(lessons().includes('entry format. Read the file first.'))
})

test('checkpoint writes a term only when its meaning was stated, by the person or in text on disk', () => {
  assert.ok(lessons().includes('Write a term only when its meaning was stated: by the person in this session, or in text on disk that you can name.'))
})

test('checkpoint does not take a meaning the session worked out for itself as stated', () => {
  assert.ok(lessons().includes('A meaning you worked out yourself is not stated, even where this session wrote it down.'))
})

test('checkpoint rewrites a corrected entry where it stands, and never gives one term a second entry', () => {
  assert.ok(lessons().includes('When the person corrected a term, rewrite its entry where it stands'))
  assert.ok(lessons().includes('never add a second entry for one term'))
})

test('checkpoint names the glossary init writes at the root of the map, and the line of an entry that a correction fills', () => {
  for (const [layout, map] of [['root', '.'], ['inner', '.context-central']]) {
    const root = tree(makeTree({ 'answers.json': { layout, config: { name: 'acme' } } }))
    run(['init', '--from', 'answers.json'], { cwd: root })

    assert.match(readFileSync(join(root, map, 'glossary.md'), 'utf8'), /^_Avoid_: /m, layout)
  }
  assert.ok(lessons().includes('`glossary.md` at the root of the map'))
  assert.ok(lessons().includes('add the word they ruled out to its `_Avoid_` line'))
})

test('checkpoint writes no term that was never defined, and leaves an entry that a source disagrees with until the person rules', () => {
  assert.ok(lessons().includes('A term that was used and never defined is not written, and an entry that a source disagrees with is left as it is unless the person ruled on it.'))
})

test('checkpoint makes no glossary where the map has none, and reports the terms instead', () => {
  assert.ok(lessons().includes('If the map has no `glossary.md`, write none: the closing report says it is missing and carries the terms and their stated meanings.'))
})

test('checkpoint says nothing about the glossary in a session that met no term', () => {
  assert.ok(lessons().includes('A session that met no term leaves the glossary alone and says nothing about it.'))
})

test('checkpoint closes by naming the glossary entries it wrote, the terms left to define and the disagreements', () => {
  const closing = step('checkpoint', '8. Say what was not recorded')

  assert.ok(closing.includes('each glossary entry added or changed and where its meaning came from'))
  assert.ok(closing.includes('each term left for the person to define'))
  assert.ok(closing.includes('each entry a source disagrees with'))
})
