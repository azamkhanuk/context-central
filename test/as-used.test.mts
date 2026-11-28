import assert from 'node:assert/strict'
import { readFileSync, symlinkSync } from 'node:fs'
import { delimiter, dirname, join } from 'node:path'
import { test } from 'node:test'
import { ACME_CONFIG, ACME_FILES, REPO, acme, acmeIndex, acmePointers, disposable, makeTree, notOnWindows, onlyOnWindows, spawned, writtenTo } from './helpers.mts'
import type { Result } from './helpers.mts'

const tree = disposable()

type HooksManifest = { hooks: Record<string, { hooks: { command: string, args: string[], bash: string, powershell: string }[] }[]> }

const { contextCentral, ...ACME_ANSWERS } = ACME_CONFIG
const PATH = [join(REPO, 'bin'), dirname(process.execPath), process.env.PATH].join(delimiter)

const bare = (root: string, line: string) => spawned('sh', ['-c', line], { cwd: root, env: { PATH } })

function freshMap() {
  const root = tree(makeTree({ 'answers.json': { layout: 'root', git: false, config: ACME_ANSWERS } }))
  const result = bare(root, 'context-central init --from answers.json')
  assert.equal(result.code, 0, result.stderr)
  return root
}

test('the name a shell finds is the bin script of this repository', notOnWindows('a file on Windows has no executable bit for a second file on the PATH to stand in for'), () => {
  const found = bare(REPO, 'command -v context-central')

  assert.deepEqual(found, { code: 0, stdout: `${join(REPO, 'bin', 'context-central')}\n`, stderr: '' })
})

test('a shell that calls the bare command makes a map', () => {
  const root = freshMap()

  const result = bare(root, 'context-central config --get title')

  assert.deepEqual(result, { code: 0, stdout: 'Acme estate\n', stderr: '' })
})

test('the bare command opens a work item and the resolver names it first', () => {
  const root = freshMap()

  const opened = bare(root, 'context-central work new PROJ-12 --title "Rate limit the gateway"')
  const resolved = bare(root, 'context-central resolve PROJ-12')

  assert.equal(opened.code, 0, opened.stderr)
  assert.equal(resolved.code, 0, resolved.stderr)
  assert.equal(resolved.stdout.split('\n')[0], 'Context for work item PROJ-12:')
})

test('the bare command finishes a work item and the list of work in flight is empty', () => {
  const root = freshMap()
  bare(root, 'context-central work new PROJ-12 --title "Rate limit the gateway"')

  const finished = bare(root, 'context-central work done PROJ-12')
  const listed = bare(root, 'context-central work list --json')

  assert.equal(finished.code, 0, finished.stderr)
  assert.deepEqual(listed, { code: 0, stdout: '[]\n', stderr: '' })
})

test('the bare command lints and graphs the map it made', () => {
  const root = freshMap()
  bare(root, 'context-central work new PROJ-12 --title "Rate limit the gateway"')
  bare(root, 'context-central work done PROJ-12')

  const linted = bare(root, 'context-central lint')
  const graphed = bare(root, 'context-central graph')

  assert.equal(linted.code, 0, linted.stderr + linted.stdout)
  assert.equal(graphed.code, 0, graphed.stderr + graphed.stdout)
})

function declared(event: string, input: unknown) {
  const { hooks } = JSON.parse(readFileSync(join(REPO, 'hooks', 'hooks.json'), 'utf8')) as HooksManifest
  const [{ command, args }] = hooks[event][0].hooks
  return spawned(
    command,
    args.map(arg => arg.replaceAll('${CLAUDE_PLUGIN_ROOT}', REPO)),
    { input: JSON.stringify(input), env: { PATH, CONTEXT_CENTRAL_STATE_DIR: tree(makeTree({})) } },
  )
}

const WINDOWS_POWERSHELL = join(process.env.SystemRoot ?? '', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
const POWERSHELLS = [['Windows PowerShell 5.1', WINDOWS_POWERSHELL], ['PowerShell 7', 'pwsh']]

const lineOf = (shell: 'bash' | 'powershell', event: string) => (JSON.parse(readFileSync(join(REPO, 'hooks', 'hooks.json'), 'utf8')) as HooksManifest).hooks[event][0].hooks[0][shell]
const answered = (result: Result) => ({ code: result.code, stderr: result.stderr, context: contextIn(result.stdout) })

function asBashLine(event: string, input: unknown, pluginRoot = REPO) {
  const env = { PATH: [dirname(process.execPath), process.env.PATH].join(delimiter), CLAUDE_PLUGIN_ROOT: pluginRoot, CONTEXT_CENTRAL_STATE_DIR: tree(makeTree({})) }
  return answered(spawned('bash', ['-c', lineOf('bash', event)], { input: JSON.stringify(input), timeout: 60000, env }))
}

// A host that is a Node program starts the line and writes the hook's input to it, which a run that hands the input over whole does not show.
async function asPowershellLine(program: string, event: string, input: unknown, pluginRoot = REPO) {
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([name]) => name.toUpperCase() !== 'PATH'))
  const env = () => ({ ...inherited, PATH: [dirname(process.execPath), process.env.PATH].join(delimiter), CLAUDE_PLUGIN_ROOT: pluginRoot, CONTEXT_CENTRAL_STATE_DIR: tree(makeTree({})) })
  const args = ['-NoProfile', '-NoLogo', '-Command', lineOf('powershell', event)]
  const written = answered(await writtenTo(program, args, { input: JSON.stringify(input), env: env() }))
  const handedOver = answered(spawned(program, args, { input: JSON.stringify(input), timeout: 60000, env: env() }))
  return { written, handedOver }
}

