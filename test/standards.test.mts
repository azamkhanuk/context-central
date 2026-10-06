import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { acme, disposable, makeTree, run } from './helpers.mts'
import type { TreeFiles } from './helpers.mts'

const tree = disposable()

const WEB = { name: 'web', role: 'front end', baseBranch: 'main' }
const API = { name: 'api', role: 'back end', baseBranch: 'main', standards: ['standards/api.md', 'api/CONTRIBUTING.md'], checks: ['./check.sh tests', './check.sh style'] }
const FILES = { 'standards/api.md': '# api\n\n## Design\n', 'api/CONTRIBUTING.md': '# Contributing\n' }

const standards = (root: string, ...args: string[]) => run(['standards', ...args], { cwd: root })
const withApi = (files: TreeFiles = FILES) => tree(acme(files, { repos: [WEB, API] }))

test('a repo\'s standards are printed as absolute paths, and its checks with the folder they run from', () => {
  const root = withApi()

  const result = standards(root, 'api')

  assert.equal(result.code, 0)
  assert.equal(
    result.stdout,
    [
      'Standards for repo api:',
      `- ${join(root, 'standards/api.md')}`,
      `- ${join(root, 'api/CONTRIBUTING.md')}`,
      `Checks for repo api, run from ${join(root, 'api')}:`,
      '- ./check.sh tests',
      '- ./check.sh style',
      '',
    ].join('\n'),
  )
})

test('a standards file that does not exist is marked', () => {
  const root = withApi({ 'standards/api.md': '# api\n' })

  const result = standards(root, 'api')

  assert.equal(result.code, 0)
  assert.equal(result.stdout.split('\n')[2], `- ${join(root, 'api/CONTRIBUTING.md')} (missing)`)
})

test('a repo with nothing recorded says so for each', () => {
  const root = withApi()

  assert.equal(standards(root, 'web').stdout, 'No standards recorded for repo web.\nNo checks recorded for repo web.\n')
})

test('with no repo named, every repo is printed in the order of the settings', () => {
  const root = withApi()

  const result = standards(root)

  assert.equal(
    result.stdout,
    [
      'No standards recorded for repo web.',
      'No checks recorded for repo web.',
      '',
      'Standards for repo api:',
      `- ${join(root, 'standards/api.md')}`,
      `- ${join(root, 'api/CONTRIBUTING.md')}`,
      `Checks for repo api, run from ${join(root, 'api')}:`,
      '- ./check.sh tests',
      '- ./check.sh style',
      '',
    ].join('\n'),
  )
})

test('the same is given as data', () => {
  const root = withApi({ 'standards/api.md': '# api\n' })

  const result = standards(root, '--json')

  assert.deepEqual(JSON.parse(result.stdout) as unknown, [
    { repo: 'web', root: join(root, 'web'), standards: [], checks: [] },
    {
      repo: 'api',
      root: join(root, 'api'),
      standards: [
        { path: join(root, 'standards/api.md'), exists: true },
        { path: join(root, 'api/CONTRIBUTING.md'), exists: false },
      ],
      checks: ['./check.sh tests', './check.sh style'],
    },
  ])
})

test('a repo the estate does not register is refused, with the ones it does', () => {
  const root = withApi()

  const result = standards(root, 'billing')

  assert.equal(result.code, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'context-central standards: no repo "billing" in this estate. Its repos: web, api.\n')
})

test('an estate with no repos says so', () => {
  const root = tree(acme({}, { repos: [] }))

  const result = standards(root)

  assert.equal(result.code, 0)
  assert.equal(result.stdout, 'This estate registers no repos.\n')
  assert.deepEqual(JSON.parse(standards(root, '--json').stdout) as unknown, [])
})

test('more than one repo named is wrong usage', () => {
  const root = withApi()

  const result = standards(root, 'web', 'api')

  assert.equal(result.code, 2)
  assert.equal(result.stderr, 'context-central standards: expected one repo, or none for all of them\n')
})

test('in a map kept inside a repo, the paths are still counted from the estate root', () => {
  const app = { name: 'app', path: '.', standards: ['.context-central/standards/app.md'], checks: ['./check.sh'] }
  const root = tree(makeTree({ '.context-central/estate.json': { contextCentral: 1, name: 'acme', repos: [app] }, '.context-central/standards/app.md': '# app\n' }))

  const result = standards(root, 'app')

  assert.equal(
    result.stdout,
    ['Standards for repo app:', `- ${join(root, '.context-central/standards/app.md')}`, `Checks for repo app, run from ${root}:`, '- ./check.sh', ''].join('\n'),
  )
})

test('it answers from any folder the map covers', () => {
  const root = withApi()

  assert.equal(run(['standards', 'web'], { cwd: join(root, 'api') }).stdout, 'No standards recorded for repo web.\nNo checks recorded for repo web.\n')
})

test('a repo\'s standards and checks are settings like any other', () => {
  const root = withApi()

  const repos = JSON.parse(run(['config', '--get', 'repos'], { cwd: root }).stdout) as unknown

  assert.deepEqual(repos, [{ path: 'web', ...WEB }, { path: 'api', ...API }])
})

test('standards or checks of the wrong shape are a config error that names the repo', () => {
  const asText = tree(acme({}, { repos: [WEB, { ...API, standards: 'standards/api.md' }] }))
  const withBlank = tree(acme({}, { repos: [WEB, { ...API, checks: ['./check.sh', ''] }] }))

  const text = run(['config'], { cwd: asText })
  const blank = run(['standards'], { cwd: withBlank })

  assert.equal(text.code, 1)
  assert.match(text.stderr, /estate\.json: repo "api": "standards" must be a list\n$/)
  assert.equal(blank.code, 1)
  assert.match(blank.stderr, /estate\.json: repo "api": "checks" must be a list of non-empty strings\n$/)
})

test('the command is listed in the help with what it prints', () => {
  const result = run(['help'])

  assert.match(result.stdout, /^ {2}standards {2}Print each repo's standards files and recorded checks: standards \[<repo>\] \[--json\]$/m)
})
