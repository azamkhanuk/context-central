import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { REPO, disposable, makeTree } from './helpers.mjs'

const LISTER = join(REPO, 'scripts', 'test.mjs')

const tree = disposable()

const NO_LINKS = process.platform === 'win32' ? 'making a symbolic link can need a privilege on Windows' : false

const marking = name => `import { mkdirSync, writeFileSync } from 'node:fs'\nmkdirSync('marks', { recursive: true })\nwriteFileSync('marks/${name}', '')\n`
const marks = root => (existsSync(join(root, 'marks')) ? readdirSync(join(root, 'marks')).sort() : [])

function list(root) {
  const result = spawnSync(process.execPath, [LISTER], { cwd: root, encoding: 'utf8', env: { PATH: process.env.PATH, HOME: process.env.HOME } })
  return { code: result.status, stdout: result.stdout, stderr: result.stderr }
}

test('every test file at the top of the test folder is run, and nothing else', () => {
  const root = tree(
    makeTree({
      'test/first.test.mjs': marking('first'),
      'test/second.test.mjs': marking('second'),
      'test/helpers.mjs': marking('helpers'),
      'test/below/third.test.mjs': marking('third'),
      'elsewhere/fourth.test.mjs': marking('fourth'),
    }),
  )

  const result = list(root)

  assert.equal(result.code, 0, result.stderr)
  assert.deepEqual(marks(root), ['first', 'second'])
})

test('one failing file fails the run, and the files beside it still run', () => {
  const root = tree(makeTree({ 'test/broken.test.mjs': "throw new Error('broken on purpose')\n", 'test/sound.test.mjs': marking('sound') }))

  const result = list(root)

  assert.equal(result.code, 1)
  assert.deepEqual(marks(root), ['sound'])
})

test('with no test files the run fails, says so, and starts nothing', () => {
  const root = tree(makeTree({ 'test/helpers.mjs': marking('helpers'), 'test/below/third.test.mjs': marking('third'), 'fourth.test.mjs': marking('fourth') }))

  const result = list(root)

  assert.equal(result.code, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'no test files found: nothing in test/ ends in .test.mjs\n')
  assert.deepEqual(marks(root), [])
})

test('with no test folder the run fails, says so, and starts nothing', () => {
  const root = tree(makeTree({ 'elsewhere/fourth.test.mjs': marking('fourth') }))

  const result = list(root)

  assert.equal(result.code, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'no test files found: nothing in test/ ends in .test.mjs\n')
  assert.deepEqual(marks(root), [])
})

test('a test file that is a symbolic link is run', { skip: NO_LINKS }, () => {
  const root = tree(makeTree({ 'test/plain.test.mjs': marking('plain'), 'kept/linked.mjs': marking('linked') }))
  symlinkSync(join(root, 'kept/linked.mjs'), join(root, 'test/linked.test.mjs'))

  const result = list(root)

  assert.equal(result.code, 0, result.stderr)
  assert.deepEqual(marks(root), ['linked', 'plain'])
})

test('a linked test file whose target is gone fails the run', { skip: NO_LINKS }, () => {
  const root = tree(makeTree({ 'test/plain.test.mjs': marking('plain') }))
  symlinkSync(join(root, 'kept/gone.mjs'), join(root, 'test/gone.test.mjs'))

  const result = list(root)

  assert.equal(result.code, 1)
})
