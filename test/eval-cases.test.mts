import assert from 'node:assert/strict'
import { chmodSync, cpSync, existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { INDEX_CLOSING_LINE, REPO, disposable, hook, makeTree, notOnWindows, run, spawned } from './helpers.mts'
import type { Result } from './helpers.mts'

type Case = { group: string, name: string, dir: string }
type Fields = Record<string, string>
type Grader = { name: string, fields: Fields }
type HookOutput = { hookSpecificOutput: { additionalContext: string } }

const EVALS = join(REPO, 'evals')
const THE_HOSTS_OWN = ['results', 'mocks']
const NAME = /^[a-z][a-z0-9-]*$/
const ONE_KEY_A_LINE = /^ *[a-z_]+:(?: \S.*)?$/
const FREE_KINDS = ['regex', 'tool_used', 'tool_order', 'file_exists']
const READ_ONLY_TOOLS = ['Read', 'Glob', 'Grep', 'NotebookRead', 'Skill', 'AskUserQuestion', 'Agent', 'TodoWrite', 'TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TaskStop']
const A_SCAFFOLD = notOnWindows('a scaffold is a shell script, which Windows cannot start')
const CONNECTIONS_LINE = 'Connections: tracker holds tickets. context-central connections says how this machine reaches each.'
const STATE_FILE_WHY = 'state file: where the work stands and what is next'

const tree = disposable()

const folders = (dir: string) => readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
const GROUPS = folders(EVALS).filter(name => !THE_HOSTS_OWN.includes(name))
const CASES: Case[] = GROUPS.flatMap(group => folders(join(EVALS, group)).map(name => ({ group, name, dir: join(EVALS, group, name) })))

const read = (...path: string[]) => readFileSync(join(...path), 'utf8')
const lines = (text: string) => text.split('\n').filter(line => line.trim() !== '')
const fields = (text: string): Fields => Object.fromEntries(lines(text).map(line => [line.slice(0, line.indexOf(':')).trim(), line.slice(line.indexOf(':') + 1).trim()]))
const listed = (value = '') => value.replace(/^\[|\]$/g, '').split(',').map(one => one.trim()).filter(Boolean)
const unquoted = (value = '') => value.replace(/^(['"])(.*)\1$/, '$2')
const frontMatter = (text: string) => /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text) ?? ['', '', '']
const head = (file: string) => frontMatter(read(file))[1]
const promptOf = (one: Case) => frontMatter(read(one.dir, 'prompt.md'))[2].trim()
const promptFields = (one: Case) => fields(head(join(one.dir, 'prompt.md')))
const graderFiles = (one: Case) => (existsSync(join(one.dir, 'graders')) ? readdirSync(join(one.dir, 'graders')).filter(name => name.endsWith('.md')).sort() : [])
const graders = (one: Case): Grader[] => graderFiles(one).map(name => ({ name: name.slice(0, -3), fields: fields(head(join(one.dir, 'graders', name))) }))
const named = (name: string) => CASES.find(one => one.name === name) ?? assert.fail(`no case named ${name} under evals/`)
const failing = <Of,>(all: Of[], holds: (one: Of) => boolean, label: (one: Of) => string) => all.filter(one => !holds(one)).map(label)
const caseLabel = (one: Case) => `${one.group}/${one.name}`

function patternOf(one: Case, grader: string) {
  const found = graders(one).find(({ name }) => name === grader) ?? assert.fail(`${caseLabel(one)} has no grader named ${grader}`)
  return new RegExp(unquoted(found.fields.pattern), unquoted(found.fields.flags))
}

const SMALL_ENVIRONMENT = { TERM: 'dumb' }

function scaffolded(one: Case, root = tree(makeTree({}))) {
  const home = tree(makeTree({}))
  return { root, result: spawned('bash', [join(one.dir, 'scaffold.sh')], { cwd: root, env: { ...SMALL_ENVIRONMENT, HOME: home, TMPDIR: home, CONTEXT_CENTRAL_NOW: undefined } }) }
}

const estates = new Map<string, string>()

function estateOf(one: Case) {
  const made = estates.get(one.name)
  if (made) return made
  const { root, result } = scaffolded(one)
  assert.deepEqual(result, { code: 0, stdout: '', stderr: '' })
  estates.set(one.name, root)
  return root
}

const filesOf = (root: string) => readdirSync(root, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile()).map(entry => join(entry.parentPath, entry.name).slice(root.length + 1).split('\\').join('/')).sort()
const holding = (root: string, pattern: RegExp) => filesOf(root).filter(file => pattern.test(read(root, file)))
const context = (result: Result) => (JSON.parse(result.stdout) as HookOutput).hookSpecificOutput.additionalContext
const fire = (event: string, input: object) => hook(event, input, { env: { CONTEXT_CENTRAL_STATE_DIR: tree(makeTree({})) } })
const indexOf = (root: string) => context(fire('session-start', { session_id: 's1', cwd: root, hook_event_name: 'SessionStart', source: 'startup' }))
const asked = (root: string, prompt: string) => fire('user-prompt-submit', { session_id: 's1', cwd: root, hook_event_name: 'UserPromptSubmit', prompt })
const row = (root: string, item: string, title: string) => `- ${item} | ${title} | ${join(root, 'work', item, 'STATE.md')}`

test('the eval folder holds at least one case group, and each holds at least one case', () => {
  assert.ok(GROUPS.length > 0)
  assert.deepEqual(GROUPS.filter(group => !CASES.some(one => one.group === group)), [])
})

test('a case group and a case are named in small letters, digits and dashes, which the host and the one command both take', () => {
  assert.deepEqual([...GROUPS, ...CASES.map(one => one.name)].filter(name => !NAME.test(name)), [])
})

test('no two cases share a name, since the host picks a case by its name', () => {
  const names = CASES.map(one => one.name)

  assert.deepEqual(names.filter((name, at) => names.indexOf(name) !== at), [])
})

test('a case group names its grants in group.json as a list of strings, and holds nothing else there', () => {
  for (const group of GROUPS) {
    const written = JSON.parse(read(EVALS, group, 'group.json')) as { allowTools: unknown }

    assert.deepEqual(Object.keys(written), ['allowTools'], group)
    assert.ok(Array.isArray(written.allowTools) && written.allowTools.every(tool => typeof tool === 'string' && tool !== ''), group)
  }
})

test("a case carries its group's name as a tag, so a run of the group passes none over", () => {
  assert.deepEqual(failing(CASES, one => listed(promptFields(one).tags).includes(one.group), caseLabel), [])
})

test('a case lists read-only tools alone, since a grant comes from its group', () => {
  const beyond = CASES.flatMap(one => listed(promptFields(one).allowed_tools).filter(tool => !READ_ONLY_TOOLS.includes(tool)).map(tool => `${caseLabel(one)}: ${tool}`))

  assert.deepEqual(beyond, [])
})

test('a case has a prompt and a ceiling on its turns', () => {
  assert.deepEqual(failing(CASES, one => promptOf(one) !== '' && /^[1-9]\d*$/.test(promptFields(one).max_turns ?? ''), caseLabel), [])
})

test('a case is named after its folder in case.yaml, which names the scaffold beside it', () => {
  for (const one of CASES) {
    assert.deepEqual(fields(read(one.dir, 'case.yaml')), { schema_version: '"1.1"', name: one.name, context: '', scaffold_script: 'scaffold.sh' }, caseLabel(one))
    assert.ok(existsSync(join(one.dir, 'scaffold.sh')), caseLabel(one))
  }
})

test('a case has at least one grader, and each is of a kind that calls no judge', () => {
  assert.deepEqual(failing(CASES, one => graders(one).length > 0, caseLabel), [])
  assert.deepEqual(CASES.flatMap(one => graders(one).filter(grader => !FREE_KINDS.includes(grader.fields.type)).map(grader => `${caseLabel(one)}: ${grader.name}`)), [])
})

test('a case shows that the plugin spoke with a grader that is not scored, a pattern over the trace for the index', () => {
  for (const one of CASES) {
    assert.deepEqual(graders(one).find(grader => grader.name === 'plugin-spoke')?.fields, { type: 'regex', target: 'trace', pattern: "'Work in flight \\('", arm: 'with-only' }, caseLabel(one))
  }
})

test('the files of a case keep to one key and its value a line, so they are read with no YAML parser', () => {
  const written = CASES.flatMap(one => [
    ...lines(head(join(one.dir, 'prompt.md'))).map(line => ({ file: `${caseLabel(one)}/prompt.md`, line })),
    ...lines(read(one.dir, 'case.yaml')).map(line => ({ file: `${caseLabel(one)}/case.yaml`, line })),
    ...graderFiles(one).flatMap(name => lines(head(join(one.dir, 'graders', name))).map(line => ({ file: `${caseLabel(one)}/graders/${name}`, line }))),
  ])

  assert.ok(written.length > 0)
  assert.deepEqual(written.filter(({ line }) => !ONE_KEY_A_LINE.test(line)).map(({ file, line }) => `${file}: ${line}`), [])
})

test('a scaffold makes an estate whose session start is given the live index', A_SCAFFOLD, () => {
  for (const one of CASES) {
    const index = indexOf(estateOf(one))

    assert.match(index, /^Context map "/, caseLabel(one))
    assert.match(index, /\nWork in flight \(\d+\):\n/, caseLabel(one))
  }
})

test("a scaffold makes an estate the map's own checks find no fault in", A_SCAFFOLD, () => {
  for (const one of CASES) {
    const root = estateOf(one)

    assert.deepEqual(run(['lint', '--strict'], { cwd: root }), { code: 0, stdout: 'ok\n', stderr: '' }, caseLabel(one))
    assert.doesNotMatch(run(['graph', '--strict'], { cwd: root }).stdout, /^(BROKEN|ORPHAN|UNREFERENCED) /m, caseLabel(one))
  }
})

test('a scaffold run a second time in the same folder writes the same files', A_SCAFFOLD, () => {
  for (const one of CASES) {
    const { root } = scaffolded(one)
    const first = filesOf(root).map(file => [file, read(root, file)])

    assert.deepEqual(scaffolded(one, root).result, { code: 0, stdout: '', stderr: '' }, caseLabel(one))
    assert.deepEqual(filesOf(root).map(file => [file, read(root, file)]), first, caseLabel(one))
  }
})

test('a scaffold run in a folder it cannot write ends non-zero, so the host scores the run nothing', A_SCAFFOLD, () => {
  for (const one of CASES) {
    const root = tree(makeTree({}))
    chmodSync(root, 0o555)

    assert.notEqual(scaffolded(one, root).result.code, 0, caseLabel(one))
    chmodSync(root, 0o755)
  }
})

test('a scaffold that does not find the script that makes acme ends non-zero and writes nothing', A_SCAFFOLD, () => {
  for (const one of CASES) {
    const alone = tree(makeTree({}))
    const root = tree(makeTree({}))
    cpSync(one.dir, join(alone, one.group, one.name), { recursive: true })

    assert.notEqual(spawned('bash', [join(alone, one.group, one.name, 'scaffold.sh')], { cwd: root, env: SMALL_ENVIRONMENT }).code, 0, caseLabel(one))
    assert.deepEqual(filesOf(root), [], caseLabel(one))
  }
})

test('acme is several repos and seven work items, six of them in flight, on one index', A_SCAFFOLD, () => {
  const root = estateOf(named('where-an-item-stands'))

  assert.equal(
    indexOf(root),
    [
      `Context map "Acme estate": ${root}`,
      `Hub: ${join(root, 'CLAUDE.md')}`,
      CONNECTIONS_LINE,
      'Work in flight (6):',
      row(root, 'export-audit', 'Keep an audit trail of exports'),
      row(root, 'export-retry', 'Retry a failed export'),
      row(root, 'invoice-pdf', 'Send an invoice as a PDF'),
      row(root, 'invoice-rounding', 'Round invoice lines the same way everywhere'),
      row(root, 'PROJ-40', 'Show the plan on the account page'),
      row(root, 'rate-limit-gateway', 'Rate limit the gateway'),
      INDEX_CLOSING_LINE,
    ].join('\n'),
  )
  assert.deepEqual(folders(root), ['api', 'billing', 'concepts', 'decisions', 'edges', 'log', 'repos', 'web', 'work', 'worker'])
  assert.deepEqual(folders(join(root, 'work')), ['PROJ-40', 'export-audit', 'export-csv', 'export-retry', 'invoice-pdf', 'invoice-rounding', 'rate-limit-gateway'])
})

test('where-an-item-stands: the prompt names the item, and the prompt hook answers with its state file', A_SCAFFOLD, () => {
  const one = named('where-an-item-stands')
  const root = estateOf(one)

  assert.equal(promptOf(one), 'Where does export-retry stand, and what is next?')
  const [first, second] = context(asked(root, promptOf(one))).split('\n')
  assert.equal(first, 'Context for work item export-retry:')
  assert.ok(second.startsWith(`- ${join(root, 'work', 'export-retry', 'STATE.md')} (`) && second.endsWith(`) ${STATE_FILE_WHY}`), second)
})

test('where-an-item-stands: each scored grader looks for a fact that the state file of the item holds and no other file of acme does', A_SCAFFOLD, () => {
  const one = named('where-an-item-stands')
  const root = estateOf(one)

  assert.deepEqual(graders(one).map(grader => grader.name), ['next', 'plugin-spoke', 'stands'])
  assert.deepEqual(holding(root, patternOf(one, 'stands')), ['work/export-retry/STATE.md'])
  assert.deepEqual(holding(root, patternOf(one, 'next')), ['work/export-retry/STATE.md'])
  assert.match(read(root, 'work/export-retry/STATE.md'), /## Where it stands\n\n.*switched off in production.*\n\n## Done\n/)
  assert.match(read(root, 'work/export-retry/STATE.md'), /## Next\n\n.*`export-stalled`.*\n\n## Blocked\n/)
})

test('ticket-leads-to-notes: the prompt names a ticket no folder is named after, and the prompt hook answers with the notes behind its work item', A_SCAFFOLD, () => {
  const one = named('ticket-leads-to-notes')
  const root = estateOf(one)
  const listedIn = (answer: string) => answer.split('\n').filter(line => line.startsWith('- ')).map(line => line.slice(2, line.indexOf(' (')))

  assert.equal(promptOf(one), 'What did we decide for PROJ-27, and why?')
  assert.equal(existsSync(join(root, 'work', 'PROJ-27')), false)
  assert.ok(indexOf(root).split('\n').includes(row(root, 'invoice-rounding', 'Round invoice lines the same way everywhere')))
  const answer = context(asked(root, promptOf(one)))
  assert.equal(answer.split('\n')[0], 'Context for work item invoice-rounding:')
  assert.deepEqual(listedIn(answer), [
    join(root, 'work', 'invoice-rounding', 'STATE.md'),
    join(root, 'work', 'invoice-rounding', 'SPEC.md'),
    join(root, 'concepts', 'rounding.md'),
    join(root, 'decisions', '0003-round-half-even.md'),
    join(root, 'repos', 'billing.md'),
  ])
})

test('ticket-leads-to-notes: the scored grader looks for the reason, which the decision note holds and no other file of acme does', A_SCAFFOLD, () => {
  const one = named('ticket-leads-to-notes')
  const root = estateOf(one)

  assert.deepEqual(graders(one).map(grader => grader.name), ['plugin-spoke', 'reason'])
  assert.deepEqual(holding(root, patternOf(one, 'reason')), ['decisions/0003-round-half-even.md'])
  assert.match(read(root, 'decisions/0003-round-half-even.md'), /## Context\n\n.*The settlement files of the payment provider round half to even.*\n\n## Decision\n/)
})

test('nothing-to-say: the prompt names nothing of acme, and the prompt hook prints nothing', A_SCAFFOLD, () => {
  const one = named('nothing-to-say')
  const root = estateOf(one)

  assert.equal(promptOf(one), 'How many days are there in a leap year?')
  assert.match(indexOf(root), /\nWork in flight \(6\):\n/)
  assert.deepEqual(asked(root, promptOf(one)), { code: 0, stdout: '', stderr: '' })
})

test('nothing-to-say: it passes on the answer and on no note of the map being read, in both arms', A_SCAFFOLD, () => {
  const one = named('nothing-to-say')
  const root = estateOf(one)
  const noNoteRead = graders(one).find(grader => grader.name === 'no-note-read')?.fields ?? {}
  const counts = new RegExp(unquoted(noNoteRead.input_match))
  const readOf = (file: string) => JSON.stringify({ file_path: join(root, file) })
  const ofTheMap = (file: string) => /^(repos|concepts|edges|decisions|log|work)\//.test(file) || ['CLAUDE.md', 'glossary.md', 'estate.json'].includes(file)

  assert.deepEqual(graders(one).map(grader => grader.name), ['answer', 'no-note-read', 'plugin-spoke'])
  assert.deepEqual(graders(one)[0].fields, { type: 'regex', pattern: "'\\b366\\b'" })
  assert.deepEqual({ ...noNoteRead, input_match: '' }, { type: 'tool_used', tool: 'Read', input_match: '', min: '0', max: '0' })
  assert.deepEqual(filesOf(root).filter(file => counts.test(readOf(file)) !== ofTheMap(file)), [])
  assert.equal(filesOf(root).filter(ofTheMap).length, 33)
})
