import assert from 'node:assert/strict'
import { mkdirSync, symlinkSync, truncateSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { ACME_CONFIG, ACME_FILES, SOLO_CONFIG, SOLO_FILES, acme, acmeIndex, checkout, disposable, hook, makeTree, notOnWindows, solo, spawned, workTree } from './helpers.mts'
import type { Env, Result } from './helpers.mts'

const tree = disposable()

const HUB = '# Acme estate\n\nA task about a screen goes to `web`.\n'
const COPILOT = { COPILOT_PLUGIN_ROOT: '/plugins/context-central' }
const GIT_FOLDER = { '.git/HEAD': 'ref: refs/heads/main\n' }
const LINKS = notOnWindows('making a link needs a right that a Windows account may not have')
const STATE = 'work/PROJ-12/STATE.md'

const start = (cwd: string, env: Env = {}) => hook('session-start', { session_id: 's1', cwd, source: 'new' }, { env: { CONTEXT_CENTRAL_STATE_DIR: tree(makeTree({})), ...env }, timeout: 20000 })
const context = (result: Result) => {
  const answer = JSON.parse(result.stdout) as { additionalContext?: string, hookSpecificOutput?: { additionalContext: string } }
  return answer.additionalContext ?? answer.hookSpecificOutput?.additionalContext ?? ''
}
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

for (const hub of ['AGENTS.md', 'GEMINI.md', '.claude/CLAUDE.md', '.claude/rules/estate.md', '.github/copilot-instructions.md', '.github/instructions/estate.instructions.md', '.github/instructions/deep/estate.instructions.md']) {
  test(`a hub named ${hub}, which the host loads from the folder a session starts in, is not given a second time`, () => {
    const root = tree(acme({ [hub]: HUB }, { hub }))

    assert.equal(context(start(root, COPILOT)).includes('\n\nHub ('), false)
  })
}

test("a hub in the folder Copilot keeps its instructions in, of a name Copilot does not load from there, is given", () => {
  for (const hub of ['.github/instructions/estate.md', '.github/hub.md']) {
    const root = tree(acme({ [hub]: HUB }, { hub }))

    assert.equal(context(start(root, COPILOT)), indexNaming(root, hub) + hubGiven(root, hub, HUB), hub)
  }
})

test('a hub kept as an instructions file that names the files it applies to is given, since Copilot loads such a file only once one of them is worked on, and one that applies to every file is not', () => {
  const scoped = (applyTo: string) => {
    const hub = '.github/instructions/estate.instructions.md'
    const root = tree(acme({ [hub]: `---\napplyTo: ${applyTo}\n---\n${HUB}` }, { hub }))
    return context(start(root, COPILOT)).includes('\n\nHub (')
  }

  assert.equal(scoped('"**/*.ts"'), true)
  assert.equal(scoped('"**"'), false)
  assert.equal(scoped("'**/*'"), false)
})

test('a hub in a folder that the person has named to Copilot as one more to load instructions from is not given a second time, where it is of a name Copilot loads from such a folder', () => {
  const named = (hub: string) => {
    const root = tree(acme({ [`shared/${hub}`]: HUB }, { hub: `shared/${hub}` }))
    return context(start(root, { ...COPILOT, COPILOT_CUSTOM_INSTRUCTIONS_DIRS: `/nowhere, ${join(root, 'shared')}` })).includes('\n\nHub (')
  }

  assert.equal(named('estate.instructions.md'), false)
  assert.equal(named('.github/instructions/estate.instructions.md'), false)
  assert.equal(named('AGENTS.md'), true)
  assert.equal(named('CLAUDE.md'), true)
})

test('a folder added to Copilot by a relative name is counted from the folder the session starts in, and not from the one the hook was started in', () => {
  const hub = 'shared/estate.instructions.md'
  const root = tree(acme({ [hub]: HUB }, { hub }))
  const elsewhere = tree(makeTree({ 'notes.txt': 'x\n' }))
  const given = (startedIn: string) => context(hook('session-start', { sessionId: 's1', cwd: root, source: 'new' }, { cwd: startedIn, env: { ...COPILOT, COPILOT_CUSTOM_INSTRUCTIONS_DIRS: 'shared', CONTEXT_CENTRAL_STATE_DIR: tree(makeTree({})) }, timeout: 20000 })).includes('\n\nHub (')

  assert.equal(given(elsewhere), false)
  assert.equal(given(root), false)
})

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

test('in a work tree, a hub in a folder between the root of the work tree and the folder a session starts in is not given a second time, since the work tree holds its own copy there', () => {
  const made = checkout({ ...SOLO_FILES, '.context-central/estate.json': { ...SOLO_CONFIG, hub: 'web/AGENTS.md' }, 'web/AGENTS.md': HUB, 'web/src/app.js': 'export {}\n' })
  tree(made.base)
  const inTree = workTree(made, join(made.base, 'tree'))

  const text = context(start(join(inTree, 'web', 'src'), { ...made.env, ...COPILOT }))

  assert.equal(text.includes('Context map'), true)
  assert.equal(text.includes('\n\nHub ('), false)
})

test('in a work tree that holds no copy of a hub the host loads by its name, the hub is given from the main checkout', () => {
  const made = checkout({ ...SOLO_FILES, '.gitignore': '.context-central/\nCLAUDE.md\n' })
  tree(made.base)
  const inTree = workTree(made, join(made.base, 'tree'))

  const text = context(start(inTree, { ...made.env, ...COPILOT }))

  assert.equal(text.slice(text.indexOf('\n\nHub (')), hubGiven(made.main, 'CLAUDE.md', SOLO_FILES['CLAUDE.md']))
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

test('a hub in a folder below the estate root, which the host loads where the session starts in that folder, is not given a second time', () => {
  const root = tree(acme({ 'web/AGENTS.md': HUB }, { hub: 'web/AGENTS.md' }))

  assert.equal(context(start(join(root, 'web'), COPILOT)).includes('\n\nHub ('), false)
  assert.equal(context(start(root, COPILOT)).endsWith(hubGiven(root, join('web', 'AGENTS.md'), HUB)), true)
})

test('a hub in a folder between the root of the repository and the folder a session starts in is not given a second time, where it is a file Copilot loads by its name from such a folder, and is given where it is a rule, which Copilot loads from the two ends alone', () => {
  const between = (hub: string) => {
    const root = tree(acme({ ...GIT_FOLDER, [`web/${hub}`]: HUB, 'web/src/app.js': 'export {}\n' }, { hub: `web/${hub}` }))
    return context(start(join(root, 'web', 'src'), COPILOT)).includes('\n\nHub (')
  }

  assert.equal(between('AGENTS.md'), false)
  assert.equal(between('.github/copilot-instructions.md'), false)
  assert.equal(between('.claude/rules/estate.md'), true)
})

test('a hub of a name the host loads that is a link to another file of the estate is loaded by the host, and not given a second time', LINKS, () => {
  const root = tree(acme({ 'docs/hub.md': HUB }, { hub: 'AGENTS.md' }))
  symlinkSync(join(root, 'docs', 'hub.md'), join(root, 'AGENTS.md'))

  assert.equal(context(start(root, COPILOT)).includes('\n\nHub ('), false)
})

for (const [hub, link, folder] of [['.claude/CLAUDE.md', '.claude', 'conf'], ['.claude/rules/estate.md', '.claude/rules', 'conf']]) {
  test(`a hub named ${hub}, which the host loads by that name, is not given a second time where the folder ${link} is a link to another folder of the estate`, LINKS, () => {
    const root = tree(acme({ [`${folder}/${hub.split('/').at(-1)}`]: HUB }, { hub }))
    mkdirSync(dirname(join(root, link)), { recursive: true })
    symlinkSync(join(root, folder), join(root, link))

    assert.equal(context(start(root, COPILOT)), indexNaming(root, hub))
  })
}

test('a hub of a name the host does not load that is a link to a file the host loads is loaded by the host, and not given a second time', LINKS, () => {
  const root = tree(acme({ 'AGENTS.md': HUB }, { hub: 'CLAUDE.local.md' }))
  symlinkSync(join(root, 'AGENTS.md'), join(root, 'CLAUDE.local.md'))

  assert.equal(context(start(root, COPILOT)), indexNaming(root, 'CLAUDE.local.md'))
})

test('a hub of an estate that is reached through a link is given, since the estate holds it once the link is followed', LINKS, () => {
  const root = withLocalHub(HUB)
  const linked = join(tree(makeTree({})), 'estate')
  symlinkSync(root, linked)

  const text = context(start(linked, COPILOT))

  assert.equal(text.slice(text.indexOf('\n\nHub (')).split('\n').slice(3).join('\n'), HUB.trimEnd())
})

test('a hub too large to be read whole is still given as far as the limit shows', notOnWindows('a file of that size is only quick to make where the disk leaves its empty part unwritten'), () => {
  const root = withLocalHub(`# Acme estate\n\n${'A line of routing.\n'.repeat(1000)}`)
  truncateSync(join(root, 'CLAUDE.local.md'), 3 * 1024 ** 3)

  const text = context(start(root, COPILOT))

  assert.ok(text.startsWith(`${indexNaming(root, 'CLAUDE.local.md')}\n\nHub (`))
  assert.ok(text.endsWith('A line of routing.\n[cut here; the file holds the rest]'))
})

test('on Copilot a session is placed by the folder it started in, so a map below the root of its repository is found though Copilot names that root as the project folder', () => {
  const below = Object.fromEntries(Object.entries({ ...ACME_FILES, 'estate.json': ACME_CONFIG }).map(([path, content]) => [`pkg/a/${path}`, content]))
  const repository = tree(makeTree({ ...GIT_FOLDER, ...below }))
  const root = join(repository, 'pkg', 'a')

  assert.equal(context(start(root, { ...COPILOT, CLAUDE_PROJECT_DIR: repository })), acmeIndex(root))
})

test('on Copilot a session that starts in a folder the map leaves alone is told nothing, though the root of its repository is covered', () => {
  const root = tree(acme(GIT_FOLDER))

  const result = start(join(root, 'scratch'), { ...COPILOT, CLAUDE_PROJECT_DIR: root })

  assert.deepEqual(result, { code: 0, stdout: '', stderr: '' })
})

test("a resumed session on a host that does not load the hub is given the state of its active item before the hub's text", () => {
  const root = withLocalHub(HUB)
  const env = { CONTEXT_CENTRAL_STATE_DIR: tree(makeTree({})), ...COPILOT }
  hook('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'PROJ-12' }, { env })

  const resumed = hook('session-start', { session_id: 's1', cwd: root, source: 'resume' }, { env, timeout: 20000 })

  assert.equal(context(resumed), `${indexNaming(root, 'CLAUDE.local.md')}\n\nState of PROJ-12 (${join(root, STATE)}):\n${ACME_FILES[STATE].trimEnd()}${hubGiven(root, 'CLAUDE.local.md', HUB)}`)
})

test('a prompt on a host that does not load the hub is given its pointers and no hub', () => {
  const root = withLocalHub(HUB)

  const result = hook('user-prompt-submit', { session_id: 's1', cwd: root, prompt: 'pick up PROJ-12 where we left it' }, { env: { CONTEXT_CENTRAL_STATE_DIR: tree(makeTree({})), ...COPILOT } })

  assert.equal(context(result).includes('Hub ('), false)
  assert.equal(context(result).split('\n')[0], 'Context for work item PROJ-12:')
})
