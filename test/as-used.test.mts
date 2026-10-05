import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { delimiter, dirname, join } from 'node:path'
import { test } from 'node:test'
import { ACME_CONFIG, REPO, acme, acmeIndex, acmePointers, disposable, makeTree, notOnWindows, spawned } from './helpers.mts'

const tree = disposable()

const { contextCentral, ...ACME_ANSWERS } = ACME_CONFIG
const PATH = [join(REPO, 'bin'), dirname(process.execPath), process.env.PATH].join(delimiter)

const bare = (root, line) => spawned('sh', ['-c', line], { cwd: root, env: { PATH } })

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

function declared(event, input) {
  const { hooks } = JSON.parse(readFileSync(join(REPO, 'hooks', 'hooks.json'), 'utf8'))
  const [{ command, args }] = hooks[event][0].hooks
  return spawned(
    command,
    args.map(arg => arg.replaceAll('${CLAUDE_PLUGIN_ROOT}', REPO)),
    { input: JSON.stringify(input), env: { PATH, CONTEXT_CENTRAL_STATE_DIR: tree(makeTree({})) } },
  )
}

test('the session-start hook, started as the manifest declares it, answers with the live index', () => {
  const root = tree(acme())

  const result = declared('SessionStart', { session_id: 's1', cwd: root, hook_event_name: 'SessionStart', source: 'startup' })

  assert.equal(result.stderr, '')
  assert.equal(result.code, 0)
  assert.deepEqual(JSON.parse(result.stdout), {
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
  assert.deepEqual(JSON.parse(result.stdout), {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: acmePointers(root),
    },
  })
})
