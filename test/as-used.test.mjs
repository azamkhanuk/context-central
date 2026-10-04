import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { delimiter, dirname, join } from 'node:path'
import { test } from 'node:test'
import { ACME_CONFIG, ACME_FILES, REPO, acme, disposable, makeTree } from './helpers.mjs'

const tree = disposable()

const { contextCentral, ...ACME_ANSWERS } = ACME_CONFIG
const PATH = [join(REPO, 'bin'), dirname(process.execPath), process.env.PATH].join(delimiter)

function bare(root, line) {
  const result = spawnSync('sh', ['-c', line], { cwd: root, encoding: 'utf8', env: { PATH, HOME: process.env.HOME, CONTEXT_CENTRAL_NOW: '2026-01-15T12:00:00Z' } })
  return { code: result.status, stdout: result.stdout, stderr: result.stderr }
}

function freshMap() {
  const root = tree(makeTree({ 'answers.json': { layout: 'root', git: false, config: ACME_ANSWERS } }))
  const result = bare(root, 'context-central init --from answers.json')
  assert.equal(result.code, 0, result.stderr)
  return root
}

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

const sizeOf = rel => Buffer.byteLength(ACME_FILES[rel])

function declared(event, input) {
  const { hooks } = JSON.parse(readFileSync(join(REPO, 'hooks', 'hooks.json'), 'utf8'))
  const [{ command, args }] = hooks[event][0].hooks
  const result = spawnSync(
    command,
    args.map(arg => arg.replaceAll('${CLAUDE_PLUGIN_ROOT}', REPO)),
    {
      input: JSON.stringify(input),
      encoding: 'utf8',
      env: { PATH, HOME: process.env.HOME, CONTEXT_CENTRAL_NOW: '2026-01-15T12:00:00Z', CONTEXT_CENTRAL_STATE_DIR: tree(makeTree({})) },
    },
  )
  return { code: result.status, stdout: result.stdout, stderr: result.stderr }
}

test('the session-start hook, started as the manifest declares it, answers with the live index', () => {
  const root = tree(acme())

  const result = declared('SessionStart', { session_id: 's1', cwd: root, hook_event_name: 'SessionStart', source: 'startup' })

  assert.equal(result.stderr, '')
  assert.equal(result.code, 0)
  assert.deepEqual(JSON.parse(result.stdout), {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: [
        `Context map "Acme estate": ${root}`,
        `Hub: ${join(root, 'CLAUDE.md')}`,
        'Work in flight (1):',
        `- PROJ-12 | Rate limit the gateway | ${join(root, 'work/PROJ-12/STATE.md')}`,
        "A work item's state file records where it stands and what is next. context-central resolve <item> lists the notes behind it.",
      ].join('\n'),
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
      additionalContext: [
        'Context for work item PROJ-12:',
        `- ${join(root, 'work/PROJ-12/STATE.md')} (${sizeOf('work/PROJ-12/STATE.md')} B) state file: where the work stands and what is next`,
        `- ${join(root, 'work/PROJ-12/SPEC.md')} (${sizeOf('work/PROJ-12/SPEC.md')} B) spec of the work item`,
        `- ${join(root, 'concepts/gateway.md')} (${sizeOf('concepts/gateway.md')} B) linked from the work item`,
        `- ${join(root, 'repos/api.md')} (${sizeOf('repos/api.md')} B) linked from the work item`,
        `Other notes of this item: 1 file (${sizeOf('work/PROJ-12/notes/2026-01-10-research-rate-limits.md')} B) under ${join(root, 'work/PROJ-12')}.`,
        `Deep tier: 1 file (${sizeOf('work/PROJ-12/sources/01-2026-01-09-PROJ-12-full-text.md')} B) under ${join(root, 'work/PROJ-12/sources')}, not listed one by one.`,
      ].join('\n'),
    },
  })
})
