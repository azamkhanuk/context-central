import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readdirSync, readFileSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { ACME_FILES, ACME_SHOT, REPO, acme, acmeIndex, acmePointers, disposable, hook, makeTree, run } from './helpers.mts'
import type { Env, Result } from './helpers.mts'

const tree = disposable()

type HookOutput = { systemMessage: string, hookSpecificOutput: { additionalContext: string } }

const STATE = 'work/PROJ-12/STATE.md'
const stateDir = () => tree(makeTree({}))
const fire = (event: string, input: unknown, env: Env = {}) => hook(event, input, { env: { CONTEXT_CENTRAL_STATE_DIR: stateDir(), ...env } })
const context = (result: Result) => (JSON.parse(result.stdout) as HookOutput).hookSpecificOutput.additionalContext
const silent = (result: Result) => assert.deepEqual(result, { code: 0, stdout: '', stderr: '' })

test('a new session is given the index with absolute paths', () => {
  const root = tree(acme())

  const result = fire('session-start', { session_id: 's1', cwd: root, hook_event_name: 'SessionStart', source: 'startup' })

  assert.equal(result.code, 0)
  assert.equal(result.stderr, '')
  assert.deepEqual(JSON.parse(result.stdout) as unknown, { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: acmeIndex(root) } })
})

test('a forked session is given the index', () => {
  const root = tree(acme())

  assert.equal(context(fire('session-start', { session_id: 's1', cwd: root, source: 'fork' })), acmeIndex(root))
})

test("a session in a registered repo is given that repo's note after the hub", () => {
  const root = tree(acme())

  const lines = context(fire('session-start', { cwd: join(root, 'web'), source: 'startup' })).split('\n')

  assert.equal(lines[2], `Repo web: ${join(root, 'repos/web.md')}`)
  assert.deepEqual([...lines.slice(0, 2), ...lines.slice(3)], acmeIndex(root).split('\n'))
})

test('a session started inside a repo that has a standards note is given both', () => {
  const root = tree(acme({ 'standards/web.md': '# web\n' }))

  assert.equal(context(fire('session-start', { cwd: join(root, 'web'), source: 'startup' })).split('\n')[2], `Repo web: ${join(root, 'repos/web.md')}; standards: ${join(root, 'standards/web.md')}`)
})

test('outside any map the hooks say nothing', () => {
  const outside = tree(makeTree({ 'notes.md': '# Notes\n' }))

  silent(fire('session-start', { cwd: outside, source: 'startup' }))
  silent(fire('user-prompt-submit', { cwd: outside, prompt: 'pick up PROJ-12' }))
})

test('in a folder the estate leaves alone, or one it does not register, the hooks say nothing', () => {
  const root = tree(acme())

  silent(fire('session-start', { cwd: join(root, 'scratch'), source: 'startup' }))
  silent(fire('session-start', { cwd: join(root, 'elsewhere'), source: 'startup' }))
  silent(fire('user-prompt-submit', { cwd: join(root, 'scratch'), prompt: 'pick up PROJ-12' }))
})

test('the project folder decides the map, wherever the session has wandered', () => {
  const root = tree(acme())

  const result = fire('session-start', { cwd: join(root, 'scratch'), source: 'startup' }, { CLAUDE_PROJECT_DIR: root })

  assert.equal(context(result), acmeIndex(root))
})

test('a session that has moved into a different map is left to that map', () => {
  const root = tree(acme({ 'web/.context-central/estate.json': { contextCentral: 1, name: 'web-only' } }))

  silent(fire('session-start', { cwd: join(root, 'web'), source: 'startup' }, { CLAUDE_PROJECT_DIR: root }))
  silent(fire('user-prompt-submit', { cwd: join(root, 'web'), prompt: 'pick up PROJ-12' }, { CLAUDE_PROJECT_DIR: root }))
})

