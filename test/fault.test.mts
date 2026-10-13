import assert from 'node:assert/strict'
import { chmodSync, existsSync, writeFileSync } from 'node:fs'
import { join, sep } from 'node:path'
import { test } from 'node:test'
import { WINDOWS, acme, disposable, notOnWindows, pluginWith, run, runIn } from './helpers.mts'

const tree = disposable()

const HINT = 'Set CONTEXT_CENTRAL_DEBUG=1 to see the trace.'
const CLOSED = notOnWindows('a folder on Windows is not closed to writing by its mode')
const TOO_LONG = WINDOWS ? 'E[A-Z]+' : 'ENAMETOOLONG'
const LONG_NAME = 'a'.repeat(300)

const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const faultUnder = (command: string, code: string, folder: string) => new RegExp(`^context-central ${command}: ${code}: [^\\n]+ '${literal(folder + sep)}[^'\\n]+'\\. ${literal(HINT)}\\n$`)

function closed(folders: string[], act: () => ReturnType<typeof run>) {
  for (const folder of folders) chmodSync(folder, 0o555)
  try {
    return act()
  } finally {
    for (const folder of folders) chmodSync(folder, 0o755)
  }
}

test('a note on a map that cannot be written is one line that names the path and the code, and nothing is written', CLOSED, () => {
  const root = tree(acme())

  const result = closed([root], () => run(['note', 'Gateway limits agreed'], { cwd: root }))

  assert.equal(result.code, 1)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, faultUnder('note', 'EACCES', root))
  assert.equal(existsSync(join(root, 'log')), false)
})

test('a new work item on a map that cannot be written is one line that names the path and the code, and no folder is made', CLOSED, () => {
  const root = tree(acme())

  const result = closed([root, join(root, 'work')], () => run(['work', 'new', 'PROJ-13'], { cwd: root }))

  assert.equal(result.code, 1)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, faultUnder('work', 'EACCES', root))
  assert.equal(existsSync(join(root, 'work', 'PROJ-13')), false)
})

test('an item name too long for the disk is one line that names the path and the code', () => {
  const root = tree(acme())

  const result = run(['work', 'new', LONG_NAME], { cwd: root })

  assert.equal(result.code, 1)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, faultUnder('work', TOO_LONG, root))
})

test('with CONTEXT_CENTRAL_DEBUG set the trace follows the line, in place of the sentence that names the variable', () => {
  const root = tree(acme())

  const result = run(['work', 'new', LONG_NAME], { cwd: root, env: { CONTEXT_CENTRAL_DEBUG: '1' } })

  assert.equal(result.code, 1)
  assert.match(result.stderr, new RegExp(`^context-central work: ${TOO_LONG}: [^\\n]+'\\n[^\\n]+\\n +at `))
  assert.doesNotMatch(result.stderr, /Set CONTEXT_CENTRAL_DEBUG/)
})

test('a command that cannot be loaded is one line that names no command, and so is help', () => {
  const plugin = tree(pluginWith({}))
  writeFileSync(join(plugin, 'lib', 'commands', 'broken.mts'), "throw new Error('the file\\n  is broken')\n")

  for (const args of [['broken'], ['help']]) {
    const result = runIn(plugin, args)

    assert.equal(result.code, 1)
    assert.equal(result.stdout, '')
    assert.equal(result.stderr, `context-central: the file is broken. ${HINT}\n`)
  }
})

test('a value thrown that is no error is printed as it is', () => {
  const plugin = tree(pluginWith({}))
  writeFileSync(join(plugin, 'lib', 'commands', 'odd.mts'), "export function run() {\n  throw 'just words'\n}\n")

  const result = runIn(plugin, ['odd'])

  assert.equal(result.code, 1)
  assert.equal(result.stderr, `context-central odd: just words. ${HINT}\n`)
})
