import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { REPO, disposable, makeTree, run } from './helpers.mts'
import type { Env, Json } from './helpers.mts'

const tree = disposable()

const CLAUDE_CODE = { host: 'claude-code', title: 'Claude Code' }
const COPILOT = { host: 'copilot', title: 'the Copilot command line' }
const SETS_FOR_A_COMMAND = { claudeCode: { CLAUDECODE: '1' }, copilot: { COPILOT_CLI: '1', COPILOT_AGENT_SESSION_ID: 'bdf1d82f-2d82-4d88-b8b8-271e4fb9fdce' } }

const homeWith = (installedPlugins: Json) => ({ HOME: tree(makeTree({ '.copilot/config.json': { installedPlugins } })), COPILOT_HOME: undefined })
const noCopyOnCopilot = () => homeWith([])
const thisCopyOnCopilot = () => homeWith([{ name: 'context-central', marketplace: 'azamkhanuk', version: '0.22.0', enabled: true, cache_path: REPO }])
const anotherCopyOnCopilot = () => homeWith([{ name: 'context-central', marketplace: 'azamkhanuk', version: '0.22.0', enabled: true, cache_path: join(REPO, 'elsewhere') }])
const told = (env: Env) => {
  const result = run(['host', '--json'], { env })
  assert.equal(result.stderr, '')
  const { host, title } = JSON.parse(result.stdout) as { host: string, title: string }
  return { host, title }
}

test('a command a session of Claude Code runs is told its host by the mark Claude Code sets', () => {
  assert.deepEqual(told({ ...noCopyOnCopilot(), ...SETS_FOR_A_COMMAND.claudeCode }), CLAUDE_CODE)
})

test('a command a session of Copilot runs is told its host by the mark Copilot sets, though the copy that runs is not one Copilot installed', () => {
  assert.deepEqual(told({ ...noCopyOnCopilot(), ...SETS_FOR_A_COMMAND.copilot }), COPILOT)
})

test('with the marks of both hosts, as in a session of one started inside a shell of the other, the host is the one that installed the copy that runs', () => {
  const both = { ...SETS_FOR_A_COMMAND.claudeCode, ...SETS_FOR_A_COMMAND.copilot }

  assert.deepEqual(told({ ...thisCopyOnCopilot(), ...both }), COPILOT)
  assert.deepEqual(told({ ...noCopyOnCopilot(), ...both }), CLAUDE_CODE)
  assert.deepEqual(told({ ...anotherCopyOnCopilot(), ...both }), CLAUDE_CODE)
})

test('with no mark of either host, as at a plain terminal, the host is the one that installed the copy that runs', () => {
  assert.deepEqual(told(thisCopyOnCopilot()), COPILOT)
  assert.deepEqual(told(noCopyOnCopilot()), CLAUDE_CODE)
})

test("with no mark and no record of Copilot's that can be read, the host is Claude Code, as it was before there was a second", () => {
  const unreadable = { HOME: tree(makeTree({ '.copilot/config.json': '{ not json' })), COPILOT_HOME: undefined }
  const none = { HOME: tree(makeTree({ '.keep': '' })), COPILOT_HOME: undefined }

  assert.deepEqual(told(unreadable), CLAUDE_CODE)
  assert.deepEqual(told(none), CLAUDE_CODE)
})

test("a copy Copilot keeps in the folder COPILOT_HOME names is found there, and not in the person's home", () => {
  const { HOME } = thisCopyOnCopilot()
  const moved = tree(makeTree({ 'config.json': { installedPlugins: [] } }))

  assert.deepEqual(told({ HOME, COPILOT_HOME: moved }), CLAUDE_CODE)
  assert.deepEqual(told({ HOME: moved, COPILOT_HOME: join(HOME, '.copilot') }), COPILOT)
})

test('a hook is told its host by the folder Copilot names to its hooks, whatever mark a shell handed down', () => {
  assert.deepEqual(told({ ...noCopyOnCopilot(), ...SETS_FOR_A_COMMAND.claudeCode, COPILOT_PLUGIN_ROOT: REPO }), COPILOT)
})

test('host prints the name of the host as a line a person reads', () => {
  const claudeCode = run(['host'], { env: { ...noCopyOnCopilot(), ...SETS_FOR_A_COMMAND.claudeCode } })
  const copilot = run(['host'], { env: { ...noCopyOnCopilot(), ...SETS_FOR_A_COMMAND.copilot } })

  assert.equal(claudeCode.stdout.split('\n')[0], 'Host: Claude Code')
  assert.equal(copilot.stdout.split('\n')[0], 'Host: the Copilot command line')
})

test('host takes no word after it and no flag but --json', () => {
  assert.equal(run(['host', 'copilot']).code, 2)
  assert.equal(run(['host', '--steps']).code, 2)
})
