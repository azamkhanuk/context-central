import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { symlinkSync } from 'node:fs'
import { acme, disposable, makeTree, notOnWindows, run } from './helpers.mts'
import type { Json, TreeFiles } from './helpers.mts'

const tree = disposable()

const WEB = { name: 'web', role: 'front end', baseBranch: 'main' }
const API = { name: 'api', role: 'back end', baseBranch: 'main', standards: ['api/CONTRIBUTING.md', 'api/docs/review.md'], checks: ['./check.sh tests', './check.sh style'] }
const FILES = { 'standards/api.md': '# api\n\n## Design\n', 'api/CONTRIBUTING.md': '# Contributing\n', 'api/docs/review.md': '# Review\n' }
const NOTHING_FOR_WEB = 'No standards recorded for repo web.\nNo checks recorded for repo web.\n'

const standards = (root: string, ...args: string[]) => run(['standards', ...args], { cwd: root })
const withApi = (files: TreeFiles = FILES, api: { [key: string]: Json } = API) => tree(acme(files, { repos: [WEB, api] }))
const refusal = (api: { [key: string]: Json }) => run(['config'], { cwd: withApi(FILES, { ...API, ...api }) })

test('a repo\'s standards are printed as absolute paths, its note first, and its checks with the folder they run from', () => {
  const root = withApi()

  const result = standards(root, 'api')

  assert.equal(result.code, 0)
  assert.equal(
    result.stdout,
    [
      'Standards for repo api:',
      `- ${join(root, 'standards/api.md')} (the standards note)`,
      `- ${join(root, 'api/CONTRIBUTING.md')}`,
      `- ${join(root, 'api/docs/review.md')}`,
      `Checks for repo api, run from ${join(root, 'api')}:`,
      '- ./check.sh tests',
      '- ./check.sh style',
      '',
    ].join('\n'),
  )
})

test('the standards note is found by the repo\'s name, with nothing in the settings', () => {
  const root = withApi({ 'standards/web.md': '# web\n' })

  assert.equal(standards(root, 'web').stdout, ['Standards for repo web:', `- ${join(root, 'standards/web.md')} (the standards note)`, 'No checks recorded for repo web.', ''].join('\n'))
})

test('a listed file that does not exist is marked, and so is one that is a folder', () => {
  const root = withApi({ 'api/CONTRIBUTING.md': '# Contributing\n' }, { ...API, standards: ['api/CONTRIBUTING.md', 'api/docs/review.md', 'api'] })

  const lines = standards(root, 'api').stdout.split('\n')

  assert.deepEqual(lines.slice(0, 4), ['Standards for repo api:', `- ${join(root, 'api/CONTRIBUTING.md')}`, `- ${join(root, 'api/docs/review.md')} (missing)`, `- ${join(root, 'api')} (a folder)`])
})

test('a file listed twice, or listed as well as being the note, is printed once', () => {
  const root = withApi(FILES, { ...API, standards: ['api/CONTRIBUTING.md', 'standards/api.md', 'api/CONTRIBUTING.md', './api/CONTRIBUTING.md'] })

  const lines = standards(root, 'api').stdout.split('\n')

  assert.deepEqual(lines.slice(0, 4), ['Standards for repo api:', `- ${join(root, 'standards/api.md')} (the standards note)`, `- ${join(root, 'api/CONTRIBUTING.md')}`, `Checks for repo api, run from ${join(root, 'api')}:`])
})

test('a repo with nothing recorded says so for each, and empty lists are nothing recorded', () => {
  const root = withApi()
  const emptied = withApi({}, { ...API, standards: [], checks: [] })

  assert.equal(standards(root, 'web').stdout, NOTHING_FOR_WEB)
  assert.equal(standards(emptied, 'api').stdout, 'No standards recorded for repo api.\nNo checks recorded for repo api.\n')
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
      `- ${join(root, 'standards/api.md')} (the standards note)`,
      `- ${join(root, 'api/CONTRIBUTING.md')}`,
      `- ${join(root, 'api/docs/review.md')}`,
      `Checks for repo api, run from ${join(root, 'api')}:`,
      '- ./check.sh tests',
      '- ./check.sh style',
      '',
    ].join('\n'),
  )
})