function contextIn(stdout: string) {
  try {
    return (JSON.parse(stdout) as { additionalContext: string }).additionalContext
  } catch {
    return `not JSON: ${stdout}`
  }
}

const BASH_LINE = notOnWindows('a host runs the bash line of a hook on macOS and Linux, and the powershell line on Windows')
const POWERSHELL_LINE = onlyOnWindows('a host runs the powershell line of a hook on Windows alone')

test('the bash line of each hook, run as a host that runs a shell line runs it, answers as the program with its arguments does', BASH_LINE, () => {
  const root = tree(acme())

  const started = asBashLine('SessionStart', { session_id: 's1', cwd: root, hook_event_name: 'SessionStart', source: 'new' })
  const prompted = asBashLine('UserPromptSubmit', { session_id: 's1', cwd: root, hook_event_name: 'UserPromptSubmit', prompt: 'pick up PROJ-12 where we left it' })

  assert.deepEqual(started, { code: 0, stderr: '', context: acmeIndex(root) })
  assert.deepEqual(prompted, { code: 0, stderr: '', context: acmePointers(root) })
})

test('the bash line of a hook finds the plugin in a folder whose name holds a space, an exclamation mark and a letter outside ASCII', BASH_LINE, () => {
  const root = tree(acme())
  const linked = join(tree(makeTree({})), 'plug in! é')
  symlinkSync(REPO, linked)

  const started = asBashLine('SessionStart', { session_id: 's1', cwd: root, source: 'new' }, linked)

  assert.deepEqual(started, { code: 0, stderr: '', context: acmeIndex(root) })
})

function estateUnder(folder: string) {
  const files = Object.fromEntries(Object.entries({ ...ACME_FILES, 'estate.json': ACME_CONFIG }).map(([path, content]) => [`${folder}/${path}`, content]))
  return join(tree(makeTree(files)), folder)
}

test("the bash line of each hook hands on an input that holds a letter outside ASCII as it was written, in a folder's name and in a prompt", BASH_LINE, () => {
  const root = estateUnder('Zoë')

  const started = asBashLine('SessionStart', { session_id: 's1', cwd: root, source: 'new' })
  const prompted = asBashLine('UserPromptSubmit', { session_id: 's1', cwd: root, prompt: 'pick up PROJ-12 for Zoë' })

  assert.deepEqual(started, { code: 0, stderr: '', context: acmeIndex(root) })
  assert.deepEqual(prompted, { code: 0, stderr: '', context: acmePointers(root) })
})

for (const [name, program] of POWERSHELLS) {
  test(`the powershell line of each hook, started by ${name} and written to as a host writes to it, answers as the program with its arguments does`, POWERSHELL_LINE, async () => {
    const root = tree(acme())

    const started = await asPowershellLine(program, 'SessionStart', { session_id: 's1', cwd: root, hook_event_name: 'SessionStart', source: 'new' })
    const prompted = await asPowershellLine(program, 'UserPromptSubmit', { session_id: 's1', cwd: root, hook_event_name: 'UserPromptSubmit', prompt: 'pick up PROJ-12 where we left it' })

    for (const way of [started.written, started.handedOver]) assert.deepEqual(way, { code: 0, stderr: '', context: acmeIndex(root) })
    for (const way of [prompted.written, prompted.handedOver]) assert.deepEqual(way, { code: 0, stderr: '', context: acmePointers(root) })
  })

  test(`the powershell line of each hook, started by ${name}, hands on an input that holds a letter outside ASCII as it was written, in a folder's name and in a prompt`, POWERSHELL_LINE, async () => {
    const root = estateUnder('Zoë')

    const started = await asPowershellLine(program, 'SessionStart', { session_id: 's1', cwd: root, source: 'new' })
    const prompted = await asPowershellLine(program, 'UserPromptSubmit', { session_id: 's1', cwd: root, prompt: 'pick up PROJ-12 for Zoë' })

    for (const way of [started.written, started.handedOver]) assert.deepEqual(way, { code: 0, stderr: '', context: acmeIndex(root) })
    for (const way of [prompted.written, prompted.handedOver]) assert.deepEqual(way, { code: 0, stderr: '', context: acmePointers(root) })
  })

  test(`the powershell line of a hook, started by ${name}, finds the plugin in a folder whose name holds a space, an exclamation mark and a letter outside ASCII`, POWERSHELL_LINE, async () => {
    const root = tree(acme())
    const linked = join(tree(makeTree({})), 'plug in! é')
    symlinkSync(REPO, linked, 'junction')

    const started = await asPowershellLine(program, 'SessionStart', { session_id: 's1', cwd: root, source: 'new' }, linked)

    for (const way of [started.written, started.handedOver]) assert.deepEqual(way, { code: 0, stderr: '', context: acmeIndex(root) })
  })
}

test('the session-start hook, started as the manifest declares it, answers with the live index', () => {
  const root = tree(acme())

  const result = declared('SessionStart', { session_id: 's1', cwd: root, hook_event_name: 'SessionStart', source: 'startup' })

  assert.equal(result.stderr, '')
  assert.equal(result.code, 0)
  assert.deepEqual(JSON.parse(result.stdout) as unknown, {
    additionalContext: acmeIndex(root),
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: acmeIndex(root),
    },
  })
})

test('the prompt hook, started as the manifest declares it, answers a prompt naming a work item with its pointers', () => {
  const root = tree(acme())

  const result = declared('UserPromptSubmit', { session_id: 's1', cwd: root, hook_event_name: 'UserPromptSubmit', prompt: 'pick up PROJ-12 where we left it' })

  assert.equal(result.stderr, '')
  assert.equal(result.code, 0)
  assert.deepEqual(JSON.parse(result.stdout) as unknown, {
    additionalContext: acmePointers(root),
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: acmePointers(root),
    },
  })
})