test('a broken config is shown to the person and kept from the model', () => {
  const root = tree(acme({}, { contextCentral: 2 }))
  const message = `context-central: ${join(root, 'estate.json')}: "contextCentral" is 2; this version reads 1`

  const started = fire('session-start', { cwd: root, source: 'startup' })
  const prompted = fire('user-prompt-submit', { cwd: root, prompt: 'pick up PROJ-12' })

  assert.equal(started.code, 0)
  assert.deepEqual(JSON.parse(started.stdout) as unknown, { systemMessage: message })
  assert.deepEqual(JSON.parse(prompted.stdout) as unknown, { systemMessage: message })
})

test('a config that is not JSON is reported the same way', () => {
  const root = tree(acme())
  writeFileSync(join(root, 'estate.json'), '{ "contextCentral": 1, "name": ')

  const result = fire('session-start', { cwd: root, source: 'startup' })

  assert.equal(result.code, 0)
  assert.equal(result.stderr, '')
  assert.deepEqual(Object.keys(JSON.parse(result.stdout) as HookOutput), ['systemMessage'])
  assert.match((JSON.parse(result.stdout) as HookOutput).systemMessage, /^context-central: .*estate\.json: not valid JSON/)
})

test('a project in one map and a session standing in another get nothing from either', () => {
  const root = tree(acme())
  const other = tree(makeTree({ 'estate.json': { contextCentral: 1, name: 'other' } }))

  silent(fire('session-start', { cwd: other, source: 'startup' }, { CLAUDE_PROJECT_DIR: root }))
  silent(fire('user-prompt-submit', { cwd: other, prompt: 'pick up PROJ-12' }, { CLAUDE_PROJECT_DIR: root }))
})

test('a map with no notes yet gives its index and stays silent on prompts', () => {
  const root = tree(makeTree({ 'estate.json': { contextCentral: 1, name: 'bare' } }))

  const started = fire('session-start', { cwd: root, source: 'startup' })

  assert.equal(context(started), [`Context map "bare": ${root}`, `Hub: ${join(root, 'CLAUDE.md')} (missing)`, 'No work in flight.'].join('\n'))
  silent(fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'how do billing retries behave' }))
})

test('input that is not JSON, or an event the hook does not know, is met with silence', () => {
  const root = tree(acme())

  silent(run(['hook', 'session-start'], { cwd: root, stdin: 'not json' }))
  silent(fire('session-end', { cwd: root }))
})

test('an event named after something every object has is met with silence', () => {
  const root = tree(acme())

  silent(fire('constructor', { cwd: root }))
  silent(fire('toString', { cwd: root }))
})

test('with debugging on, the reason for silence goes to stderr', () => {
  const root = tree(acme())

  const result = fire('session-end', { cwd: root }, { CONTEXT_CENTRAL_DEBUG: '1' })

  assert.equal(result.code, 0)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /unknown hook event "session-end"/)
})

test('a prompt that names a work item is given its pointers with absolute paths', () => {
  const root = tree(acme())

  const result = fire('user-prompt-submit', { session_id: 's1', cwd: root, hook_event_name: 'UserPromptSubmit', prompt: 'pick up PROJ-12 where we left it' })

  assert.equal(result.code, 0)
  assert.equal(result.stderr, '')
  assert.deepEqual(JSON.parse(result.stdout) as unknown, { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: acmePointers(root) } })
})

test('a prompt that names an item with evidence is told where it is, by absolute path', () => {
  const root = tree(acme({ [ACME_SHOT]: 'x'.repeat(300) }))

  const result = fire('user-prompt-submit', { session_id: 's1', cwd: root, hook_event_name: 'UserPromptSubmit', prompt: 'pick up PROJ-12 where we left it' })

  assert.equal(context(result), `${acmePointers(root)}\nEvidence: 1 file (300 B) under ${join(root, 'work/PROJ-12/evidence')}, not listed one by one.`)
})

test('a prompt that matches nothing is met with silence', () => {
  const root = tree(acme())

  silent(fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'what time is it' }))
})

