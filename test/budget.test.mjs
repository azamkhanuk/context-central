import assert from 'node:assert/strict'
import { rmSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { acme, disposable, makeTree, run } from './helpers.mjs'

const tree = disposable()

const USER_FILE = '# Mine\n\nPlain words.\n'
const HUB = '# Acme estate\n\nRepo notes: @repos/web.md\n'
const LONG_NOTE = 'line\n'.repeat(210)
const SCOPED_RULE = '---\npaths:\n  - "src/**/*.ts"\n---\n# Only for source\n'

const budget = (root, dir, env = {}, flags = []) => run(['budget', ...flags], { cwd: join(root, dir), env: { HOME: join(root, 'home'), ...env } })
const budgetJson = (root, dir, env) => JSON.parse(budget(root, dir, env, ['--json']).stdout)
const sources = report => report.files.map(file => [file.path, file.source])
const LAST_INDEX_LINE = "A work item's state file records where it stands and what is next. context-central resolve <item> lists the notes behind it. Evidence that is not text sits in the item's evidence/ folder, named in a note."

test('the user file, each ancestor file and their imports are listed with a total', () => {
  const root = tree(
    makeTree({
      'home/.claude/CLAUDE.md': USER_FILE,
      'estate/CLAUDE.md': HUB,
      'estate/repos/web.md': LONG_NOTE,
      'estate/web/CLAUDE.md': '# web\n',
      'estate/web/src/CLAUDE.md': '# below the start, so not loaded at launch\n',
    }),
  )

  const result = budget(root, 'estate/web')

  assert.equal(result.code, 0)
  assert.equal(
    result.stdout,
    [
      `Loaded at launch for a session started in ${root}/estate/web:`,
      '     21 B    3 lines  ~/.claude/CLAUDE.md (user)',
      `     41 B    3 lines  ${root}/estate/CLAUDE.md (ancestor)`,
      `   1.0 KB  210 lines  ${root}/estate/repos/web.md (import of ${root}/estate/CLAUDE.md) over 200 lines`,
      `      6 B    1 line  ${root}/estate/web/CLAUDE.md (ancestor)`,
      'Total: 1.1 KB in 4 files, about 300 to 400 tokens',
      '',
    ].join('\n'),
  )
})

test('a folder can be named instead of starting there', () => {
  const root = tree(makeTree({ 'estate/web/CLAUDE.md': '# web\n' }))

  const result = run(['budget', 'estate/web'], { cwd: root, env: { HOME: join(root, 'home') } })

  assert.match(result.stdout, new RegExp(`^Loaded at launch for a session started in ${root}/estate/web:\n {6}6 B`))
})

test('local files and a .claude/CLAUDE.md count as well', () => {
  const root = tree(makeTree({ 'estate/CLAUDE.md': '# Acme\n', 'estate/CLAUDE.local.md': 'mine\n', 'estate/.claude/CLAUDE.md': '# project\n' }))

  assert.deepEqual(sources(budgetJson(root, 'estate')), [
    [join(root, 'estate/CLAUDE.md'), 'ancestor'],
    [join(root, 'estate/.claude/CLAUDE.md'), 'ancestor'],
    [join(root, 'estate/CLAUDE.local.md'), 'ancestor'],
  ])
})

test('AGENTS.md counts when no CLAUDE file is found on the way up', () => {
  const root = tree(makeTree({ 'estate/AGENTS.md': '# Acme\n', 'estate/web/AGENTS.md': '# web\n' }))

  assert.deepEqual(sources(budgetJson(root, 'estate/web')), [
    [join(root, 'estate/AGENTS.md'), 'ancestor'],
    [join(root, 'estate/web/AGENTS.md'), 'ancestor'],
  ])
})

test('AGENTS.md is left out as soon as any CLAUDE file is found on the way up', () => {
  const root = tree(makeTree({ 'estate/CLAUDE.local.md': 'mine\n', 'estate/web/AGENTS.md': '# web\n' }))

  assert.deepEqual(sources(budgetJson(root, 'estate/web')), [[join(root, 'estate/CLAUDE.local.md'), 'ancestor']])
})

test('rules without paths load at launch; path-scoped rules are only counted', () => {
  const root = tree(
    makeTree({
      'home/.claude/rules/style.md': '# Style\n',
      'home/.claude/rules/deep/scoped.md': SCOPED_RULE,
      'estate/.claude/rules/tests.md': '# Tests\n',
      'estate/.claude/rules/api/routes.md': SCOPED_RULE,
      'estate/.claude/rules/api/always.md': '# Always\n',
    }),
  )

  const report = budgetJson(root, 'estate')

  assert.deepEqual(sources(report), [
    [join(root, 'home/.claude/rules/style.md'), 'user rule'],
    [join(root, 'estate/.claude/rules/api/always.md'), 'project rule'],
    [join(root, 'estate/.claude/rules/tests.md'), 'project rule'],
  ])
  assert.deepEqual(report.notLoaded, { pathScopedRules: 2 })
  assert.match(budget(root, 'estate').stdout, /\nNot loaded until used: 2 path-scoped rules\n$/)
})

test('one path-scoped rule is counted in the singular', () => {
  const root = tree(makeTree({ 'estate/.claude/rules/routes.md': SCOPED_RULE }))

  assert.equal(
    budget(root, 'estate').stdout,
    [`Loaded at launch for a session started in ${root}/estate:`, 'Total: 0 B in 0 files, about 0 to 0 tokens', 'Not loaded until used: 1 path-scoped rule', ''].join('\n'),
  )
})

test('--json carries sizes, the importer, the over-budget mark and the token range', () => {
  const root = tree(makeTree({ 'home/.claude/CLAUDE.md': USER_FILE, 'estate/CLAUDE.md': HUB, 'estate/repos/web.md': LONG_NOTE }))

  assert.deepEqual(budgetJson(root, 'estate'), {
    dir: join(root, 'estate'),
    files: [
      { path: join(root, 'home/.claude/CLAUDE.md'), bytes: 21, lines: 3, source: 'user', over: false },
      { path: join(root, 'estate/CLAUDE.md'), bytes: 41, lines: 3, source: 'ancestor', over: false },
      { path: join(root, 'estate/repos/web.md'), bytes: 1050, lines: 210, source: 'import', importedBy: join(root, 'estate/CLAUDE.md'), over: true },
    ],
    lineLimit: 200,
    total: { bytes: 1112, files: 3, tokens: { low: 300, high: 400 } },
    notLoaded: { pathScopedRules: 0 },
    plugin: null,
  })
})

test('a file reached twice is counted once', () => {
  const root = tree(
    makeTree({
      'home/.claude/CLAUDE.md': 'See @shared.md\n',
      'home/.claude/shared.md': '# Shared\n',
      'home/project/CLAUDE.md': 'See @~/.claude/shared.md\n',
    }),
  )

  assert.deepEqual(sources(budgetJson(root, 'home/project')), [
    [join(root, 'home/.claude/CLAUDE.md'), 'user'],
    [join(root, 'home/.claude/shared.md'), 'import'],
    [join(root, 'home/project/CLAUDE.md'), 'ancestor'],
  ])
})

test('paths under the home folder print with a tilde', () => {
  const root = tree(makeTree({ 'home/.claude/CLAUDE.md': 'See @shared.md\n', 'home/.claude/shared.md': '# Shared\n', 'home/project/CLAUDE.md': '# Project\n' }))

  assert.equal(
    budget(root, 'home/project').stdout,
    [
      'Loaded at launch for a session started in ~/project:',
      '     15 B    1 line  ~/.claude/CLAUDE.md (user)',
      '      9 B    1 line  ~/.claude/shared.md (import of ~/.claude/CLAUDE.md)',
      '     10 B    1 line  ~/project/CLAUDE.md (ancestor)',
      'Total: 34 B in 3 files, about 0 to 0 tokens',
      '',
    ].join('\n'),
  )
})

test('the user file is read from CLAUDE_CONFIG_DIR when that is set', () => {
  const root = tree(makeTree({ 'home/.claude/CLAUDE.md': '# Default\n', 'work-config/CLAUDE.md': '# Work account\n', 'estate/readme.txt': 'x\n' }))

  const report = budgetJson(root, 'estate', { CLAUDE_CONFIG_DIR: join(root, 'work-config') })

  assert.deepEqual(sources(report), [[join(root, 'work-config/CLAUDE.md'), 'user']])
})

test('where a map covers the folder, the size of the session-start index is added', () => {
  const root = tree(acme())
  const index = [
    `Context map "Acme estate": ${root}`,
    `Hub: ${root}/CLAUDE.md`,
    'Work in flight (1):',
    `- PROJ-12 | Rate limit the gateway | ${root}/work/PROJ-12/STATE.md`,
    LAST_INDEX_LINE,
  ].join('\n')

  const result = budget(root, '.')

  assert.match(result.stdout, new RegExp(`\nPlugin hooks add: index ${index.length} characters at session start\n$`))
  assert.deepEqual(budgetJson(root, '.').plugin, { indexChars: index.length })
})

test('the index is measured with the mark it carries when the hub is missing', () => {
  const root = tree(acme())
  rmSync(join(root, 'CLAUDE.md'))
  const index = [
    `Context map "Acme estate": ${root}`,
    `Hub: ${root}/CLAUDE.md (missing)`,
    'Work in flight (1):',
    `- PROJ-12 | Rate limit the gateway | ${root}/work/PROJ-12/STATE.md`,
    LAST_INDEX_LINE,
  ].join('\n')

  assert.deepEqual(budgetJson(root, '.').plugin, { indexChars: index.length })
})

test('the index is measured as cut when its budget shortens the list', () => {
  const root = tree(acme({ 'work/PROJ-13/STATE.md': '# PROJ-13: Split the portal\n', 'work/PROJ-14/STATE.md': '# PROJ-14: Retire the old gateway\n' }, { budgets: { indexChars: 120 } }))
  const index = [`Context map "Acme estate": ${root}`, `Hub: ${root}/CLAUDE.md`, 'Work in flight (3):', '- and 3 more: context-central work list', LAST_INDEX_LINE].join('\n')

  assert.deepEqual(budgetJson(root, 'web').plugin, { indexChars: index.length })
})

test('a folder with no instruction files reports an empty total', () => {
  const root = tree(makeTree({ 'estate/readme.txt': 'x\n' }))

  assert.equal(budget(root, 'estate').stdout, [`Loaded at launch for a session started in ${root}/estate:`, 'Total: 0 B in 0 files, about 0 to 0 tokens', ''].join('\n'))
})

test('the token range is the bytes over 4 and over 2.7, to the nearest hundred', () => {
  const root = tree(makeTree({ 'estate/CLAUDE.md': `${'x'.repeat(10799)}\n` }))

  assert.match(budget(root, 'estate').stdout, /\nTotal: 11 KB in 1 file, about 2,700 to 4,000 tokens\n$/)
  assert.deepEqual(budgetJson(root, 'estate').total, { bytes: 10800, files: 1, tokens: { low: 2700, high: 4000 } })
})

test('rules reached through a link are counted like any other', () => {
  const root = tree(
    makeTree({
      'shared/style.md': '# Style\n',
      'shared/team/tests.md': '# Tests\n',
      'shared/team/routes.md': SCOPED_RULE,
      'estate/.claude/rules/own.md': '# Own\n',
    }),
  )
  symlinkSync(join(root, 'shared/style.md'), join(root, 'estate/.claude/rules/style.md'))
  symlinkSync(join(root, 'shared/team'), join(root, 'estate/.claude/rules/team'))
  symlinkSync(join(root, 'shared/gone.md'), join(root, 'estate/.claude/rules/gone.md'))

  const report = budgetJson(root, 'estate')

  assert.deepEqual(sources(report), [
    [join(root, 'estate/.claude/rules/own.md'), 'project rule'],
    [join(root, 'estate/.claude/rules/style.md'), 'project rule'],
    [join(root, 'estate/.claude/rules/team/tests.md'), 'project rule'],
  ])
  assert.deepEqual(report.notLoaded, { pathScopedRules: 1 })
})

test('a file is marked against the hub budget the map sets', () => {
  const root = tree(acme({}, { budgets: { hubLines: 5 } }))

  assert.match(budget(root, '.').stdout, /\/CLAUDE\.md \(ancestor\) over 5 lines\n/)
})

test('where the hooks stay silent, no plugin line is printed', () => {
  const root = tree(acme())

  assert.doesNotMatch(budget(root, 'scratch').stdout, /Plugin hooks/)
  assert.equal(budgetJson(root, 'scratch').plugin, null)
})

test('a folder that does not exist is refused', () => {
  const root = tree(makeTree({ 'readme.txt': 'x\n' }))

  const result = run(['budget', 'missing'], { cwd: root })

  assert.equal(result.code, 1)
  assert.match(result.stderr, /missing is not a folder/)
})
