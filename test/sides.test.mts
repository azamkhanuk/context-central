import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { REPO, acme, acmeIndex, acmePointers, disposable, hook, makeTree } from './helpers.mts'
import type { Env } from './helpers.mts'

const tree = disposable()

const COPILOT = { COPILOT_PLUGIN_ROOT: '/plugins/context-central' }
const COPILOTS_OWN = 'com.github.copilot'
const AGENT_PLUGINS = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json'
const MAY_HOLD = ['$schema', 'name', 'version', 'description', 'author', 'homepage', 'repository', 'license', 'keywords', 'extensions']

const read = (...path: string[]) => JSON.parse(readFileSync(join(REPO, ...path), 'utf8')) as Record<string, unknown>
const fire = (event: string, input: unknown, env: Env = {}) => hook(event, input, { env: { CONTEXT_CENTRAL_STATE_DIR: tree(makeTree({})), ...env } })
const answer = (stdout: string) => JSON.parse(stdout) as unknown

test("Claude Code's hooks file starts each hook as a program with its arguments and no shell, session start with a limit of 15 seconds and a prompt with 10", () => {
  assert.deepEqual(read('hooks', 'hooks.json'), {
    hooks: {
      SessionStart: [{ matcher: 'startup|resume|clear|compact|fork', hooks: [{ type: 'command', command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/bin/context-central', 'hook', 'session-start'], timeout: 15 }] }],
      UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/bin/context-central', 'hook', 'user-prompt-submit'], timeout: 10 }] }],
    },
  })
})

test("Copilot's hooks file is in Copilot's own form, under its own event names, with a line for bash and one for PowerShell that start node and read nothing themselves", () => {
  assert.deepEqual(read(COPILOTS_OWN, 'hooks', 'hooks.json'), {
    version: 1,
    hooks: {
      sessionStart: [{
        type: 'command',
        bash: 'node "$COPILOT_PLUGIN_ROOT/bin/context-central" hook session-start',
        powershell: "node (Join-Path $env:COPILOT_PLUGIN_ROOT 'bin/context-central') hook session-start; exit $LASTEXITCODE",
        timeoutSec: 15,
      }],
      userPromptSubmitted: [{
        type: 'command',
        bash: 'node "$COPILOT_PLUGIN_ROOT/bin/context-central" hook user-prompt-submit',
        powershell: "node (Join-Path $env:COPILOT_PLUGIN_ROOT 'bin/context-central') hook user-prompt-submit; exit $LASTEXITCODE",
        timeoutSec: 10,
      }],
    },
  })
})

test("Copilot's manifest stands at the plugin's root in the Agent Plugins form, and holds no field that form does not take", () => {
  const copilots = read('plugin.json')

  assert.equal(copilots.$schema, AGENT_PLUGINS)
  assert.deepEqual(Object.keys(copilots).filter(key => !MAY_HOLD.includes(key)), [])
})

test('the two manifests agree on the name, the version, the author, the licence, the repository and the keywords', () => {
  const claudes = read('.claude-plugin', 'plugin.json')
  const copilots = read('plugin.json')

  for (const field of ['name', 'version', 'author', 'license', 'repository', 'keywords']) assert.deepEqual(copilots[field], claudes[field], field)
})

test("the description in Copilot's manifest is one plain sentence that names the Copilot command line", () => {
  const { description } = read('plugin.json') as { description: string }

  assert.match(description, /^[A-Z][^.!?—]*\.$/)
  assert.match(description, /Copilot command line/)
  assert.doesNotMatch(description, /Claude/)
})

test('on Claude Code a hook answers under the name of its event, and nowhere else', () => {
  const root = tree(acme())

  const started = fire('session-start', { session_id: 's1', cwd: root, hook_event_name: 'SessionStart', source: 'startup' })
  const prompted = fire('user-prompt-submit', { session_id: 's1', cwd: root, hook_event_name: 'UserPromptSubmit', prompt: 'pick up PROJ-12 where we left it' })

  assert.deepEqual(answer(started.stdout), { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: acmeIndex(root) } })
  assert.deepEqual(answer(prompted.stdout), { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: acmePointers(root) } })
})

test('on Copilot a hook answers at the top, and nowhere else', () => {
  const root = tree(acme())

  const started = fire('session-start', { sessionId: 's1', timestamp: 1795880885326, cwd: root, source: 'new', initialPrompt: 'pick up PROJ-12 where we left it' }, COPILOT)
  const prompted = fire('user-prompt-submit', { sessionId: 's1', timestamp: 1795880885332, cwd: root, prompt: 'pick up PROJ-12 where we left it' }, COPILOT)

  assert.deepEqual(answer(started.stdout), { additionalContext: acmeIndex(root) })
  assert.deepEqual(answer(prompted.stdout), { additionalContext: acmePointers(root) })
})

test("on Copilot a session is known by the id Copilot gives its hooks, so a prompt's pointers are given once in a session and again in another", () => {
  const root = tree(acme())
  const env = { ...COPILOT, CONTEXT_CENTRAL_STATE_DIR: tree(makeTree({})) }
  const prompt = (sessionId: string) => fire('user-prompt-submit', { sessionId, timestamp: 1795880885332, cwd: root, prompt: 'pick up PROJ-12 where we left it' }, env)

  const first = prompt('one')
  const again = prompt('one')
  const elsewhere = prompt('two')

  assert.deepEqual(answer(first.stdout), { additionalContext: acmePointers(root) })
  assert.deepEqual(again, { code: 0, stdout: '', stderr: '' })
  assert.deepEqual(answer(elsewhere.stdout), { additionalContext: acmePointers(root) })
})

test('on Copilot a prompt that was handed to an agent, which comes with that agent\'s id, is told nothing and uses up nothing of the session', () => {
  const root = tree(acme())
  const env = { ...COPILOT, CONTEXT_CENTRAL_STATE_DIR: tree(makeTree({})) }
  const handed = { sessionId: 'agent-1', timestamp: 1795880885508, cwd: root, prompt: 'read the notes of PROJ-12', agentId: 'agent-1', agentType: 'context-central:reader', parentAgentId: 'one' }

  const toAnAgent = fire('user-prompt-submit', handed, env)
  const byThePerson = fire('user-prompt-submit', { sessionId: 'agent-1', timestamp: 1795880885600, cwd: root, prompt: 'pick up PROJ-12 where we left it' }, env)

  assert.deepEqual(toAnAgent, { code: 0, stdout: '', stderr: '' })
  assert.deepEqual(answer(byThePerson.stdout), { additionalContext: acmePointers(root) })
})

const AGENTS = ['fetcher', 'reader', 'reviewer', 'sweeper', 'web-reader']
const THE_READERS_SHELL = [['Bash is for that', 'The shell is for that']]

function parted(text: string) {
  const [, head, brief] = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text) ?? []
  return { head: Object.fromEntries(head.split('\n').map(line => [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 1).trim()])), brief }
}