test('a prompt that mentions a readme is answered by the repo it names, though the work folder holds a README', () => {
  const root = tree(acme({ 'work/README.md': '# Work\n\nHow this folder is kept.\n' }))

  const result = fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'tidy the readme for web' })

  assert.equal(context(result).split('\n')[0], 'Context for repo web:')
})

test('the same answer is given once in a session, and again in another session', () => {
  const root = tree(acme())
  const env = { CONTEXT_CENTRAL_STATE_DIR: stateDir() }
  const prompt = { cwd: root, prompt: 'PROJ-12 again' }

  const first = fire('user-prompt-submit', { ...prompt, session_id: 's1' }, env)
  const second = fire('user-prompt-submit', { ...prompt, session_id: 's1' }, env)
  const other = fire('user-prompt-submit', { ...prompt, session_id: 's2' }, env)

  assert.equal(context(first), acmePointers(root))
  silent(second)
  assert.equal(context(other), acmePointers(root))
})

test('the session record holds what was delivered and the active item', () => {
  const root = tree(acme())
  const dir = stateDir()
  const env = { CONTEXT_CENTRAL_STATE_DIR: dir }

  fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'PROJ-12' }, env)
  fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'and the web side' }, env)

  assert.deepEqual(JSON.parse(readFileSync(join(dir, 's1.json'), 'utf8')) as unknown, { delivered: ['item:PROJ-12', 'repo:web'], active: 'PROJ-12' })
})

test('with no session id nothing is recorded and nothing is held back', () => {
  const root = tree(acme())
  const dir = stateDir()
  const env = { CONTEXT_CENTRAL_STATE_DIR: dir }

  fire('user-prompt-submit', { cwd: root, prompt: 'PROJ-12' }, env)
  const second = fire('user-prompt-submit', { cwd: root, prompt: 'PROJ-12' }, env)

  assert.equal(context(second), acmePointers(root))
  assert.deepEqual(readdirSync(dir), [])
})

test('a session id cannot steer the record out of its folder', () => {
  const root = tree(acme())
  const dir = join(stateDir(), 'records')

  fire('user-prompt-submit', { session_id: '../../escape', cwd: root, prompt: 'PROJ-12' }, { CONTEXT_CENTRAL_STATE_DIR: dir })

  assert.deepEqual(readdirSync(dir), ['______escape.json'])
})

test('a record that cannot be written does not cost the answer', () => {
  const root = tree(acme())
  const blocked = join(tree(makeTree({ taken: 'a file, not a folder' })), 'taken')

  const result = fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'PROJ-12' }, { CONTEXT_CENTRAL_STATE_DIR: blocked })

  assert.equal(context(result), acmePointers(root))
  assert.equal(result.stderr, '')
})

test('after a clear the session starts from nothing', () => {
  const root = tree(acme())
  const dir = stateDir()
  const env = { CONTEXT_CENTRAL_STATE_DIR: dir }
  fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'PROJ-12' }, env)

  const cleared = fire('session-start', { session_id: 's1', cwd: root, source: 'clear' }, env)
  const again = fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'PROJ-12' }, env)

  assert.equal(context(cleared), acmeIndex(root))
  assert.equal(context(again), acmePointers(root))
})

for (const source of ['compact', 'resume']) {
  test(`after a ${source} the state file of the active item follows the index`, () => {
    const root = tree(acme())
    const env = { CONTEXT_CENTRAL_STATE_DIR: stateDir() }
    fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'PROJ-12' }, env)

    const result = fire('session-start', { session_id: 's1', cwd: root, source }, env)

    assert.equal(context(result), `${acmeIndex(root)}\n\nState of PROJ-12 (${join(root, STATE)}):\n${ACME_FILES[STATE].trimEnd()}`)
  })
}

