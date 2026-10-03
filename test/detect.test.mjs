import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, symlinkSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { test } from 'node:test'
import { acme, disposable, makeTree, run } from './helpers.mjs'

const tree = disposable()

const REAL_GIT = process.env.PATH.split(delimiter)
  .map(dir => join(dir, 'git'))
  .find(existsSync)

const GH_TWO_ACCOUNTS = `#!/bin/sh
echo 'github.com'
echo '  Logged in to github.com account someone (keyring)'
echo '  - Active account: true'
echo '  - Token: gho_0123456789abcdef'
echo ''
echo '  Logged in to github.com account another (keyring)'
echo '  - Active account: false'
echo '  - Token: gho_fedcba9876543210'
`

function toolsDir(scripts = {}) {
  const dir = tree(makeTree(scripts))
  for (const name of Object.keys(scripts)) chmodSync(join(dir, name), 0o755)
  symlinkSync(REAL_GIT, join(dir, 'git'))
  return dir
}

function git(root, repo, ...args) {
  const result = spawnSync(REAL_GIT, ['-C', join(root, repo), ...args], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: root, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
  })
  assert.equal(result.status, 0, result.stderr)
}

function makeRepo(root, repo, { remote = null, originHead = null, branches = [] } = {}) {
  git(root, repo, 'init', '-q', '-b', 'main')
  git(root, repo, 'config', 'user.name', 'Test Person')
  git(root, repo, 'config', 'user.email', 'test@acme.example')
  git(root, repo, 'config', 'commit.gpgsign', 'false')
  git(root, repo, 'commit', '-q', '--allow-empty', '-m', 'start')
  if (remote) git(root, repo, 'remote', 'add', 'origin', remote)
  if (originHead) {
    git(root, repo, 'update-ref', `refs/remotes/origin/${originHead}`, 'HEAD')
    git(root, repo, 'symbolic-ref', 'refs/remotes/origin/HEAD', `refs/remotes/origin/${originHead}`)
  }
  for (const branch of branches) git(root, repo, 'checkout', '-q', '-b', branch)
}

function detect(root, { tools = toolsDir(), args = [] } = {}) {
  return run(['detect', ...args], { cwd: root, env: { PATH: tools, HOME: join(root, 'home') } })
}

const detectJson = (root, options) => JSON.parse(detect(root, { ...options, args: ['--json'] }).stdout)

test('a bare folder reports nothing found, and which tools are missing', () => {
  const root = tree(makeTree({ 'readme.txt': 'nothing here\n' }))

  assert.deepEqual(detectJson(root), {
    dir: root,
    existingMap: null,
    repos: [],
    instructionFiles: [],
    nodeDirs: [],
    keyCandidates: [],
    mcpServers: [],
    tools: { git: true, gh: false, acli: false },
    ghAccounts: [],
    configDir: join(root, 'home', '.claude'),
    glossaryCandidates: [],
  })
})

test('each checkout one level down is reported with its remote and branches', () => {
  const root = tree(makeTree({ 'web/README.md': '# web\n', 'api/README.md': '# api\n', 'notes/todo.md': '# not a repo\n' }))
  makeRepo(root, 'web', { remote: 'git@github.com:acme/web.git', originHead: 'main', branches: ['feature/PROJ-14-limits'] })
  makeRepo(root, 'api')

  assert.deepEqual(detectJson(root).repos, [
    { name: 'api', path: 'api', remote: null, host: null, org: null, defaultBranch: null, currentBranch: 'main' },
    {
      name: 'web',
      path: 'web',
      remote: 'git@github.com:acme/web.git',
      host: 'github.com',
      org: 'acme',
      defaultBranch: 'main',
      currentBranch: 'feature/PROJ-14-limits',
    },
  ])
})

test('the folder itself is reported when it is a checkout', () => {
  const root = tree(makeTree({ 'solo/README.md': '# solo\n' }))
  makeRepo(root, 'solo', { remote: 'https://github.com/acme/solo.git' })

  const result = run(['detect', 'solo', '--json'], { cwd: root, env: { PATH: toolsDir(), HOME: join(root, 'home') } })

  assert.deepEqual(JSON.parse(result.stdout).repos, [
    { name: 'solo', path: '.', remote: 'https://github.com/acme/solo.git', host: 'github.com', org: 'acme', defaultBranch: null, currentBranch: 'main' },
  ])
})

