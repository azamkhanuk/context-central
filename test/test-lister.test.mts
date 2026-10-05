import assert from 'node:assert/strict'
import { existsSync, readdirSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { REPO, disposable, makeTree, spawned } from './helpers.mts'

const LISTER = join(REPO, 'scripts', 'test.mts')

const tree = disposable()

const marking = name => `import { mkdirSync, writeFileSync } from 'node:fs'\nmkdirSync('marks', { recursive: true })\nwriteFileSync('marks/${name}', '')\n`
const marks = root => (existsSync(join(root, 'marks')) ? readdirSync(join(root, 'marks')).sort() : [])

const list = root => spawned(process.execPath, [LISTER], { cwd: root })

test('every test file at the top of the test folder is run, and nothing else', () => {
  const root = tree(
    makeTree({
      'test/first.test.mts': marking('first'),
      'test/second.test.mts': marking('second'),
      'test/helpers.mts': marking('helpers'),
      'test/below/third.test.mts': marking('third'),
      'elsewhere/fourth.test.mts': marking('fourth'),
    }),
  )

  const result = list(root)

  assert.equal(result.code, 0, result.stderr)
  assert.deepEqual(marks(root), ['first', 'second'])
})

test('one failing file fails the run, and the files beside it still run', () => {
  const root = tree(makeTree({ 'test/broken.test.mts': "throw new Error('broken on purpose')\n", 'test/sound.test.mts': marking('sound') }))

  const result = list(root)

  assert.equal(result.code, 1)
  assert.deepEqual(marks(root), ['sound'])
})

test('with no test files the run fails, says so, and starts nothing', () => {
  const root = tree(makeTree({ 'test/helpers.mts': marking('helpers'), 'test/below/third.test.mts': marking('third'), 'fourth.test.mts': marking('fourth') }))

  const result = list(root)

  assert.equal(result.code, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'no test files found: nothing in test/ ends in .test.mts\n')
  assert.deepEqual(marks(root), [])
})

test('with no test folder the run fails, says so, and starts nothing', () => {
  const root = tree(makeTree({ 'elsewhere/fourth.test.mts': marking('fourth') }))

  const result = list(root)

  assert.equal(result.code, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'no test files found: nothing in test/ ends in .test.mts\n')
  assert.deepEqual(marks(root), [])
})

test('a test file that is a symbolic link is run', () => {
  const root = tree(makeTree({ 'test/plain.test.mts': marking('plain'), 'kept/linked.mts': marking('linked') }))
  symlinkSync(join(root, 'kept/linked.mts'), join(root, 'test/linked.test.mts'))

  const result = list(root)

  assert.equal(result.code, 0, result.stderr)
  assert.deepEqual(marks(root), ['linked', 'plain'])
})

test('a linked test file whose target is gone fails the run', () => {
  const root = tree(makeTree({ 'test/plain.test.mts': marking('plain') }))
  symlinkSync(join(root, 'kept/gone.mts'), join(root, 'test/gone.test.mts'))

  const result = list(root)

  assert.equal(result.code, 1)
})