test('after a compaction a pointer given before is given again', () => {
  const root = tree(acme())
  const env = { CONTEXT_CENTRAL_STATE_DIR: stateDir() }
  fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'PROJ-12' }, env)
  fire('session-start', { session_id: 's1', cwd: root, source: 'compact' }, env)

  assert.equal(context(fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'PROJ-12' }, env)), acmePointers(root))
})

test('after a resume a pointer given before is still held back', () => {
  const root = tree(acme())
  const env = { CONTEXT_CENTRAL_STATE_DIR: stateDir() }
  fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'PROJ-12' }, env)

  fire('session-start', { session_id: 's1', cwd: root, source: 'resume' }, env)

  silent(fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'PROJ-12' }, env))
})

test('a new session does not carry the state file even when an item is active', () => {
  const root = tree(acme())
  const env = { CONTEXT_CENTRAL_STATE_DIR: stateDir() }
  fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'PROJ-12' }, env)

  assert.equal(context(fire('session-start', { session_id: 's1', cwd: root, source: 'startup' }, env)), acmeIndex(root))
})

test('a resumed session with no active item is given the index alone', () => {
  const root = tree(acme())

  assert.equal(context(fire('session-start', { session_id: 's1', cwd: root, source: 'resume' })), acmeIndex(root))
})

test('a long state file is cut so the whole text stays under the hook limit', () => {
  const root = tree(acme({ [STATE]: `# PROJ-12: Rate limit the gateway\n\n${'A line of detail.\n'.repeat(1000)}` }))
  const env = { CONTEXT_CENTRAL_STATE_DIR: stateDir() }
  fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'PROJ-12' }, env)

  const text = context(fire('session-start', { session_id: 's1', cwd: root, source: 'compact' }, env))

  assert.ok(text.length <= 9500)
  assert.ok(text.length > 9400)
  assert.ok(text.endsWith('A line of detail.\n[cut here; the file holds the rest]'))
})

const RESUMED = { session_id: 's1', source: 'resume', context_tokens: 182340, prompt_cache_likely_expired: true }
const NOTICE =
  "context-central: this session resumes with about 182k tokens uncached. If the earlier conversation is no longer needed, a fresh session started from the work item's state file is cheaper."

test('resuming a large session whose cache has lapsed tells the person what it costs', () => {
  const root = tree(acme())

  const output = JSON.parse(fire('session-start', { ...RESUMED, cwd: root }).stdout) as HookOutput

  assert.equal(output.systemMessage, NOTICE)
  assert.equal(output.hookSpecificOutput.additionalContext, acmeIndex(root))
})

test('a small session, or one whose cache is still warm, resumes without the notice', () => {
  const root = tree(acme())

  const small = JSON.parse(fire('session-start', { ...RESUMED, cwd: root, context_tokens: 99999 }).stdout) as HookOutput
  const warm = JSON.parse(fire('session-start', { ...RESUMED, cwd: root, prompt_cache_likely_expired: false }).stdout) as HookOutput

  assert.equal('systemMessage' in small, false)
  assert.equal('systemMessage' in warm, false)
})

test('the estate sets the size that earns the notice, and zero turns it off', () => {
  const lower = tree(acme({}, { budgets: { resumeNoticeTokens: 50000 } }))
  const off = tree(acme({}, { budgets: { resumeNoticeTokens: 0 } }))

  const noticed = JSON.parse(fire('session-start', { ...RESUMED, cwd: lower, context_tokens: 60000 }).stdout) as HookOutput
  const quiet = JSON.parse(fire('session-start', { ...RESUMED, cwd: off }).stdout) as HookOutput

  assert.match(noticed.systemMessage, /about 60k tokens uncached/)
  assert.equal('systemMessage' in quiet, false)
})

