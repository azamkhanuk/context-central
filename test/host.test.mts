import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { ACME_FILES, acme, acmeIndex, disposable, hook, makeTree } from './helpers.mts'
import type { Env, Result } from './helpers.mts'

const tree = disposable()

const HUB = '# Acme estate\n\nA task about a screen goes to `web`.\n'
const COPILOT = { COPILOT_CLI: '1' }
const GIT_FOLDER = { '.git/HEAD': 'ref: refs/heads/main\n' }

const start = (cwd: string, env: Env = {}) => hook('session-start', { session_id: 's1', cwd, source: 'new' }, { env: { CONTEXT_CENTRAL_STATE_DIR: tree(makeTree({})), ...env } })
const context = (result: Result) => (JSON.parse(result.stdout) as { additionalContext: string }).additionalContext
const withLocalHub = (text: string) => tree(acme({ 'CLAUDE.local.md': text }, { hub: 'CLAUDE.local.md' }))
const indexNaming = (root: string, hub: string) => acmeIndex(root).replace(join(root, 'CLAUDE.md'), join(root, hub))
const hubGiven = (root: string, hub: string, text: string) => `\n\nHub (${join(root, hub)}), which this host does not load by itself:\n${text.trimEnd()}`

test("a session that starts on a host that does not load the hub is given the hub's text after the index", () => {
  const root = withLocalHub(HUB)

  assert.equal(context(start(root, COPILOT)), indexNaming(root, 'CLAUDE.local.md') + hubGiven(root, 'CLAUDE.local.md', HUB))
})

test('on a host that loads the hub by itself the index is all a start is given, and that host is the one taken where both leave their mark', () => {
  const root = withLocalHub(HUB)

  assert.equal(context(start(root)), indexNaming(root, 'CLAUDE.local.md'))
  assert.equal(context(start(root, { CLAUDECODE: '1' })), indexNaming(root, 'CLAUDE.local.md'))
  assert.equal(context(start(root, { ...COPILOT, CLAUDECODE: '1' })), indexNaming(root, 'CLAUDE.local.md'))
})

test('a hub the host loads from the folder the session starts in is not given a second time', () => {
  const root = tree(acme())

  assert.equal(context(start(root, COPILOT)), acmeIndex(root))
})

test('a hub the host loads from the root of the repository the session starts below is not given a second time', () => {
  const root = tree(acme(GIT_FOLDER))

  assert.equal(context(start(join(root, 'web', 'src'), COPILOT)).includes('\n\nHub ('), false)
})

test('a hub above the folder a session starts in, with no repository root at the hub, is given though the host loads a file of that name', () => {
  const root = tree(acme({ 'web/.git/HEAD': GIT_FOLDER['.git/HEAD'] }))

  const text = context(start(join(root, 'web'), COPILOT))

  assert.equal(text.slice(text.indexOf('\n\nHub (')), hubGiven(root, 'CLAUDE.md', ACME_FILES['CLAUDE.md']))
})

test("the hub's text is cut where the index and the hub together pass the hook's limit", () => {
  const root = withLocalHub(`# Acme estate\n\n${'A line of routing.\n'.repeat(1000)}`)

  const text = context(start(root, COPILOT))

  assert.ok(text.startsWith(`${indexNaming(root, 'CLAUDE.local.md')}\n\nHub (`))
  assert.ok(text.length <= 9500)
  assert.ok(text.length > 9400)
  assert.ok(text.endsWith('A line of routing.\n[cut here; the file holds the rest]'))
})

test('a hub that is missing, empty or a folder adds nothing to the index', () => {
  const missing = tree(acme({}, { hub: 'CLAUDE.local.md' }))
  const empty = withLocalHub('')
  const blank = withLocalHub('\n\n')
  const folder = tree(acme({ 'CLAUDE.local.md/readme.md': '# not a hub\n' }, { hub: 'CLAUDE.local.md' }))

  for (const root of [empty, blank, folder]) assert.equal(context(start(root, COPILOT)), indexNaming(root, 'CLAUDE.local.md'))
  assert.equal(context(start(missing, COPILOT)), indexNaming(missing, 'CLAUDE.local.md').replace('CLAUDE.local.md\n', 'CLAUDE.local.md (missing)\n'))
})

test('a prompt on a host that does not load the hub is given its pointers and no hub', () => {
  const root = withLocalHub(HUB)

  const result = hook('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'pick up PROJ-12 where we left it' }, { env: { CONTEXT_CENTRAL_STATE_DIR: tree(makeTree({})), ...COPILOT } })

  assert.equal(context(result).includes('Hub ('), false)
  assert.equal(context(result).split('\n')[0], 'Context for work item PROJ-12:')
})