const claudes = (name: string) => parted(readFileSync(join(REPO, 'agents', `${name}.md`), 'utf8'))
const copilots = (name: string) => parted(readFileSync(join(REPO, COPILOTS_OWN, 'agents', `${name}.agent.md`), 'utf8'))

test('Copilot has a file of its own for each agent Claude Code has, named as GitHub asks an agent of a plugin to be named', () => {
  assert.deepEqual(readdirSync(join(REPO, COPILOTS_OWN, 'agents')).sort(), AGENTS.map(name => `${name}.agent.md`))
  assert.deepEqual(readdirSync(join(REPO, 'agents')).sort(), AGENTS.map(name => `${name}.md`))
})

test("each of Copilot's agents is given the brief Claude Code's is given, word for word, but for the reader's shell, which each host calls by its own name", () => {
  for (const name of AGENTS) {
    const expected = (name === 'reader' ? THE_READERS_SHELL : []).reduce((brief, [theirs, ours]) => brief.replace(theirs, ours), claudes(name).brief)

    assert.equal(copilots(name).brief, expected, name)
  }
  assert.ok(claudes('reader').brief.includes('Bash is for that'))
})

test("the head of each of Copilot's agents holds its name, Claude Code's description of it and the tools it may hold by Copilot's names for them, and no field that Copilot does not read", () => {
  const head = (name: string, tools?: string) => ({ name, description: claudes(name).head.description, ...(tools === undefined ? {} : { tools }) })

  assert.deepEqual(copilots('reader').head, head('reader', '["read", "search", "execute"]'))
  assert.deepEqual(copilots('reviewer').head, head('reviewer', '["read", "search", "execute"]'))
  assert.deepEqual(copilots('web-reader').head, head('web-reader', '["web"]'))
  assert.deepEqual(copilots('fetcher').head, head('fetcher'))
  assert.deepEqual(copilots('sweeper').head, head('sweeper'))
})