test('the plugin wires both events to the hook command without a shell', () => {
  const { hooks } = JSON.parse(readFileSync(join(REPO, 'hooks', 'hooks.json'), 'utf8')) as { hooks: { SessionStart: unknown, UserPromptSubmit: unknown } }

  assert.deepEqual(hooks.SessionStart, [
    {
      matcher: 'startup|resume|clear|compact|fork',
      hooks: [{ type: 'command', command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/bin/context-central', 'hook', 'session-start'] }],
    },
  ])
  assert.deepEqual(hooks.UserPromptSubmit, [
    { hooks: [{ type: 'command', command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/bin/context-central', 'hook', 'user-prompt-submit'], timeout: 10 }] },
  ])
  assert.equal(existsSync(join(REPO, 'bin', 'context-central')), true)
})

const BILLING = { 'concepts/billing-cycle.md': '# Billing cycle\n\nInvoices close monthly.\n' }
const PASTED = `${'x1 '.repeat(250)}how does the billing cycle work`

test('a short prompt is matched on its words', () => {
  const root = tree(acme(BILLING))

  const result = fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'how does the billing cycle work' })

  assert.ok(context(result).includes(join(root, 'concepts/billing-cycle.md')), context(result))
})

test('a long pasted prompt is not matched on its words', () => {
  const root = tree(acme(BILLING))

  silent(fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: PASTED }))
})

test('a long prompt that names a work item is still answered', () => {
  const root = tree(acme(BILLING))

  const result = fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: `${PASTED} for PROJ-12` })

  assert.match(context(result), /^Context for work item PROJ-12:/)
})

test('a short prompt that holds an item title word for word is given the item once and makes it the active item', () => {
  const root = tree(acme())
  const dir = stateDir()
  const env = { CONTEXT_CENTRAL_STATE_DIR: dir }
  const prompt = { session_id: 's1', cwd: root, prompt: 'how far along is rate limit the gateway?' }

  const first = fire('user-prompt-submit', prompt, env)
  const second = fire('user-prompt-submit', prompt, env)

  assert.equal(context(first), acmePointers(root))
  silent(second)
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 's1.json'), 'utf8')) as unknown, { delivered: ['item:PROJ-12'], active: 'PROJ-12' })
})

test('a long prompt that holds an item title and no key or name is met with silence', () => {
  const root = tree(acme())

  silent(fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: `${'x1 '.repeat(250)}rate limit the gateway` }))
})

test('a short prompt that only the words of an item name and title would answer is met with silence', () => {
  const root = tree(acme())
  const dir = stateDir()

  assert.equal((JSON.parse(run(['resolve', 'rate', 'gateway', '--json'], { cwd: root }).stdout) as { key: unknown }).key, 'item:PROJ-12')
  silent(fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'rate gateway' }, { CONTEXT_CENTRAL_STATE_DIR: dir }))
  assert.equal(existsSync(join(dir, 's1.json')), false)
})

test('a state file with Windows line endings gives the index the title from its frontmatter', () => {
  const state = '---\r\nitem: PROJ-60\r\ntitle: Cache the gateway\r\nstatus: active\r\n---\r\n# PROJ-60: a heading that is not the title\r\n'
  const root = tree(acme({ 'work/PROJ-60/STATE.md': state }))

  const index = context(fire('session-start', { session_id: 's1', cwd: root, source: 'startup' }))

  assert.ok(index.includes(`\n- PROJ-60 | Cache the gateway | ${join(root, 'work/PROJ-60/STATE.md')}\n`), index)
})

test('a config with a byte-order mark gives the index and no message about its JSON', () => {
  const root = tree(acme())
  writeFileSync(join(root, 'estate.json'), `\uFEFF${readFileSync(join(root, 'estate.json'), 'utf8')}`)

  const result = fire('session-start', { session_id: 's1', cwd: root, hook_event_name: 'SessionStart', source: 'startup' })

  assert.deepEqual(JSON.parse(result.stdout) as unknown, { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: acmeIndex(root) } })
})