test('a token held in a remote address is never printed', () => {
  const root = tree(makeTree({ 'api/README.md': '# api\n' }))
  makeRepo(root, 'api', { remote: 'https://someone:tok_secret@github.com/acme/api.git' })

  const result = detect(root, { args: ['--json'] })

  assert.equal(JSON.parse(result.stdout).repos[0].remote, 'https://github.com/acme/api.git')
  assert.doesNotMatch(result.stdout, /tok_secret/)
  assert.doesNotMatch(detect(root).stdout, /tok_secret/)
})

test('a password held in an ssh remote address is never printed', () => {
  const root = tree(makeTree({ 'api/README.md': '# api\n' }))
  makeRepo(root, 'api', { remote: 'ssh://git:tok_secret@git.acme.example:22/acme/api.git' })

  const result = detect(root, { args: ['--json'] })

  assert.deepEqual(JSON.parse(result.stdout).repos[0], {
    name: 'api',
    path: 'api',
    remote: 'ssh://git@git.acme.example:22/acme/api.git',
    host: 'git.acme.example',
    org: 'acme',
    defaultBranch: null,
    currentBranch: 'main',
  })
  assert.doesNotMatch(detect(root).stdout, /tok_secret/)
})

test('a checkout with no branch checked out reports none', () => {
  const root = tree(makeTree({ 'api/README.md': '# api\n' }))
  makeRepo(root, 'api')
  git(root, 'api', 'checkout', '-q', '--detach')

  assert.equal(detectJson(root).repos[0].currentBranch, null)
  assert.match(detect(root).stdout, /^- api \(api\) no remote, default branch unknown, no branch checked out$/m)
})

test('a link that points nowhere is passed over', () => {
  const root = tree(makeTree({ 'web/AGENTS.md': '# web\n' }))
  symlinkSync(join(root, 'gone.md'), join(root, 'CLAUDE.md'))
  symlinkSync(join(root, 'gone.md'), join(root, 'glossary.md'))
  symlinkSync(join(root, 'gone.json'), join(root, 'web', '.mcp.json'))
  symlinkSync(join(root, 'gone'), join(root, 'work'))

  const result = detect(root, { args: ['--json'] })

  assert.equal(result.code, 0)
  assert.deepEqual(JSON.parse(result.stdout).instructionFiles, [{ rel: 'web/AGENTS.md', bytes: 6, lines: 1 }])
})

test('instruction files are sized in the folder and one level down', () => {
  const root = tree(
    makeTree({
      'CLAUDE.md': '# Acme\n\nNotes.\n',
      'web/AGENTS.md': '# web\n',
      'web/CLAUDE.local.md': 'mine\n',
      'web/src/CLAUDE.md': '# too deep\n',
    }),
  )

  assert.deepEqual(detectJson(root).instructionFiles, [
    { rel: 'CLAUDE.md', bytes: 15, lines: 3 },
    { rel: 'web/CLAUDE.local.md', bytes: 5, lines: 1 },
    { rel: 'web/AGENTS.md', bytes: 6, lines: 1 },
  ])
})

test('key patterns are proposed from work folders and branch names, most frequent first', () => {
  const root = tree(
    makeTree({
      'work/PROJ-12/STATE.md': '# PROJ-12\n',
      'work/PROJ-13.md': '# PROJ-13\n',
      'work/portal-split/STATE.md': '# Split the portal\n',
      'web/README.md': '# web\n',
    }),
  )
  makeRepo(root, 'web', { originHead: 'main', branches: ['feature/PROJ-14-limits', 'OPS-3-fix'] })

  assert.deepEqual(detectJson(root).keyCandidates, [
    { pattern: 'PROJ-\\d+', seen: 3, examples: ['PROJ-12', 'PROJ-13', 'PROJ-14'] },
    { pattern: 'OPS-\\d+', seen: 1, examples: ['OPS-3'] },
  ])
})

test('node folders already present are listed', () => {
  const root = tree(makeTree({ 'work/PROJ-12/STATE.md': '# PROJ-12\n', 'concepts/gateway.md': '# The gateway\n', 'other/x.md': '# x\n' }))

  assert.deepEqual(detectJson(root).nodeDirs, ['concepts', 'work'])
})