test('the same is given as data, with the note and the missing file told apart', () => {
  const root = withApi({ 'standards/api.md': '# api\n', 'api/CONTRIBUTING.md': '# Contributing\n' })

  const result = standards(root, '--json')

  assert.deepEqual(JSON.parse(result.stdout) as unknown, [
    { repo: 'web', root: join(root, 'web'), standards: [], checks: [] },
    {
      repo: 'api',
      root: join(root, 'api'),
      standards: [
        { path: join(root, 'standards/api.md'), exists: true, note: true },
        { path: join(root, 'api/CONTRIBUTING.md'), exists: true, note: false },
        { path: join(root, 'api/docs/review.md'), exists: false, note: false },
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

test('two repos entered under one name are both printed', () => {
  const root = tree(acme({}, { repos: [{ name: 'api', checks: ['./one.sh'] }, { name: 'api', path: 'web', checks: ['./two.sh'] }] }))

  assert.equal(
    standards(root, 'api').stdout,
    ['No standards recorded for repo api.', `Checks for repo api, run from ${join(root, 'api')}:`, '- ./one.sh', '', 'No standards recorded for repo api.', `Checks for repo api, run from ${join(root, 'web')}:`, '- ./two.sh', ''].join('\n'),
  )
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

test('in a map kept inside a repo, the note is found in the map and listed files are counted from the estate root', () => {
  const app = { name: 'app', path: '.', standards: ['CONTRIBUTING.md'], checks: ['./check.sh'] }
  const files = { '.context-central/estate.json': { contextCentral: 1, name: 'acme', repos: [app] }, '.context-central/standards/app.md': '# app\n', 'CONTRIBUTING.md': '# Contributing\n' }
  const root = tree(makeTree(files))

  const result = standards(root, 'app')

  assert.equal(
    result.stdout,
    [
      'Standards for repo app:',
      `- ${join(root, '.context-central/standards/app.md')} (the standards note)`,
      `- ${join(root, 'CONTRIBUTING.md')}`,
      `Checks for repo app, run from ${root}:`,
      '- ./check.sh',
      '',
    ].join('\n'),
  )
})

test('a repo whose name could not be a note\'s name has no note found for it', () => {
  const root = tree(acme({ 'glossary.md': '# Glossary\n' }, { repos: [{ name: '../glossary', path: 'api' }] }))

  assert.equal(standards(root).stdout, 'No standards recorded for repo ../glossary.\nNo checks recorded for repo ../glossary.\n')
})

test('a repo whose name cannot name a note takes as its note the first listed file in the map\'s standards folder', () => {
  const hidden = { name: '.tools', path: 'api', standards: ['api/CONTRIBUTING.md', 'standards/tools.md'] }
  const root = tree(acme({ 'standards/tools.md': '# tools\n', 'api/CONTRIBUTING.md': '# Contributing\n' }, { repos: [hidden] }))

  const lines = standards(root, '.tools').stdout.split('\n')

  assert.deepEqual(lines.slice(0, 3), ['Standards for repo .tools:', `- ${join(root, 'api/CONTRIBUTING.md')}`, `- ${join(root, 'standards/tools.md')} (the standards note)`])
})

test('a map that does not keep standards as a kind of note has no standards note, whatever sits in a folder of that name', () => {
  const root = tree(acme({ 'standards/api.md': '# A handbook, not a note\n', 'repos/api.md': '# api\n' }, { nodeDirs: ['repos', 'concepts', 'edges', 'work'], repos: [WEB, { name: 'api' }] }))

  assert.equal(standards(root, 'api').stdout, 'No standards recorded for repo api.\nNo checks recorded for repo api.\n')
  assert.deepEqual(run(['resolve', 'api'], { cwd: root }).stdout.split('\n').slice(0, 2), ['Context for repo api:', '- repos/api.md (6 B) repo note'])
})

test('a listed link to the note is the note, printed once', notOnWindows('making a symbolic link needs a right most Windows accounts lack'), () => {
  const root = withApi(FILES, { ...API, standards: ['api/STANDARDS.md'] })
  symlinkSync(join(root, 'standards/api.md'), join(root, 'api/STANDARDS.md'))

  assert.deepEqual(standards(root, 'api').stdout.split('\n').slice(0, 3), ['Standards for repo api:', `- ${join(root, 'standards/api.md')} (the standards note)`, `Checks for repo api, run from ${join(root, 'api')}:`])
})

test('it answers from any folder the map covers', () => {
  const root = withApi()

  assert.equal(run(['standards', 'web'], { cwd: join(root, 'api') }).stdout, NOTHING_FOR_WEB)
})

test('a repo\'s standards and checks are settings like any other', () => {
  const root = withApi()

  const repos = JSON.parse(run(['config', '--get', 'repos'], { cwd: root }).stdout) as unknown

  assert.deepEqual(repos, [{ path: 'web', ...WEB }, { path: 'api', ...API }])
})

test('standards or checks that are not a list of text are a config error that names the repo', () => {
  for (const [wrong, message] of [
    [{ standards: 'standards/api.md' }, '"standards" must be a list'],
    [{ standards: null }, '"standards" must be a list'],
    [{ checks: ['./check.sh', ''] }, '"checks" must be a list of non-empty strings'],
    [{ checks: ['./check.sh', 3] }, '"checks" must be a list of non-empty strings'],
  ] as [{ [key: string]: Json }, string][]) {
    const result = refusal(wrong)

    assert.equal(result.code, 1, message)
    assert.ok(result.stderr.endsWith(`estate.json: repo "api": ${message}\n`), result.stderr)
  }
})

test('a check or a path that is blank, or runs over a line, is refused', () => {
  for (const [wrong, name] of [
    [{ checks: ['  '] }, 'checks'],
    [{ checks: ['./check.sh\n./publish.sh'] }, 'checks'],
    [{ checks: ['./check.sh\r'] }, 'checks'],
    [{ checks: ['./check.sh\u2028./publish.sh'] }, 'checks'],
    [{ checks: ['./check.sh \u001b[2K'] }, 'checks'],
    [{ standards: [' '] }, 'standards'],
  ] as [{ [key: string]: Json }, string][]) {
    const result = refusal(wrong)

    assert.equal(result.code, 1, name)
    assert.ok(result.stderr.endsWith(`estate.json: repo "api": each entry in "${name}" must be one line of text\n`), result.stderr)
  }
})

test('a check may hold a tab, and a repo\'s name and path may not run over a line', () => {
  const tabbed = withApi(FILES, { ...API, checks: ['./check.sh\ttests'] })
  const forged = 'api\n- ./publish.sh\nChecks for repo api, run from here'

  assert.equal(standards(tabbed, 'api').stdout.split('\n').at(-2), '- ./check.sh\ttests')
  assert.ok(refusal({ path: forged }).stderr.endsWith('estate.json: repo "api": "path" must be one line of text\n'))
  assert.ok(run(['config'], { cwd: tree(acme({}, { repos: [{ name: forged }] })) }).stderr.endsWith('estate.json: each entry in "repos" needs a "name" on one line\n'))
})

test('a standards path that would leave the estate is refused', () => {
  for (const outside of ['/etc/hosts', '../outside.md', 'api/../../outside.md', 'C:/notes/api.md', 'api\\CONTRIBUTING.md']) {
    const result = refusal({ standards: ['api/CONTRIBUTING.md', outside] })

    assert.equal(result.code, 1, outside)
    assert.ok(result.stderr.endsWith(`estate.json: repo "api": "standards" holds "${outside}"; a path there is counted from the estate root, with forward slashes and no ".."\n`), result.stderr)
  }
})

test('the command is listed in the help with what it prints', () => {
  const result = run(['help'])

  assert.match(result.stdout, /^ {2}standards {2}Print each repo's standards files and recorded checks: standards \[<repo>\] \[--json\]$/m)
})