const DESK_API_NOTE = '# api\n\nThe back end.\n'
const deskMap = () => tree(makeTree({ 'estate.json': { contextCentral: 1, name: 'acme', repos: [{ name: 'api' }], connections: { desk: { holds: 'tickets', references: ['#(?<id>\\d+)'] } } }, 'CLAUDE.md': '# Acme\n', 'repos/api.md': DESK_API_NOTE, 'api/README.md': '# api\n' }))
const NO_ITEM_FOR_99 = '#99 reads as a ticket of connection desk. No work item answers to it.'
const apiPointers = (root: string) => `Context for repo api:\n- ${join(root, 'repos/api.md')} (${Buffer.byteLength(DESK_API_NOTE)} B) repo note`

test('a short prompt that names a ticket no work item answers to is told so, once a session', () => {
  const root = deskMap()
  const env = { CONTEXT_CENTRAL_STATE_DIR: stateDir() }
  const prompt = { cwd: root, prompt: 'what does #99 ask for' }

  const first = fire('user-prompt-submit', { ...prompt, session_id: 's1' }, env)
  const second = fire('user-prompt-submit', { ...prompt, session_id: 's1' }, env)
  const other = fire('user-prompt-submit', { ...prompt, session_id: 's2' }, env)

  assert.equal(context(first), NO_ITEM_FOR_99)
  silent(second)
  assert.equal(context(other), NO_ITEM_FOR_99)
})

test('a long prompt is not told of a ticket that no work item answers to', () => {
  silent(fire('user-prompt-submit', { session_id: 's1', cwd: deskMap(), prompt: `${PASTED} and #99` }))
})

test('the line follows the pointers when the prompt also names something the map knows', () => {
  const root = deskMap()

  const result = fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'is #99 about the api' })

  assert.equal(context(result), `${apiPointers(root)}\n${NO_ITEM_FOR_99}`)
})

test('pointers given earlier in the session do not hold back a ticket that no work item answers to', () => {
  const root = deskMap()
  const env = { CONTEXT_CENTRAL_STATE_DIR: stateDir() }

  const first = fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'look at the api' }, env)
  const second = fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'is #99 about the api' }, env)

  assert.equal(context(first), apiPointers(root))
  assert.equal(context(second), NO_ITEM_FOR_99)
})

test('a ticket said to have no work item does not become the active item', () => {
  const root = deskMap()
  const dir = stateDir()

  fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'what does #99 ask for' }, { CONTEXT_CENTRAL_STATE_DIR: dir })

  assert.deepEqual(JSON.parse(readFileSync(join(dir, 's1.json'), 'utf8')) as unknown, { delivered: ['reference:desk:99'], active: null })
})

test('a ticket named after three that were already told of is still told of', () => {
  const root = deskMap()
  const env = { CONTEXT_CENTRAL_STATE_DIR: stateDir() }

  fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'what of #91 #92 #93' }, env)
  const second = fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'and #91 #92 #93 #94' }, env)

  assert.equal(context(second), '#94 reads as a ticket of connection desk. No work item answers to it.')
})

test('a prompt that ends where a pattern could match nothing is met with silence', () => {
  const root = tree(makeTree({ 'estate.json': { contextCentral: 1, name: 'acme', connections: { desk: { holds: 'tickets', references: ['(DESK-\\d+)?'] } } }, 'CLAUDE.md': '# Acme\n' }))

  silent(fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'what now?' }))
})

test('a prompt that names a repo is pointed at its standards note', () => {
  const root = tree(acme({ 'standards/api.md': '# api\n' }))

  const pointers = context(fire('user-prompt-submit', { cwd: root, prompt: 'what does the api repo do with limits?' })).split('\n')

  assert.equal(pointers[0], 'Context for repo api:')
  assert.equal(pointers[2], `- ${join(root, 'standards/api.md')} (6 B) standards of the repo`)
})

test('a prompt that names a work item is pointed at the standards of the repo the item links', () => {
  const root = tree(acme({ 'standards/api.md': '# api\n' }))

  const pointers = context(fire('user-prompt-submit', { cwd: root, prompt: 'PROJ-12' })).split('\n')

  assert.equal(pointers[5], `- ${join(root, 'standards/api.md')} (6 B) standards of the repo`)
})

