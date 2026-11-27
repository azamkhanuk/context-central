import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'
import { REPO, checkout, disposable, git, spawned } from './helpers.mts'
import type { Checkout } from './helpers.mts'

const tree = disposable()

const SCRIPT = join(REPO, 'scripts', 'release-branch.mts')
const MANIFEST = { name: 'context-central', version: '0.3.0' }
const TAG = 'context-central--v0.3.0'

type Released = Checkout & { origin: string }

function repository(): Released {
  const made = checkout({ '.claude-plugin/plugin.json': MANIFEST, 'README.md': '# The plugin\n' }, 'plugin')
  tree(made.base)
  const origin = join(made.base, 'origin.git')
  git(made, made.base, 'init', '-q', '--bare', '-b', 'main', origin)
  git(made, made.main, 'remote', 'add', 'origin', origin)
  git(made, made.main, 'push', '-q', 'origin', 'main')
  return { ...made, origin }
}

function commit(made: Released, text: string) {
  writeFileSync(join(made.main, 'README.md'), text)
  git(made, made.main, 'commit', '-q', '-am', text.trim())
  git(made, made.main, 'push', '-q', 'origin', 'main')
  return head(made, 'HEAD')
}

function tagHere(made: Released) {
  git(made, made.main, 'tag', '-a', TAG, '-m', 'context-central 0.3.0')
  git(made, made.main, 'push', '-q', 'origin', `refs/tags/${TAG}`)
  return head(made, 'HEAD')
}

const head = (made: Released, name: string) => git(made, made.main, 'rev-parse', name).stdout.trim()
const onOrigin = (made: Released, ref: string) => git(made, made.origin, 'rev-parse', '--verify', '-q', ref).stdout.trim()
const move = (made: Released) => spawned(process.execPath, [SCRIPT], { cwd: made.main, env: made.env })

test('with the release tagged and no release branch yet, the branch is made at the commit the tag names', () => {
  const made = repository()
  const tagged = tagHere(made)

  const result = move(made)

  assert.deepEqual(result, { code: 0, stdout: `release moved to ${TAG}, ${tagged.slice(0, 7)}\n`, stderr: '' })
  assert.equal(onOrigin(made, 'refs/heads/release'), tagged)
})

test('a release branch behind the tag is moved to it, and commits on main after the tag are left out of it', () => {
  const made = repository()
  git(made, made.main, 'push', '-q', 'origin', 'HEAD:refs/heads/release')
  commit(made, '# The plugin, released\n')
  const tagged = tagHere(made)
  commit(made, '# The plugin, with work after the release\n')

  const result = move(made)

  assert.equal(result.code, 0, result.stderr)
  assert.equal(onOrigin(made, 'refs/heads/release'), tagged)
  assert.notEqual(onOrigin(made, 'refs/heads/main'), tagged)
})

test('in a checkout that does not hold the tagged commit, as a shallow one of a later commit does not, the branch is still moved to the tag', () => {
  const made = repository()
  const tagged = tagHere(made)
  commit(made, '# The plugin, with work after the release\n')
  const later = join(made.base, 'later')
  git(made, made.base, 'clone', '-q', '--depth', '1', '--no-tags', pathToFileURL(made.origin).href, later)

  const result = spawned(process.execPath, [SCRIPT], { cwd: later, env: made.env })

  assert.equal(result.code, 0, result.stderr)
  assert.equal(onOrigin(made, 'refs/heads/release'), tagged)
})

test('in a shallow checkout, as the release job has one, a release branch that sits at the release before is moved to the tag', () => {
  const made = repository()
  git(made, made.main, 'push', '-q', 'origin', 'HEAD:refs/heads/release')
  commit(made, '# The plugin, with work for the next release\n')
  const tagged = tagHere(made)
  const shallow = join(made.base, 'shallow')
  git(made, made.base, 'clone', '-q', '--depth', '1', '--no-tags', pathToFileURL(made.origin).href, shallow)

  const result = spawned(process.execPath, [SCRIPT], { cwd: shallow, env: made.env })

  assert.deepEqual(result, { code: 0, stdout: `release moved to ${TAG}, ${tagged.slice(0, 7)}\n`, stderr: '' })
  assert.equal(onOrigin(made, 'refs/heads/release'), tagged)
})

test('a tag that names no commit is not pushed to the branch, and the script exits 1', () => {
  const made = repository()
  const blob = git(made, made.main, 'hash-object', '-w', 'README.md').stdout.trim()
  git(made, made.main, 'tag', TAG, blob)
  git(made, made.main, 'push', '-q', 'origin', `refs/tags/${TAG}`)

  const result = move(made)

  assert.deepEqual(result, { code: 1, stdout: '', stderr: `release could not be moved to ${TAG}: ${TAG} names a blob, not a commit\n` })
  assert.equal(onOrigin(made, 'refs/heads/release'), '')
})

test('a release branch that is at the tag already is left, and one line says so', () => {
  const made = repository()
  tagHere(made)
  move(made)

  const result = move(made)

  assert.deepEqual(result, { code: 0, stdout: `release is at ${TAG} already\n`, stderr: '' })
})

test('with no tag for the version the manifest carries, nothing is pushed and one line says the release is not out', () => {
  const made = repository()

  const result = move(made)

  assert.deepEqual(result, { code: 0, stdout: `${TAG} is not out, so release stays where it is\n`, stderr: '' })
  assert.equal(onOrigin(made, 'refs/heads/release'), '')
})

test('a release branch that holds a commit the tag does not is not moved, and the script exits 1 with what git said', () => {
  const made = repository()
  const tagged = tagHere(made)
  commit(made, '# The plugin, with a commit put on release by hand\n')
  git(made, made.main, 'push', '-q', 'origin', 'HEAD:refs/heads/release')
  const byHand = onOrigin(made, 'refs/heads/release')

  const result = move(made)

  assert.equal(result.code, 1)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /^release could not be moved to context-central--v0\.3\.0: /)
  assert.match(result.stderr, /rejected|non-fast-forward/)
  assert.equal(onOrigin(made, 'refs/heads/release'), byHand)
  assert.notEqual(byHand, tagged)
})

test('where origin cannot be reached, the script exits 1 with what git said and pushes nothing', () => {
  const made = repository()
  tagHere(made)
  git(made, made.main, 'remote', 'set-url', 'origin', join(made.base, 'nowhere.git'))

  const result = move(made)

  assert.equal(result.code, 1)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /^release could not be moved to context-central--v0\.3\.0: /)
  assert.equal(onOrigin(made, 'refs/heads/release'), '')
})
