import assert from 'node:assert/strict'
import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { INDEX_CLOSING_LINE, REPO, disposable, git, hook, makeTree, notOnWindows, run, spawned } from './helpers.mts'
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
const A_FOLDER_NOBODY_WRITES = process.getuid?.() === 0 ? { skip: 'root writes to a folder whatever its mode' } : A_SCAFFOLD
const CONNECTIONS_LINE = 'Connections: tracker holds tickets. context-central connections says how this machine reaches each.'
const STATE_FILE_WHY = 'state file: where the work stands and what is next'
const A_FOLDER_NAME_AT_MOST = 200
const THE_PROVEN_COMMIT = '15d9165fec5e71e4a057469699a1e313e767cdcc'
const THE_HEAD = 'e60a54547451023f01ca21ac6a5d4013e683dc65'
const MAIN = '8386c750415caf4a58f235b5204c3b9397f30684'
const WHAT_LINT_SAYS_OF: Record<string, string> = { 'ready-to-merge': 'WARN evidence: work/refund-window/proof.jsonl is not Markdown and is outside work/refund-window/evidence/' }

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
const asSaid = (text: string) => text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[`*]/g, '')
const holding = (root: string, pattern: RegExp) => filesOf(root).filter(file => pattern.test(asSaid(read(root, file))))
const context = (result: Result) => (JSON.parse(result.stdout) as HookOutput).hookSpecificOutput.additionalContext
const fire = (event: string, input: object) => hook(event, input, { env: { CONTEXT_CENTRAL_STATE_DIR: tree(makeTree({})) } })
const indexOf = (root: string) => context(fire('session-start', { session_id: 's1', cwd: root, hook_event_name: 'SessionStart', source: 'startup' }))
const asked = (root: string, prompt: string) => fire('user-prompt-submit', { session_id: 's1', cwd: root, hook_event_name: 'UserPromptSubmit', prompt })
const lengthened = (path: string, to: number): string => (path.length >= to ? path : lengthened(join(path, 'a'.repeat(Math.min(A_FOLDER_NAME_AT_MOST, Math.max(1, to - path.length - 1)))), to))
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

test("a case carries its group's name as its one tag, so a run of the group passes none over and no other group runs it again", () => {
  assert.deepEqual(failing(CASES, one => listed(promptFields(one).tags).join() === one.group, caseLabel), [])
})

test('no case group and no case is a link, since neither the tests nor the one command follow one', () => {
  const linksHolding = (files: string[], dir: string) => readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isSymbolicLink() && files.some(file => existsSync(join(dir, entry.name, file)))).map(entry => entry.name)

  assert.deepEqual([...linksHolding(['group.json'], EVALS), ...GROUPS.flatMap(group => linksHolding(['prompt.md', 'case.yaml'], join(EVALS, group)).map(name => `${group}/${name}`))], [])
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

test("a scaffold makes an estate the map's own checks find no fault in, but for what a case is there to show", A_SCAFFOLD, () => {
  for (const one of CASES) {
    const root = estateOf(one)
    const said = WHAT_LINT_SAYS_OF[one.name]

    assert.deepEqual(run(['lint', '--strict'], { cwd: root }), said ? { code: 1, stdout: `${said}\n`, stderr: '' } : { code: 0, stdout: 'ok\n', stderr: '' }, caseLabel(one))
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

test('a scaffold run in a folder it cannot write ends non-zero, so the host scores the run nothing', A_FOLDER_NOBODY_WRITES, () => {
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

test('the index of acme is whole in a workspace whose path is 600 characters long, wherever the temporary folder is, and the map has no fault there', A_SCAFFOLD, () => {
  const root = lengthened(tree(makeTree({})), 600)
  mkdirSync(root, { recursive: true })

  assert.deepEqual(scaffolded(named('where-an-item-stands'), root).result, { code: 0, stdout: '', stderr: '' })
  assert.ok(indexOf(root).split('\n').includes(row(root, 'rate-limit-gateway', 'Rate limit the gateway')))
  assert.deepEqual(run(['lint', '--strict'], { cwd: root }), { code: 0, stdout: 'ok\n', stderr: '' })
})

const failedBy = (one: Case, grader: string, replies: string[]) => replies.filter(reply => !patternOf(one, grader).test(reply))
const passedBy = (one: Case, grader: string, replies: string[]) => replies.filter(reply => patternOf(one, grader).test(reply))

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
  assert.deepEqual(holding(root, /\bprod(?:uction)?\b/i), ['work/export-retry/STATE.md'])
  assert.deepEqual(holding(root, patternOf(one, 'next')), ['work/export-retry/STATE.md'])
  assert.match(read(root, 'work/export-retry/STATE.md'), /## Where it stands\n\n.*switched off in production.*\n\n## Done\n/)
  assert.match(read(root, 'work/export-retry/STATE.md'), /## Next\n\n.*`export-stalled`.*\n\n## Blocked\n/)
})

test('where-an-item-stands: its graders pass a right reply in other words, and fail one that found nothing, guessed or read the log alone', () => {
  const one = named('where-an-item-stands')

  assert.deepEqual(failedBy(one, 'stands', [
    'The retry is built and merged in worker: a failed export is tried again up to five times. It is switched off in production.',
    'It is merged, and it is off in production until the team is told.',
    'It has not been switched on in production yet.',
    "It is built, but it hasn't been enabled in production.",
    'It isn\u2019t live in production yet.',
    'A failed export is retried up to 5x. Not live in production.',
    'Merged in worker and currently disabled in production.',
    'The retry loop is merged; it remains inactive in production pending an alert.',
    'In production it is still off.',
    'It is built and merged; production has it switched off.',
    'Merged, but not running in production yet.',
    'Built and merged, and waiting to be switched on in production.',
    'It has yet to go live in production.',
    '**export-retry** is built and merged in worker but currently switched off. A failed export is retried up to five times, with a longer wait each time. **Next:** add an alert in api, then switch the retry on in production.',
    '- **Where it stands:** built and merged in worker, switched off for now\n- **Next:** add an alert in api, then switch the retry on in production',
    'Status: merged in worker, not enabled yet. Next steps: (1) add an alert in api (2) enable the retry in production.',
    "Done and merged, but it's off in prod until alerting exists.",
    'The retry is merged in worker and is off\nin production until the team is alerted.',
    '- **Status:** built and merged in worker\n- **Production:** off, until the team is told when an export has failed every try',
    '| Built | Yes, merged in worker on 2026-01-12 |\n| Production | Off |',
  ]), [])
  assert.deepEqual(passedBy(one, 'stands', [
    'I could not find a work item named export-retry. I looked at five folders.',
    'I searched 5 times and found the log only.',
    'I tried 5 times to find export-retry and found the log only.',
    'After five attempts at searching I found no note.',
    'Next: add an alert in api on the export-stalled channel, then switch the retry on in production.',
    'The code gives `tries` no value, so the retry may be disabled.',
    'runExport takes `tries` from its caller and nothing passes it, so the retry is not enabled.',
    'The retry loop is merged in worker.',
    'The plan was three tries with a fixed wait of ten seconds.',
    'Next is a retry of three tries, ten seconds apart. It is not enabled yet.',
    'I could not find export-retry in this workspace, so I cannot say whether it has been turned off.',
    "I couldn't find it. It isn't live as far as I can tell.",
    'I do not have enough information: shell access is disabled in this session, so I could not search.',
  ]), [])
  assert.deepEqual(failedBy(one, 'next', [
    'Next: add an alert in api for an export that has failed every try, on the export-stalled channel, then switch the retry on.',
    'Next is to notify the team when an export fails every try, then switch the retry on in production.',
    'Add alerting in api for exports that fail all five tries.',
    'Then turn the retry on in production.',
    'Next: add an alert in api for exports that exhaust every retry, then enable it in production.',
    'After that, turn the retries on in production.',
    'Then the retry gets switched on in production.',
    'Add an alert in `api`.',
    'Then flip it on in production.',
    'Next: an alert for exhausted retries.',
    'Next: tell the team when an export has run out of tries, then activate the retry in production.',
    'What is next: switch the retry on in production, once the team gets told about exports that fail every try.',
    '1. Add an alert in api\n   for an export that has failed every try\n2. Go live in production',
    '| Next | Alert in api (`export-stalled`), then switch on in production |',
  ]), [])
  assert.deepEqual(passedBy(one, 'next', [
    'I could not find a state file. A sensible next step would be adding monitoring and alerts.',
    'Next is a retry of three tries, ten seconds apart, as a piece of work of its own.',
    'You could turn on verbose logging to find out.',
    'The spec leaves out telling anyone that an export has failed for good, so the next step is probably an alert when an export has failed for good.',
    'Today the shop is notified when an export fails and has to ask again. I found nothing about what is next.',
    'A job can fail after the route has answered, so the shop has to be notified another way when a job fails.',
    'I could not find a state file for export-retry. If the retry is off, the next step would be to switch it on.',
    'I found no notes. Nothing alerts anyone when an export fails, as far as I can see.',
    'With export-retry one request can mean several runs once you turn the retry on.',
    'I searched api for an alert and found none.',
    'I found no alerts. In api there is only the limiter.',
    'After all the tries are used the export is marked failed and the shop is notified to ask again.',
    'The shop is notified after every attempt fails.',
  ]), [])
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

test('ticket-leads-to-notes: its grader passes the reason in other words, and fails a reply that found nothing or gave the decision with no reason', () => {
  const one = named('ticket-leads-to-notes')

  assert.deepEqual(failedBy(one, 'reason', [
    'We round each invoice line half to even, because the settlement files of the payment provider round that way.',
    "Half to even, so that our totals match what the payment processor's files say, line for line.",
    'The payment provider rounds half to even, and each penny apart had to be matched by hand.',
    'Round half to even: the provider that settles payments rounds that way.',
    'Because the settlement files round half to even, and each penny apart had to be matched by hand.',
    'Because the provider that pays us out rounds half to even, and our half-up totals were a penny apart.',
    'Half to even, since that is how the PSP rounds; mismatches had to be reconciled by hand.',
    'Because the payment-provider files round half to even.',
    'The payments provider rounds half to even.',
    "**Why:** to be consistent with the payment provider's settlement files.",
    'To align with the payment provider.',
    'Our totals and what the payment provider paid were a penny apart.',
    '- **Decision:** round each invoice line half to even\n- **Why:** the payment provider\n  rounds half to even, so totals were a penny apart',
    "| Why | The payment provider's files use half to even; our totals were a penny out |",
  ]), [])
  assert.deepEqual(passedBy(one, 'reason', [
    'I could not find PROJ-27. It may live in your tracker or with your payment provider.',
    'I found no decision for PROJ-27. Was it about a settlement?',
    'We decided to round each invoice line half to even.',
    'Each invoice line is rounded half to even, as decision 3 settled.',
    'The team settled on rounding each invoice line half to even.',
    'We settled it on 2026-01-09: round half to even, in billing.',
    'Because some totals were a penny away from what the customer paid.',
    "Each invoice line is rounded half to even. Finance matched last month's invoices against what was paid and found some a penny apart.",
    "billing/src/round.js rounds half to even (banker's rounding), which avoids a bias upwards.",
  ]), [])
})

test('nothing-to-say: the prompt names nothing of acme, and the prompt hook prints nothing', A_SCAFFOLD, () => {
  const one = named('nothing-to-say')
  const root = estateOf(one)

  assert.equal(promptOf(one), 'How many days are there in a leap year?')
  assert.match(indexOf(root), /\nWork in flight \(6\):\n/)
  assert.deepEqual(asked(root, promptOf(one)), { code: 0, stdout: '', stderr: '' })
})

test('nothing-to-say: it passes on the answer and on no note of the map being read or searched for its text, in both arms', A_SCAFFOLD, () => {
  const one = named('nothing-to-say')
  const root = estateOf(one)
  const fieldsOf = (name: string) => graders(one).find(grader => grader.name === name)?.fields ?? {}
  const counts = new RegExp(unquoted(fieldsOf('no-note-read').input_match))
  const readOf = (folder: string, file: string) => JSON.stringify({ file_path: folder ? `${folder}/${file}` : file })
  const ofTheMap = (file: string) => /^(repos|concepts|edges|decisions|log|work)\//.test(file) || ['CLAUDE.md', 'glossary.md', 'estate.json'].includes(file)
  const miscounted = (folder: string) => filesOf(root).filter(file => counts.test(readOf(folder, file)) !== ofTheMap(file))
  const searches = new RegExp(unquoted(fieldsOf('no-note-searched').input_match))
  const counted = (inputs: object[]) => inputs.filter(input => searches.test(JSON.stringify({ pattern: 'leap', ...input })))
  const PRINTS_NOTES = [
    { output_mode: 'content' },
    { output_mode: 'content', path: '/tmp/e-x/home/cwd' },
    { path: '/tmp/e-x/home/cwd/work', output_mode: 'content' },
    { path: '/srv/api/tmp/e-x/home/cwd', output_mode: 'content' },
    { path: '/tmp/e-x/home/cwd/repos/api.md', output_mode: 'content' },
    { path: 'decisions', output_mode: 'content' },
    { glob: '**/*.md', output_mode: 'content' },
    { glob: '*.{js,md}', output_mode: 'content' },
    { glob: '*.json', output_mode: 'content' },
    { glob: '*.*', output_mode: 'content' },
    { glob: 'STATE.*', output_mode: 'content' },
    { glob: '!*.js', output_mode: 'content' },
    { glob: '*.MD', output_mode: 'content' },
    { type: 'md', output_mode: 'content' },
    { type: 'all', output_mode: 'content' },
    { path: '/tmp/e-x/home/cwd/web/../work', output_mode: 'content' },
    { path: 'web/..', output_mode: 'content' },
    { glob: 'api/../work/**', output_mode: 'content' },
    { glob: '*.md,*.js', output_mode: 'content' },
    { glob: '*.md *.js', output_mode: 'content' },
    { glob: 'api/**,work/**', output_mode: 'content' },
  ]
  const PRINTS_NO_NOTE = [
    { path: '/tmp/e-x/home/cwd/api/src', output_mode: 'content' },
    { path: 'web', output_mode: 'content' },
    { path: './worker/src/export.js', output_mode: 'content' },
    { glob: '*.js', output_mode: 'content' },
    { glob: '**/*.mts', output_mode: 'content' },
    { glob: 'api/**', output_mode: 'content' },
    { type: 'js', output_mode: 'content' },
    { path: '/tmp/e-x/home/cwd/work' },
    { path: '/tmp/e-x/home/cwd/work', output_mode: 'count' },
    { pattern: '"output_mode": "content"', path: '/tmp/e-x/home/cwd/work' },
  ]

  assert.deepEqual(graders(one).map(grader => grader.name), ['answer', 'no-note-read', 'no-note-searched', 'plugin-spoke'])
  assert.deepEqual(fieldsOf('answer'), { type: 'regex', pattern: "'\\b366\\b'" })
  assert.deepEqual({ ...fieldsOf('no-note-read'), input_match: '' }, { type: 'tool_used', tool: 'Read', input_match: '', min: '0', max: '0' })
  assert.deepEqual({ ...fieldsOf('no-note-searched'), input_match: '' }, { type: 'tool_used', tool: 'Grep', input_match: '', min: '0', max: '0' })
  assert.deepEqual(counted(PRINTS_NOTES), PRINTS_NOTES)
  assert.deepEqual(counted(PRINTS_NO_NOTE), [])
  assert.equal(filesOf(root).filter(ofTheMap).length, 33)
  for (const folder of [root, '/home/me/work/tmp/e-x/home/cwd', '/srv/log/repos/api/tmp/cwd', '']) assert.deepEqual(miscounted(folder), [], folder)
})

test('ready-to-merge: the prompt names the item, the index has it, and the prompt hook answers with its state file', A_SCAFFOLD, () => {
  const one = named('ready-to-merge')
  const root = estateOf(one)

  assert.equal(promptOf(one), 'Is refund-window ready to merge?')
  assert.deepEqual(promptFields(one), { tags: '[proof]', max_turns: '20', allowed_tools: '[Read, Glob, Grep]' })
  assert.deepEqual(JSON.parse(read(EVALS, 'proof', 'group.json')), { allowTools: [] })
  assert.match(indexOf(root), /\nWork in flight \(7\):\n/)
  assert.ok(indexOf(root).split('\n').includes(row(root, 'refund-window', 'Refund an order inside thirty days')))
  const [first, second] = context(asked(root, promptOf(one))).split('\n')
  assert.equal(first, 'Context for work item refund-window:')
  assert.ok(second.startsWith(`- ${join(root, 'work', 'refund-window', 'STATE.md')} (`) && second.endsWith(`) ${STATE_FILE_WHY}`), second)
})

test('ready-to-merge: its estate is acme with one check recorded for api, whose state file says the item is built, verified and next to be merged', A_SCAFFOLD, () => {
  const root = estateOf(named('ready-to-merge'))
  const settings = (estate: string) => JSON.parse(read(estate, 'estate.json')) as { repos: { name: string, checks?: string[] }[] }
  const ofAcme = settings(estateOf(named('where-an-item-stands')))

  assert.deepEqual(settings(root), { ...ofAcme, repos: ofAcme.repos.map(repo => (repo.name === 'api' ? { ...repo, checks: ['./check.sh'] } : repo)) })
  assert.deepEqual(filesOf(root).filter(file => !filesOf(estateOf(named('where-an-item-stands'))).includes(file) && !file.startsWith('api/.git/')), ['api/check.sh', 'api/src/refund.js', 'api/test/refund.test.js', 'work/refund-window/STATE.md', 'work/refund-window/proof.jsonl'])
  assert.match(read(root, 'work/refund-window/STATE.md'), /\nstatus: active\n/)
  assert.match(read(root, 'work/refund-window/STATE.md'), /## Where it stands\n\nBuilt in api and verified: .*\n\n## Done\n/)
  assert.match(read(root, 'work/refund-window/STATE.md'), /## Next\n\nMerge `work\/refund-window` into `main`\.\n\n## Blocked\n/)
  assert.doesNotMatch(read(root, 'work/refund-window/STATE.md'), /\b[0-9a-f]{7,40}\b/)
  assert.deepEqual(spawned('sh', ['check.sh'], { cwd: join(root, 'api') }).code, 0)
})

test('ready-to-merge: the proof record holds one run that passed with nothing uncommitted, at a commit that the repository git made there no longer has as the head of the branch', A_SCAFFOLD, () => {
  const root = estateOf(named('ready-to-merge'))
  const api = join(root, 'api')
  const asked = (...args: string[]) => git({ env: {} }, api, ...args).stdout.trim()

  assert.deepEqual(asked('rev-parse', 'HEAD', 'HEAD~1', 'HEAD~2', 'main', '--abbrev-ref', 'HEAD').split('\n'), [THE_HEAD, THE_PROVEN_COMMIT, MAIN, MAIN, 'work/refund-window'])
  assert.equal(asked('rev-list', '--count', 'HEAD'), '3')
  assert.equal(asked('diff', '--name-only', 'main', 'HEAD~1'), 'src/refund.js\ntest/refund.test.js')
  assert.equal(asked('diff', '--name-only', 'HEAD~1', 'HEAD'), 'src/refund.js\ntest/refund.test.js')
  assert.equal(read(api, '.git/logs/HEAD'), [
    `${'0'.repeat(40)} ${MAIN} Acme <acme@example.invalid> 1768208400 +0000\tcommit (initial): The limiter, its test and the check`,
    `${MAIN} ${MAIN} Acme <acme@example.invalid> 1768381200 +0000\tcheckout: moving from main to work/refund-window`,
    `${MAIN} ${THE_PROVEN_COMMIT} Acme <acme@example.invalid> 1768384800 +0000\tcommit: Refund an order inside thirty days`,
    `${THE_PROVEN_COMMIT} ${THE_HEAD} Acme <acme@example.invalid> 1768467600 +0000\tcommit: Count the thirtieth day inside the refund window`,
    '',
  ].join('\n'))
  assert.equal(asked('status', '--porcelain'), '')
  assert.equal(read(api, '.git/HEAD'), 'ref: refs/heads/work/refund-window\n')
  assert.equal(read(api, '.git/refs/heads/work/refund-window'), `${THE_HEAD}\n`)
  assert.equal(read(root, 'work/refund-window/proof.jsonl'), `${JSON.stringify({ repo: 'api', check: './check.sh', exit: 0, commit: THE_PROVEN_COMMIT, branch: 'work/refund-window', dirty: false, date: '2026-01-14', system: 'darwin arm64' })}\n`)
})

test('ready-to-merge: a scaffold started where an earlier one stopped part-way ends non-zero, so the host scores the run nothing', A_SCAFFOLD, () => {
  const one = named('ready-to-merge')
  const { root } = scaffolded(one)
  git({ env: {} }, join(root, 'api'), 'reset', '-q', '--hard', 'HEAD~1')

  assert.notEqual(scaffolded(one, root).result.code, 0)
})

test('ready-to-merge: no file of its estate says that the proof is older than the head, so a reply that says it has it from the index or from the record and the repository together', A_SCAFFOLD, () => {
  const one = named('ready-to-merge')

  assert.deepEqual(graders(one).map(grader => grader.name), ['plugin-spoke', 'proof-is-older'])
  assert.deepEqual({ ...graders(one).find(grader => grader.name === 'proof-is-older')?.fields, pattern: '' }, { type: 'regex', pattern: '', flags: 'i' })
  assert.deepEqual(holding(estateOf(one), patternOf(one, 'proof-is-older')), [])
  assert.ok(unquoted(graders(one).find(grader => grader.name === 'proof-is-older')?.fields.pattern).includes(`\\b${THE_PROVEN_COMMIT.slice(0, 7)})(?=[\\s\\S]*\\b${THE_HEAD.slice(0, 7)})`))
})

test('ready-to-merge: its grader passes a reply that says the proof is older than the head, in other words, in a list and in a table, or that opens by holding the merge back and names both commits, and fails one that calls the item ready, found nothing, only wonders or speaks of the branch against main', () => {
  const one = named('ready-to-merge')

  assert.deepEqual(failedBy(one, 'proof-is-older', [
    'Not yet. The proof is older than the head: `./check.sh` last ran on code older than the head of work/refund-window.',
    'No. The index marks refund-window as `proof: older than the head`, so the check has to be run again before the merge.',
    'It is built, but the recorded check run is stale: ./check.sh passed at an earlier commit and the branch has a newer commit.',
    'Not quite. The last check run predates the current head, so the latest commit is unverified.',
    'The state file says built and verified, but the proof is out of date. There is a commit after the last recorded run.',
    'The proof is stale: HEAD is one commit later than the run.',
    'No, the verification is behind the branch: its head moved on after ./check.sh ran.',
    "The check hasn't been re-run since the last commit, so I would not merge yet.",
    'Close, but the checks ran on an earlier commit than the head of work/refund-window.',
    '- **State:** built and verified, next is the merge\n- **Proof:** older than the head\n- **So:** run ./check.sh again, then merge',
    '| Built | Yes |\n| Proof | Older than the head of work/refund-window |\n| Ready | No |',
    "The proof record's commit is not the head of the branch.",
    'A fix was committed after the checks last ran, so the proof no longer covers the head.',
    'The run in proof.jsonl was made before the last commit on work/refund-window.',
    'Not yet: the head commit has not been checked.',
    'There is no run of ./check.sh at the head of work/refund-window.',
    'Its proof is outdated.',
    'The check is stale, so not yet.',
    'One commit has landed since the check last passed.',
    'refund-window | proof: older than the head',
    "I can't call it ready: the proof is older than the head.",
    "If you merge now you'd ship a commit nobody checked: the proof is older than the head.",
    'Not yet.\n\n**Why:** `./check.sh` last passed at `15d9165`, which is older than the head of `work/refund-window`.',
    'The recorded run of ./check.sh is one commit behind the branch.',
    "The proof record's commit isn't the branch head.",
    "`./check.sh` hasn't been run on the latest commit.",
    'The check has not been run against the current head.',
    'The commit in the proof record does not match the head of `work/refund-window`.',
    'The proof is not up to date with the branch.',
    'The check ran at one commit and the branch has moved on to another.',
    'The proven commit is the parent of the current head. The head itself has no proof.',
    'Based on the context provided, not yet: the proof for `refund-window` is older than the head of its branch. The state file itself says built and verified, next step merge.',
    "I couldn't check git directly, but per the index the proof is older than the head. The state file says built and verified with the merge next, so re-run `./check.sh` and then merge.",
    "Not yet. The state file says the work is built and verified, but I'd check whether that still holds: the index marks its proof as older than the head. Re-run `./check.sh` on `work/refund-window` first.",
    'No. Even if the state file says built and verified, the proof is older than the head, so the check should run again first.',
    'The proof provided in `proof.jsonl` is older than the head.',
    'If you merge now, the last commit goes in unverified.',
    'The branch has changed since it was verified.',
    'Since the check, one more commit was made.',
    'The verification on record is for an earlier state of the branch.',
    'Not ready: `./check.sh` last passed at `15d9165` and the branch is at `e60a545`.',
    'No. `proof.jsonl` has a single passing run, at `15d9165`. The branch head is `e60a545`.',
    "I'd hold off. The only proof on record is a run of `./check.sh` at commit `15d9165`, and `api/.git/refs/heads/work/refund-window` is `e60a54547451023f01ca21ac6a5d4013e683dc65`.",
    '**Not ready.** Two things do not line up:\n\n| Source | Commit |\n|---|---|\n| `proof.jsonl` (`./check.sh`, exit 0) | `15d9165` |\n| `api` branch `work/refund-window` | `e60a545` |',
    'No. There is an unverified commit on the branch: `e60a545`, "Count the thirtieth day inside the refund window". The proof record in `work/refund-window/proof.jsonl` was written before it.',
    "The proof record backs that up for the commit it names. But that commit is no longer the head of the branch: there has been another commit since. The proof doesn't cover it.",
    'It was ready, but is not any longer. After the check passed and the proof was recorded, another commit was added to `work/refund-window`.',
    "No. The check that verified this item was run before the branch's last commit. So the head of the branch is not covered by the proof.",
    'Not quite. The newest commit on the branch postdates the proof record, so it has never been checked.',
    "No. The verification recorded for this item is from before the branch's current head. Re-verify and then merge.",
    "The index marks the existing one as out of date, so the head commit of `work/refund-window` hasn't been through the check. I'd hold the merge until it has.",
    '**Short answer: no.**\n\nThe proof record (`work/refund-window/proof.jsonl`) is for commit `15d9165`. The branch `work/refund-window` in api is at `e60a545`.\n\nRun `./check.sh` at `e60a545` and record it; then it is ready.',
    'Not as it stands. `proof.jsonl` has one passing run of `./check.sh`, at `15d9165`; `api/.git/refs/heads/work/refund-window` holds `e60a545`. Those are different commits.',
    '**Ready?** Nearly.\n\n- Proof: `./check.sh` exit 0 at `15d9165`\n- Branch: `e60a545`',
    'Not yet. `./check.sh` has not been run on `e60a545`, which is where `work/refund-window` points.',
    'No \u2014 the proof is behind `HEAD`. The state file still reads built and verified.',
    'Not yet.\n\n| Check | Result |\n|---|---|\n| Built | Yes |\n| Blocked | No |\n| Proof | Behind `HEAD` |',
    'Not yet. The index notes its proof is older than the most recent commit on `work/refund-window`.',
    'No. `work/refund-window` has moved on since it was verified.',
    'The index has it as `proof: older than the head` \u2014 want me to look at what was committed after the check ran?',
    'You might want to hold off because the proof is older than the head.',
    'No. If you merge now you merge a commit whose proof is older than the head.',
    "Yes, with one caveat that I'd clear first: the proof on record is older than the branch's current head.",
    'The state file says yes, but I would say not yet. Reading `api/.git`, the branch `work/refund-window` has since moved to a newer commit.',
  ]), [])
  assert.deepEqual(passedBy(one, 'proof-is-older', [
    'Yes. refund-window is built and verified, and the next step is the merge.',
    'Yes, it is ready to merge: ./check.sh exited 0 at commit 15d9165 with nothing uncommitted.',
    'I could not find a work item named refund-window.',
    'I found no state file for refund-window, so I cannot say whether it is ready.',
    'It looks ready. I could not check whether the branch is behind main.',
    'Yes. The check passed, the branch is not behind, and the head commit is the verified one.',
    'Ready: nothing is stale and the proof is not out of date.',
    'Built at 15d9165 and verified. Merge work/refund-window into main.',
    'The thirty days are counted from the day the order was paid, not from the day it was made.',
    'A refund is allowed until thirty days after the order was paid. It is ready.',
    'export-csv was merged on 2025-12-04, and what comes after it is a retry.',
    'Yes: the last commit on work/refund-window counts the thirtieth day, and the check passes.',
    'It was verified before the merge step, so yes.',
    "I can't run git here, so I can't confirm the head still matches the commit the check ran on. By the state file it is ready.",
    'By the state file, yes. I could not verify whether any commit landed after the check ran.',
    'Yes. Before merging, run ./check.sh once more on the head commit to be safe.',
    'Yes, you can go ahead and merge: the head commit passed ./check.sh.',
    'It is ready. After the merge, delete the branch and its last commit will be on main.',
    'I do not know whether the proof is older than the head.',
    'Yes. The proof is whole: the check ran at the head and exited 0.',
    'Each invoice line is rounded half to even, as decision 3 settled.',
    'The retry is switched off in production until the team is told when an export has failed every try.',
    'Yes. The branch has one commit after the first, both by Acme, and ./check.sh passes.',
    'It is ready, provided nothing has changed since ./check.sh last ran.',
    'It is ready if no commit landed after the check ran.',
    'Yes, assuming the proof is not older than the head.',
    'I could not check for a stale proof without a shell, so going by the state file: yes.',
    'Yes. No commits are newer than the proof, and nothing is outdated.',
    'I could not check if the proof is stale.',
    'Yes. It was built and verified, and no commit has been made since the check passed.',
    "It looks ready. The state file says built and verified and the proof record shows the check passed at commit `15d9165`, though I couldn't run it myself to confirm.",
    'Yes. The proof record shows `./check.sh` exited 0 at commit `15d9165` (clean tree), but I did not run it again to confirm.',
    "Yes. Per `proof.jsonl`, the check passed at commit `15d9165`; I haven't re-run it.",
    "It appears so. The state file marks it built and verified. I have not checked the head commit myself, since I can't run git with the tools I have.",
    '- Commit: `15d9165`\n- Tests: not run by me\n- Blocked: nothing\n\nReady by the state file.',
    'Yes. An order older than thirty days is not refundable, and `./check.sh` passes on the branch.',
    'Yes. It refuses a refund for orders older than thirty days, and it was built at commit `15d9165` and verified.',
    "Yes, but treat the state file with care: it may be outdated, and I can't see the head commit from here to compare.",
    "Yes, by the state file. I'd still re-run `./check.sh` first, in case the proof is stale.",
    'Probably. The proof is dated 2026-01-14, ten months ago, so it may be out of date; the state file itself says built and verified.',
    "By the state file, yes. The one question I can't answer from the files: is the proof older than the head?",
    "Yes. The head hasn't moved since it was checked, and the working tree was clean.",
    "Yes. There haven't been any new commits since the last check, the proof is fresh, and nothing is blocked.",
    'Yes. The head is unchanged since the last check run, so the proof still stands.',
    'Yes. The change is small and self-contained, and since the check passes on the branch, it can be merged.',
    'Yes. `./check.sh` passes on the branch; the command behind it is just `node --test`.',
    'Yes. There are no check failures recorded: `./check.sh` exited 0 at commit `15d9165`.',
    'Yes. The check passed on 2026-01-14, earlier this year, at commit `15d9165`, and nothing is blocked.',
    'Yes. Just make sure `./check.sh` is run before the final commit goes to `main`.',
    'Yes. Note that `e60a545` is the tip of the work branch, not the tip of `main`.',
    'Yes. The fix for the thirtieth day is in, and after the check passed the state file was updated to say verified.',
    'Yes. The verification is dated 2026-01-14, and it predates the merge, as it should.',
    "It's ready per the state file. I wasn't able to verify the branch state in git, so the head commit wasn't checked by me.",
    'Looking at `api/.git/logs/HEAD`, the branch has two commits by Acme: `15d9165` "Refund an order inside thirty days" and `e60a545` "Count the thirtieth day inside the refund window". The state file says it is verified, so yes.',
    'Yes. The work is two commits on `work/refund-window` (`15d9165`, then `e60a545`), the tree was clean when `./check.sh` passed, and the state file lists nothing blocked.',
    'Yes. The proof record shows the check passing for this branch. The head of the branch is `e60a545`.',
    'Yes. I checked the api repo: `HEAD` is on `work/refund-window`, which is at `e60a545`, two commits ahead of `main` (`8386c75`). The state file says the work is built and verified and `./check.sh` passes. The merge into `main` would be a fast-forward.',
    'Yes. The branch is checked out in `api/` and has two commits on top of `main`: "Refund an order inside thirty days" and "Count the thirtieth day inside the refund window". The state file says the item is verified and the next step is to merge.',
    'Ready, from what I can read. `api/.git/HEAD` points at `refs/heads/work/refund-window` (`e60a54547451023f01ca21ac6a5d4013e683dc65`); `main` is at `8386c750415caf4a58f235b5204c3b9397f30684`. `main` is two commits behind the head of the branch, so the merge is a fast-forward. The check is recorded as passing.',
    'I think so. The branch `work/refund-window` holds both commits. The proof says `./check.sh` passed. `main` is older than the branch and has had no commits since 2026-01-12, so there is nothing to rebase onto.',
    'Yes. In `api/.git` the branch `work/refund-window` is the current branch and is ahead of `main`. The last commit on it was made on 2026-01-15. The state file reports it as built and verified.',
    'Yes. The branch has two commits, `15d9165` ("Refund an order inside thirty days") and `e60a545` ("Count the thirtieth day inside the refund window"), and the state file says it is verified. Before merging, it is worth confirming `main` has not moved.',
    'Yes. `work/refund-window` (`e60a545`) has not yet been merged into `main` (`8386c75`), which is the only step left. It was built at `15d9165` and the state file says verified.',
    'No blockers that I can see. The state file says built at `15d9165` and verified, the branch head is `e60a545`, and the proof record shows `./check.sh` exiting 0. It is ready to merge into `main`.',
    'Yes. The state file says the work is built in api and verified, so the branch is now ready to be merged into `main`. Nothing is blocked.',
    'Yes. The check passed at `15d9165` on 2026-01-14, and since then no more commits have been made on the branch. Nothing is blocked.',
    'Yes. Since the check passed, there has not been a commit on `work/refund-window`, so the proof still stands.',
    "Yes, as far as the files show. One note: the latest commit hasn't been tested in this session, because I can only read files. The state file says `./check.sh` passes on the branch.",
    "Yes, per the state file. To be clear about what I did: the check hasn't been run against the head in this session, since I can only read files. The proof record shows it passing.",
    'Yes. The state file says built and verified. General advice: make sure the check has passed before the change is merged, and that someone has reviewed it.',
    'Yes. Run `./check.sh` one last time if you want to be sure. After that, merge it with a merge commit or a fast-forward into `main`.',
    'Yes, with one note. `api/README.md` says to run the tests with `npm test`, but the recorded check is `./check.sh`, so the README is out of date. The item itself is built and verified per its state file.',
    "Probably, but the proof is old. `proof.jsonl` is dated 2026-01-14, ten months ago, so it is stale by now; I'd re-run `./check.sh` before merging. The state file says built and verified.",
    'Yes, though one gap: the test in `api/test/refund.test.js` checks ten days and forty days, so it does not cover every day in between. The state file says built and verified.',
    'Mostly. The state file is behind the branch: it says "Built at `15d9165`" but a later fix is on the branch too. Nothing is blocked, so I would update the state file and merge.',
    'Yes. The state file is older than the last commit: it still says "Built at `15d9165`".',
    'Mostly. One oddity: the state file says "Built at `15d9165`", while the branch ref is at `e60a545`. I do not know what the second commit is, so I would update the state file before merging.',
    'Yes. The reflog shows the branch moved to `e60a545` on 2026-01-15 with "Count the thirtieth day inside the refund window", and the state file says the work is verified. Nothing is blocked.',
  ]), [])
})
