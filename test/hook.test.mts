import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { ACME_FILES, ACME_SHOT, REPO, acme, acmeIndex, acmePointers, disposable, hook, makeTree, run } from './helpers.mts'

const tree = disposable()

const STATE = 'work/PROJ-12/STATE.md'
const stateDir = () => tree(makeTree({}))
const fire = (event, input, env = {}) => hook(event, input, { env: { CONTEXT_CENTRAL_STATE_DIR: stateDir(), ...env } })
const context = result => JSON.parse(result.stdout).hookSpecificOutput.additionalContext
const silent = result => assert.deepEqual(result, { code: 0, stdout: '', stderr: '' })

test('a new session is given the index with absolute paths', () => {
  const root = tree(acme())

  const result = fire('session-start', { session_id: 's1', cwd: root, hook_event_name: 'SessionStart', source: 'startup' })

  assert.equal(result.code, 0)
  assert.equal(result.stderr, '')
  assert.deepEqual(JSON.parse(result.stdout), { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: acmeIndex(root) } })
})

test('a forked session is given the index', () => {
  const root = tree(acme())

  assert.equal(context(fire('session-start', { session_id: 's1', cwd: root, source: 'fork' })), acmeIndex(root))
})

test('a session in a registered repo is covered', () => {
  const root = tree(acme())

  assert.equal(context(fire('session-start', { cwd: join(root, 'web'), source: 'startup' })), acmeIndex(root))
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
  assert.deepEqual(JSON.parse(started.stdout), { systemMessage: message })
  assert.deepEqual(JSON.parse(prompted.stdout), { systemMessage: message })
})

test('a config that is not JSON is reported the same way', () => {
  const root = tree(acme())
  writeFileSync(join(root, 'estate.json'), '{ "contextCentral": 1, "name": ')

  const result = fire('session-start', { cwd: root, source: 'startup' })

  assert.equal(result.code, 0)
  assert.equal(result.stderr, '')
  assert.deepEqual(Object.keys(JSON.parse(result.stdout)), ['systemMessage'])
  assert.match(JSON.parse(result.stdout).systemMessage, /^context-central: .*estate\.json: not valid JSON/)
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
  assert.deepEqual(JSON.parse(result.stdout), { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: acmePointers(root) } })
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

  assert.deepEqual(JSON.parse(readFileSync(join(dir, 's1.json'), 'utf8')), { delivered: ['item:PROJ-12', 'repo:web'], active: 'PROJ-12' })
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

  const output = JSON.parse(fire('session-start', { ...RESUMED, cwd: root }).stdout)

  assert.equal(output.systemMessage, NOTICE)
  assert.equal(output.hookSpecificOutput.additionalContext, acmeIndex(root))
})

test('a small session, or one whose cache is still warm, resumes without the notice', () => {
  const root = tree(acme())

  const small = JSON.parse(fire('session-start', { ...RESUMED, cwd: root, context_tokens: 99999 }).stdout)
  const warm = JSON.parse(fire('session-start', { ...RESUMED, cwd: root, prompt_cache_likely_expired: false }).stdout)

  assert.equal('systemMessage' in small, false)
  assert.equal('systemMessage' in warm, false)
})

test('the estate sets the size that earns the notice, and zero turns it off', () => {
  const lower = tree(acme({}, { budgets: { resumeNoticeTokens: 50000 } }))
  const off = tree(acme({}, { budgets: { resumeNoticeTokens: 0 } }))

  const noticed = JSON.parse(fire('session-start', { ...RESUMED, cwd: lower, context_tokens: 60000 }).stdout)
  const quiet = JSON.parse(fire('session-start', { ...RESUMED, cwd: off }).stdout)

  assert.match(noticed.systemMessage, /about 60k tokens uncached/)
  assert.equal('systemMessage' in quiet, false)
})

test('the plugin wires both events to the hook command without a shell', () => {
  const { hooks } = JSON.parse(readFileSync(join(REPO, 'hooks', 'hooks.json'), 'utf8'))

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
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 's1.json'), 'utf8')), { delivered: ['item:PROJ-12'], active: 'PROJ-12' })
})

test('a long prompt that holds an item title and no key or name is met with silence', () => {
  const root = tree(acme())

  silent(fire('user-prompt-submit', { session_id: 's1', cwd: root, prompt: `${'x1 '.repeat(250)}rate limit the gateway` }))
})

test('a short prompt that only the words of an item name and title would answer is met with silence', () => {
  const root = tree(acme())
  const dir = stateDir()

  assert.equal(JSON.parse(run(['resolve', 'rate', 'gateway', '--json'], { cwd: root }).stdout).key, 'item:PROJ-12')
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

  assert.deepEqual(JSON.parse(result.stdout), { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: acmeIndex(root) } })
})
