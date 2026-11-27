import assert from 'node:assert/strict'
import { symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { ACME_CONFIG, ACME_FILES, acme, acmeIndex, disposable, hook, makeTree, notOnWindows, solo, spawned, workTree } from './helpers.mts'
import type { Env, Result } from './helpers.mts'

const tree = disposable()

const HUB = '# Acme estate\n\nA task about a screen goes to `web`.\n'
const COPILOT = { COPILOT_PLUGIN_ROOT: '/plugins/context-central' }
const GIT_FOLDER = { '.git/HEAD': 'ref: refs/heads/main\n' }
const LINKS = notOnWindows('making a link needs a right that a Windows account may not have')

const start = (cwd: string, env: Env = {}) => hook('session-start', { session_id: 's1', cwd, source: 'new' }, { env: { CONTEXT_CENTRAL_STATE_DIR: tree(makeTree({})), ...env }, timeout: 20000 })
const context = (result: Result) => (JSON.parse(result.stdout) as { additionalContext: string }).additionalContext
const withLocalHub = (text: string) => tree(acme({ 'CLAUDE.local.md': text }, { hub: 'CLAUDE.local.md' }))
const indexNaming = (root: string, hub: string) => acmeIndex(root).replace(join(root, 'CLAUDE.md'), join(root, hub))
const hubGiven = (root: string, hub: string, text: string) => `\n\nHub (${join(root, hub)}), which this host does not load by itself:\n${text.trimEnd()}`

test("a session that starts on a host that does not load the hub is given the hub's text after the index", () => {
  const root = withLocalHub(HUB)

  assert.equal(context(start(root, COPILOT)), indexNaming(root, 'CLAUDE.local.md') + hubGiven(root, 'CLAUDE.local.md', HUB))
})

test("a hook is taken to run under Copilot by the folder Copilot names to a plugin's hooks, and not by a mark of either host that a shell may have handed down", () => {
  const root = withLocalHub(HUB)

  assert.equal(context(start(root)), indexNaming(root, 'CLAUDE.local.md'))
  assert.equal(context(start(root, { CLAUDECODE: '1' })), indexNaming(root, 'CLAUDE.local.md'))
  assert.equal(context(start(root, { COPILOT_CLI: '1' })), indexNaming(root, 'CLAUDE.local.md'))
  assert.equal(context(start(root, { ...COPILOT, CLAUDECODE: '1' })), indexNaming(root, 'CLAUDE.local.md') + hubGiven(root, 'CLAUDE.local.md', HUB))
})

test('a hub the host loads from the folder the session starts in is not given a second time', () => {
  const root = tree(acme())

  assert.equal(context(start(root, COPILOT)), acmeIndex(root))
})

for (const hub of ['AGENTS.md', 'GEMINI.md', '.claude/CLAUDE.md', '.claude/rules/estate.md']) {
  test(`a hub named ${hub}, which the host loads from the folder a session starts in, is not given a second time`, () => {
    const root = tree(acme({ [hub]: HUB }, { hub }))

    assert.equal(context(start(root, COPILOT)).includes('\n\nHub ('), false)
  })
}

test('a hub written with a leading dot and slash is the same file the host loads, and is not given a second time', () => {
  const root = tree(acme({}, { hub: './CLAUDE.md' }))

  assert.equal(context(start(root, COPILOT)).includes('\n\nHub ('), false)
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

test('in a work tree that holds its own copy of a hub the host loads, the hub is not given a second time', () => {
  const made = solo()
  tree(made.base)
  const inTree = workTree(made, join(made.base, 'tree'))

  const text = context(start(inTree, { ...made.env, ...COPILOT }))

  assert.equal(text.includes('Context map'), true)
  assert.equal(text.includes('\n\nHub ('), false)
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

test("a hub the settings place outside the estate is named and never read into the session's context", () => {
  const estateFiles = { ...ACME_FILES, 'estate.json': { ...ACME_CONFIG, hub: '../outside.md' } }
  const base = tree(makeTree({ 'outside.md': 'words kept outside the estate\n', ...Object.fromEntries(Object.entries(estateFiles).map(([path, content]) => [`estate/${path}`, content])) }))

  const text = context(start(join(base, 'estate'), COPILOT))

  assert.equal(text.includes('words kept outside the estate'), false)
  assert.equal(text.includes('\n\nHub ('), false)
})

test("a hub that is a link to a file outside the estate is named and never read into the session's context", LINKS, () => {
  const outside = tree(makeTree({ 'private.md': 'words kept outside the estate\n' }))
  const root = tree(acme({}, { hub: 'CLAUDE.local.md' }))
  symlinkSync(join(outside, 'private.md'), join(root, 'CLAUDE.local.md'))

  const text = context(start(root, COPILOT))

  assert.equal(text.includes('words kept outside the estate'), false)
  assert.equal(text.includes('\n\nHub ('), false)
})

test('a hub that is a link to a file inside the estate is read through the link', LINKS, () => {
  const root = tree(acme({ 'docs/hub.md': HUB }, { hub: 'CLAUDE.local.md' }))
  symlinkSync(join(root, 'docs', 'hub.md'), join(root, 'CLAUDE.local.md'))

  assert.equal(context(start(root, COPILOT)), indexNaming(root, 'CLAUDE.local.md') + hubGiven(root, 'CLAUDE.local.md', HUB))
})

test('a hub that is a named pipe is passed over without waiting on it, and the index is still given', notOnWindows('Windows has no mkfifo'), () => {
  const root = tree(acme({}, { hub: 'CLAUDE.local.md' }))
  spawned('mkfifo', [join(root, 'CLAUDE.local.md')])

  const result = start(root, COPILOT)

  assert.equal(result.code, 0)
  assert.equal(context(result).includes('\n\nHub ('), false)
  assert.equal(context(result).split('\n')[0], `Context map "Acme estate": ${root}`)
})

test('a prompt on a host that does not load the hub is given its pointers and no hub', () => {
  const root = withLocalHub(HUB)

  const result = hook('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'pick up PROJ-12 where we left it' }, { env: { CONTEXT_CENTRAL_STATE_DIR: tree(makeTree({})), ...COPILOT } })

  assert.equal(context(result).includes('Hub ('), false)
  assert.equal(context(result).split('\n')[0], 'Context for work item PROJ-12:')
})