test('a file where the work folder would be still gets a session its index', () => {
  const root = tree(makeTree({ 'estate.json': { contextCentral: 1, name: 'acme', title: 'Acme estate' }, 'CLAUDE.md': '# Acme estate\n', work: 'a file\n' }))

  const started = fire('session-start', { session_id: 's1', cwd: root, hook_event_name: 'SessionStart', source: 'startup' })

  assert.equal(context(started), [`Context map "Acme estate": ${root}`, `Hub: ${join(root, 'CLAUDE.md')}`, 'No work in flight.'].join('\n'))
})

const ONE_GATEWAY = '---\nid: ADR-12\n---\n# 0007: One gateway\n\nEvery call goes through it.\n'
const gatewayPointer = (root: string, why: string) => `- ${join(root, 'decisions/0007-one-gateway.md')} (${Buffer.byteLength(ONE_GATEWAY)} B) ${why}`

test('a short prompt that names a node by its identifier is given that node, once in a session', () => {
  const root = tree(acme({ 'decisions/0007-one-gateway.md': ONE_GATEWAY }))
  const dir = stateDir()
  const ask = (prompt: string) => fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt }, { CONTEXT_CENTRAL_STATE_DIR: dir })

  assert.equal(context(ask('what did ADR-12 settle')), ['Context for "what did ADR-12 settle":', gatewayPointer(root, 'known as: ADR-12')].join('\n'))
  silent(ask('and why did ADR-12 say so'))
})

test('a long prompt that holds an identifier is met with silence', () => {
  const root = tree(acme({ 'decisions/0007-one-gateway.md': ONE_GATEWAY }))

  silent(fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: `${PASTED} as ADR-12 says` }))
})

test('a short prompt whose counted words are a node\'s name is given that node, and a long one is met with silence', () => {
  const root = tree(acme())

  const result = fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'what is the gateway?' })

  assert.equal(context(result), ['Context for "what is the gateway?":', `- ${join(root, 'concepts/gateway.md')} (${Buffer.byteLength(ACME_FILES['concepts/gateway.md'])} B) named: gateway`].join('\n'))
  silent(fire('user-prompt-submit', { session_id: 's2', cwd: root, prompt: `${'x1 '.repeat(250)}gateway` }))
})

test('a node given by its identifier is not given again by its name in the same session', () => {
  const root = tree(makeTree({ 'estate.json': { contextCentral: 1, name: 'acme' }, 'CLAUDE.md': '# Acme\n', 'decisions/0007-doorway.md': '---\nid: ADR-12\n---\n# 0007: Doorway\n' }))
  const dir = stateDir()
  const ask = (prompt: string) => fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt }, { CONTEXT_CENTRAL_STATE_DIR: dir })

  assert.match(context(ask('ADR-12')), /known as: ADR-12$/)
  silent(ask('doorway'))
})

const TERMS = '# Glossary\n\n**Rate limit**: The most calls a client may make in a minute.\n'

test('a short prompt that is a term of the glossary is given the glossary, once in a session, where the command line gives the item', () => {
  const root = tree(acme({ 'glossary.md': TERMS }))
  const dir = stateDir()
  const ask = (prompt: string) => fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt }, { CONTEXT_CENTRAL_STATE_DIR: dir })

  assert.equal(context(ask('what is the rate limit?')), ['Context for "what is the rate limit?":', `- ${join(root, 'glossary.md')} (${Buffer.byteLength(TERMS)} B) defines: Rate limit, line 3`].join('\n'))
  silent(ask('rate limit'))
  silent(fire('user-prompt-submit', { session_id: 's2', cwd: root, prompt: `${'x1 '.repeat(250)}rate limit` }))
})

const DAY_MS = 24 * 60 * 60 * 1000
const TEST_CLOCK = Date.parse('2026-01-15T12:00:00Z')

