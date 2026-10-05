import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { REPO, disposable, makeTree } from './helpers.mts'
import type { Env, TreeFiles } from './helpers.mts'

const SCRIPT = join(REPO, 'scripts', 'scan-names.mts')
const ISOLATED = { PATH: process.env.PATH, HOME: process.env.HOME, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' }

const tree = disposable()

function git(root: string, ...args: string[]) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', env: ISOLATED })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}

function repository(files: TreeFiles, message = 'first commit') {
  const root = tree(makeTree(files))
  git(root, 'init', '--quiet', '--initial-branch=main')
  git(root, 'config', 'user.name', 'Test Author')
  git(root, 'config', 'user.email', 'author@acme.example')
  git(root, 'add', '--all')
  git(root, 'commit', '--quiet', '--allow-empty', '--message', message)
  return root
}

function namesFile(content: string) {
  return join(tree(makeTree({ 'names.txt': content })), 'names.txt')
}

function scan(root: string, args: string[], env: Env = {}) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: root, encoding: 'utf8', env: { ...ISOLATED, ...env } })
  return { code: result.status, stdout: result.stdout, stderr: result.stderr }
}

test('a repository that holds none of the names is clean', () => {
  const root = repository({ 'README.md': '# Acme estate\n\nNothing private here.\n' })

  const result = scan(root, [namesFile('Zorblatt\nQuillfeather Ltd\n')])

  assert.equal(result.code, 0)
  assert.equal(result.stdout, 'clean: 2 names checked against 1 file and 1 commit\n')
})

test('a name in a tracked file is reported with its file and line', () => {
  const root = repository({ 'docs/setup.md': '# Setup\n\nFirst built for Zorblatt.\n' })

  const result = scan(root, [namesFile('Zorblatt\n')])

  assert.equal(result.code, 1)
  assert.equal(result.stdout, 'docs/setup.md:3: Zorblatt\n')
})

test('the match ignores case and reports the name as the list spells it', () => {
  const root = repository({ 'notes.md': 'the ZORBLATT estate\n' })

  const result = scan(root, [namesFile('Zorblatt\n')])

  assert.equal(result.stdout, 'notes.md:1: Zorblatt\n')
})

test('a name inside a longer word is not a hit', () => {
  const root = repository({ 'notes.md': 'zorblattish and prezorblatt are other words\n' })

  assert.equal(scan(root, [namesFile('Zorblatt\n')]).code, 0)
})

test('a name joined to other words by punctuation is a hit', () => {
  const root = repository({ 'config.json': '{ "repo": "zorblatt-web", "db": "zorblatt_orders" }\n' })

  const result = scan(root, [namesFile('Zorblatt\n')])

  assert.equal(result.code, 1)
  assert.equal(result.stdout, 'config.json:1: Zorblatt\n')
})

test('a name of several words is matched as a phrase', () => {
  const root = repository({ 'a.md': 'Quillfeather alone is fine\n', 'b.md': 'billed to quillfeather ltd.\n' })

  const result = scan(root, [namesFile('Quillfeather Ltd\n')])

  assert.equal(result.stdout, 'b.md:1: Quillfeather Ltd\n')
})

test('punctuation in a name is matched literally', () => {
  const root = repository({ 'a.md': 'the axb team\n', 'b.md': 'the a.b team\n' })

  const result = scan(root, [namesFile('a.b\n')])

  assert.equal(result.stdout, 'b.md:1: a.b\n')
})

test('every hit is listed, files before commits', () => {
  const root = repository({ 'a.md': 'Zorblatt\nclean line\nQuillfeather Ltd and Zorblatt\n', 'b.md': 'clean\n' }, 'Import the Zorblatt notes')
  const sha = git(root, 'rev-parse', '--short', 'HEAD')

  const result = scan(root, [namesFile('Zorblatt\nQuillfeather Ltd\n')])

  assert.equal(result.code, 1)
  assert.equal(result.stdout, `a.md:1: Zorblatt\na.md:3: Zorblatt\na.md:3: Quillfeather Ltd\ncommit ${sha}: Zorblatt\n`)
})

test('a name in the body of an earlier commit message is reported', () => {
  const root = repository({ 'a.md': 'clean\n' }, 'Tidy the notes\n\nAsked for by Quillfeather Ltd.')
  const sha = git(root, 'rev-parse', '--short', 'HEAD')
  git(root, 'commit', '--quiet', '--allow-empty', '--message', 'A clean follow-up')

  const result = scan(root, [namesFile('Quillfeather Ltd\n')])

  assert.equal(result.code, 1)
  assert.equal(result.stdout, `commit ${sha}: Quillfeather Ltd\n`)
})

