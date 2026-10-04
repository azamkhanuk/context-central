import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { delimiter, dirname, join } from 'node:path'
import { test } from 'node:test'
import { ACME_CONFIG, REPO, disposable, makeTree } from './helpers.mjs'

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