function aged(path: string, days: number) {
  const then = new Date(TEST_CLOCK - days * DAY_MS)
  utimesSync(path, then, then)
}

function recordsAged(days: { [name: string]: number }) {
  const temp = tree(makeTree({}))
  const dir = join(temp, 'context-central')
  mkdirSync(dir)
  for (const [name, age] of Object.entries(days)) {
    writeFileSync(join(dir, name), '{"delivered":[],"active":null}\n')
    aged(join(dir, name), age)
  }
  return { dir, env: { TMPDIR: temp, TEMP: temp, TMP: temp } }
}

test('saving a record removes the records no session has used for fourteen days, and nothing else', () => {
  const root = tree(acme())
  const { dir, env } = recordsAged({ 'old.json': 15, 'recent.json': 13, 'young.json': 1, 'kept.txt': 30 })

  hook('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'PROJ-12' }, { env })

  assert.deepEqual(readdirSync(dir).sort(), ['kept.txt', 'recent.json', 's1.json', 'young.json'])
})

test("a prompt keeps its session's record from the sweep, though it gets no answer", () => {
  const root = tree(acme())
  const { dir, env } = recordsAged({ 's1.json': 15, 's2.json': 15 })

  silent(hook('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'what time is it' }, { env }))
  hook('user-prompt-submit', { session_id: 's3', cwd: root, prompt: 'PROJ-12' }, { env })

  assert.deepEqual(readdirSync(dir).sort(), ['s1.json', 's3.json'])
})

test('a folder of records named by CONTEXT_CENTRAL_STATE_DIR is never swept', () => {
  const root = tree(acme())
  const { dir } = recordsAged({ 'old.json': 15 })

  hook('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'PROJ-12' }, { env: { CONTEXT_CENTRAL_STATE_DIR: dir } })

  assert.deepEqual(readdirSync(dir).sort(), ['old.json', 's1.json'])
})

test('a sweep that cannot remove something still lets the hook answer, and says nothing', () => {
  const root = tree(acme())
  const { dir, env } = recordsAged({})
  mkdirSync(join(dir, 'stuck.json'))
  aged(join(dir, 'stuck.json'), 15)

  const result = hook('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'PROJ-12' }, { env })

  assert.deepEqual([result.code, result.stderr, context(result)], [0, '', acmePointers(root)])
})

test('one record that cannot be removed does not keep the sweep from the records after it', () => {
  const root = tree(acme())
  const { dir, env } = recordsAged({ 'old.json': 15 })
  mkdirSync(join(dir, '0-stuck.json'))
  aged(join(dir, '0-stuck.json'), 15)

  hook('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'PROJ-12' }, { env })

  assert.deepEqual(readdirSync(dir).sort(), ['0-stuck.json', 's1.json'])
})

const SHARED = {
  'estate.json': { contextCentral: 1, name: 'acme' },
  'CLAUDE.md': '# Acme\n',
  'concepts/doorway.md': '---\naliases: front-gate\n---\n# Doorway\n',
  'docs/porch.md': '---\naliases: front-gate\n---\n# Porch\n',
}
const given = (result: Result) => context(result).split('\n').slice(1).map(line => line.split(' ')[1])

test('a node given among others that share its identifier is not given again by its name, and the other way round', () => {
  const root = tree(makeTree(SHARED))
  const asked = (session: string, dir: string) => (prompt: string) => fire('user-prompt-submit', { session_id: session, cwd: root, prompt }, { CONTEXT_CENTRAL_STATE_DIR: dir })
  const first = asked('s1', stateDir())
  const second = asked('s2', stateDir())

  assert.deepEqual(given(first('front-gate')), [join(root, 'concepts/doorway.md'), join(root, 'docs/porch.md')])
  silent(first('doorway'))
  assert.deepEqual(given(second('porch')), [join(root, 'docs/porch.md')])
  assert.deepEqual(given(second('front-gate')), [join(root, 'concepts/doorway.md')])
  silent(second('front-gate'))
})