test('a commit message on another branch is scanned too', () => {
  const root = repository({ 'a.md': 'clean\n' })
  git(root, 'checkout', '--quiet', '-b', 'side')
  git(root, 'commit', '--quiet', '--allow-empty', '--message', 'Fix for Zorblatt')
  const sha = git(root, 'rev-parse', '--short', 'HEAD')
  git(root, 'checkout', '--quiet', 'main')

  const result = scan(root, [namesFile('Zorblatt\n')])

  assert.equal(result.stdout, `commit ${sha}: Zorblatt\n`)
})

test('files that git does not track are left out', () => {
  const root = repository({ 'a.md': 'clean\n', '.gitignore': 'private/\n', 'private/clients.md': 'Zorblatt\n' })

  assert.equal(scan(root, [namesFile('Zorblatt\n')]).code, 0)
})

test('a name in the path of a tracked file is reported as a path hit', () => {
  const root = repository({ 'zorblatt/setup.md': '# Setup\n' })

  const result = scan(root, [namesFile('Zorblatt\n')])

  assert.equal(result.code, 1)
  assert.equal(result.stdout, 'zorblatt/setup.md: path: Zorblatt\n')
})

test('a name staged in a file is reported even after the working copy drops it', () => {
  const root = repository({ 'notes.md': '# Notes\n' })
  writeFileSync(join(root, 'notes.md'), '# Notes\n\nFirst built for Zorblatt.\n')
  git(root, 'add', 'notes.md')
  writeFileSync(join(root, 'notes.md'), '# Notes\n')

  const result = scan(root, [namesFile('Zorblatt\n')])

  assert.equal(result.code, 1)
  assert.equal(result.stdout, 'notes.md:3: Zorblatt\n')
})

test('blank lines and surrounding spaces in the list are ignored', () => {
  const root = repository({ 'a.md': 'Zorblatt\n' })

  const result = scan(root, [namesFile('\n   Zorblatt  \n\n')])

  assert.equal(result.stdout, 'a.md:1: Zorblatt\n')
})

test('the list can come from the environment in place of an argument', () => {
  const root = repository({ 'a.md': 'Zorblatt\n' })

  const result = scan(root, [], { CONTEXT_CENTRAL_PRIVATE_NAMES: namesFile('Zorblatt\n') })

  assert.equal(result.code, 1)
  assert.equal(result.stdout, 'a.md:1: Zorblatt\n')
})

test('the file given wins over the environment', () => {
  const root = repository({ 'a.md': 'Zorblatt\n' })

  const result = scan(root, [namesFile('Quillfeather Ltd\n')], { CONTEXT_CENTRAL_PRIVATE_NAMES: namesFile('Zorblatt\n') })

  assert.equal(result.code, 0)
})

test('with no list named the scan refuses to pass', () => {
  const root = repository({ 'a.md': 'clean\n' })

  const result = scan(root, [])

  assert.equal(result.code, 2)
  assert.equal(result.stdout, '')
  assert.match(result.stderr, /CONTEXT_CENTRAL_PRIVATE_NAMES/)
})

test('a list that cannot be read refuses to pass', () => {
  const root = repository({ 'a.md': 'clean\n' })

  const result = scan(root, [join(root, 'no-such-list.txt')])

  assert.equal(result.code, 2)
  assert.match(result.stderr, /no-such-list\.txt/)
})

test('an empty list refuses to pass', () => {
  const root = repository({ 'a.md': 'clean\n' })

  const result = scan(root, [namesFile('\n  \n')])

  assert.equal(result.code, 2)
  assert.match(result.stderr, /lists no names/)
})

test('outside a git repository the scan refuses to pass', () => {
  const root = tree(makeTree({ 'a.md': 'clean\n' }))

  const result = scan(root, [namesFile('Zorblatt\n')])

  assert.equal(result.code, 2)
  assert.match(result.stderr, /not a git repository/)
})

test('a repository with tracked files and no commit yet is still scanned', () => {
  const root = tree(makeTree({ 'a.md': 'Zorblatt\n' }))
  git(root, 'init', '--quiet', '--initial-branch=main')
  git(root, 'add', '--all')

  const result = scan(root, [namesFile('Zorblatt\n')])

  assert.equal(result.code, 1)
  assert.equal(result.stdout, 'a.md:1: Zorblatt\n')
})

test('run from a subfolder, the whole repository is scanned', () => {
  const root = repository({ 'README.md': 'Zorblatt\n', 'docs/setup.md': 'clean\n' })

  const result = scan(join(root, 'docs'), [namesFile('Zorblatt\n')])

  assert.equal(result.code, 1)
  assert.equal(result.stdout, 'README.md:1: Zorblatt\n')
})