test('MCP servers are reported by name only', () => {
  const root = tree(
    makeTree({
      '.mcp.json': { mcpServers: { tracker: { command: 'tracker-mcp', env: { TRACKER_TOKEN: 'tok_secret' } } } },
      'web/.mcp.json': { mcpServers: { browser: { command: 'browser-mcp' }, design: { command: 'design-mcp' } } },
      'api/.mcp.json': 'not json',
    }),
  )

  const result = detect(root, { args: ['--json'] })

  assert.deepEqual(JSON.parse(result.stdout).mcpServers, [
    { file: '.mcp.json', names: ['tracker'] },
    { file: 'web/.mcp.json', names: ['browser', 'design'] },
  ])
  assert.doesNotMatch(result.stdout, /tok_secret/)
})

test('the content of an env file is never printed', () => {
  const root = tree(makeTree({ '.env': 'API_KEY=tok_secret\n', 'web/.env': 'API_KEY=tok_secret\n' }))

  assert.doesNotMatch(detect(root, { args: ['--json'] }).stdout, /tok_secret/)
})

test('gh accounts are listed with the active one marked, and no token', () => {
  const root = tree(makeTree({ 'readme.txt': 'x\n' }))

  const result = detect(root, { tools: toolsDir({ gh: GH_TWO_ACCOUNTS }), args: ['--json'] })
  const facts = JSON.parse(result.stdout)

  assert.deepEqual(facts.ghAccounts, [
    { user: 'someone', active: true },
    { user: 'another', active: false },
  ])
  assert.equal(facts.tools.gh, true)
  assert.doesNotMatch(result.stdout, /gho_/)
})

test('a glossary already on disk is offered as a candidate', () => {
  const root = tree(makeTree({ 'CONTEXT.md': '# Terms\n', 'web/glossary.md': '# Glossary\n', 'web/README.md': '# web\n' }))

  assert.deepEqual(detectJson(root).glossaryCandidates, ['CONTEXT.md', 'web/glossary.md'])
})

test('an existing map is reported with its layout', () => {
  const root = tree(acme())

  assert.deepEqual(detectJson(root).existingMap, { layout: 'root', configPath: join(root, 'estate.json'), estateRoot: root, mapDir: root })
})

test('the config dir follows CLAUDE_CONFIG_DIR', () => {
  const root = tree(makeTree({ 'readme.txt': 'x\n' }))

  const result = run(['detect', '--json'], { cwd: root, env: { PATH: toolsDir(), HOME: join(root, 'home'), CLAUDE_CONFIG_DIR: join(root, 'other-config') } })

  assert.equal(JSON.parse(result.stdout).configDir, join(root, 'other-config'))
})

test('without --json the same facts are short lines', () => {
  const root = tree(makeTree({ 'CLAUDE.md': '# Acme\n\nNotes.\n', 'work/PROJ-12/STATE.md': '# PROJ-12\n', 'web/README.md': '# web\n' }))
  makeRepo(root, 'web', { remote: 'git@github.com:acme/web.git', originHead: 'main' })

  const result = detect(root, { tools: toolsDir({ gh: GH_TWO_ACCOUNTS }) })

  assert.equal(
    result.stdout,
    [
      `Folder: ${root}`,
      'Existing map: none',
      'Repos (1):',
      '- web (web) git@github.com:acme/web.git, default branch main, on main',
      'Instruction files (1):',
      '- CLAUDE.md (15 B, 3 lines)',
      'Node folders: work',
      'Key candidates (1):',
      '- PROJ-\\d+ seen 1 time, for example PROJ-12',
      'MCP servers: none',
      'Tools: git yes, gh yes, acli no',
      'gh accounts: someone (active), another',
      `Config dir: ${join(root, 'home', '.claude')}`,
      'Glossary candidates: none',
      '',
    ].join('\n'),
  )
})

test('a folder that does not exist is refused', () => {
  const root = tree(makeTree({ 'readme.txt': 'x\n' }))

  const result = run(['detect', 'missing'], { cwd: root })

  assert.equal(result.code, 1)
  assert.match(result.stderr, /missing is not a folder/)
})
