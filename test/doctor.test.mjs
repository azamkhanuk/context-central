import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { ACME_CONFIG, EXE_NAMES, NEEDS_STAND_IN, acme, disposable, makeTree, onlyOnWindows, run } from './helpers.mjs'

const tree = disposable()

function sandbox(stubs = {}, homeFiles = {}) {
  const bin = tree(makeTree(Object.fromEntries(Object.entries(stubs).map(([name, body]) => [name, `#!/bin/sh\n${body}\n`]))))
  for (const name of Object.keys(stubs)) chmodSync(join(bin, name), 0o755)
  const home = tree(makeTree({ '.keep': '', ...homeFiles }))
  return { PATH: bin, HOME: home }
}

const doctor = (root, env = sandbox(), ...flags) => run(['doctor', ...flags], { cwd: root, env })

const GIT_IGNORING_WEB_ONLY = 'case "$*" in *rev-parse*) echo true ;; *"check-ignore -q web") exit 0 ;; *) exit 1 ;; esac'
const GIT_IGNORING_BOTH = 'case "$*" in *rev-parse*) echo true ;; *) exit 0 ;; esac'
const GH_PRESENT = 'exit 0'
const GH_ACTIVE_ACME_BOT = `/bin/cat <<'OUT'
github.com
  ✓ Logged in to github.com account someone-else (keyring)
  - Active account: false
  ✓ Logged in to github.com account acme-bot (keyring)
  - Active account: true
OUT`
const GH_ACTIVE_SOMEONE_ELSE = `/bin/cat <<'OUT'
github.com
  ✓ Logged in to github.com account someone-else (keyring)
  - Active account: true
  ✓ Logged in to github.com account acme-bot (keyring)
  - Active account: false
OUT`
const GH_BEFORE_ACCOUNT_SWITCHING = `/bin/cat <<'OUT' >&2
github.com
  ✓ Logged in to github.com as acme-bot (oauth_token)
OUT`
const GIT_OUTSIDE_A_REPOSITORY = 'echo "fatal: not a git repository" >&2; exit 128'
const GITHUB = { codeHost: { type: 'github' } }
const GITHUB_AS_BOT = { codeHost: { type: 'github', ghUser: 'acme-bot' } }
const LEGACY = { legacyHooks: ['old-resolver.mjs'] }
const commandHook = command => ({ hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command }] }] } })
const LEGACY_HOOK = commandHook('node ~/tools/old-resolver.mjs resolve')
const legacyHookOf = root => commandHook(`node ${root}/bin/old-resolver.mjs --hook`)
const BACKSLASHES = onlyOnWindows('only Windows reads a backslash in a hook command as a separator')
const hooksLine = result => result.stdout.split('\n').find(line => line.includes('hooks'))
const olderHookIn = file => `FIX  hooks: an older hook (old-resolver.mjs) for this estate is still set in ${file}; remove it so prompts are not resolved twice`
const OTHER_HOOK = { hooks: { UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'node ~/tools/remind.mjs' }] }] } }

test('a healthy map passes every check', () => {
  const root = tree(acme())

  const result = doctor(root)

  assert.equal(result.stdout, ['ok   node', 'ok   config', 'ok   hub', 'ok   lint', 'ok   links', 'ok   repos', 'ok   git', 'ok   evidence', 'ok   hooks', 'ok   gh', ''].join('\n'))
  assert.equal(result.code, 0)
})

test('a config this version cannot read is the fix, and the checks that need it are not run', () => {
  const root = tree(acme({}, { contextCentral: 2 }))

  const result = doctor(root)

  assert.match(result.stdout, /^ok {3}node\nFIX {2}config: .*"contextCentral" is 2; this version reads 1\n$/)
  assert.equal(result.code, 1)
})

test('an answer on committing evidence that is not true or false is the config fix', () => {
  const root = tree(acme({}, { evidence: { commit: 'yes' } }))

  const result = doctor(root)

  assert.equal(result.stdout, `ok   node\nFIX  config: ${join(root, 'estate.json')}: "evidence.commit" must be true or false\n`)
  assert.equal(result.code, 1)
})

test('a folder with no map is told how to make one', () => {
  const root = tree(makeTree({ 'notes.md': '# Notes\n' }))

  const result = doctor(root)

  assert.match(result.stdout, /^FIX {2}config: no context map found from .*; run context-central init or \/context-central:onboard$/m)
  assert.equal(result.code, 1)
})

test('a missing hub is a fix', () => {
  const root = tree(acme({}, { hub: 'START.md' }))

  const result = doctor(root)

  assert.match(result.stdout, /^FIX {2}hub: START\.md does not exist; write it, or point "hub" in estate\.json at the file that is there$/m)
  assert.equal(result.code, 1)
})

test('lint errors are counted and the lint command is named', () => {
  const state = `# PROJ-13\n${'a'.repeat(395)}`
  const root = tree(acme({ 'work/PROJ-13/STATE.md': state }, { budgets: { stateChars: 400 } }))

  const result = doctor(root)

  assert.match(result.stdout, /^FIX {2}lint: 1 error; run context-central lint$/m)
  assert.equal(result.code, 1)
})

test('lint warnings alone do not need fixing', () => {
  const root = tree(acme({ 'work/PROJ-7.md': '# PROJ-7: Old shape\n' }))

  const result = doctor(root)

  assert.match(result.stdout, /^ok {3}lint$/m)
  assert.equal(result.code, 0)
})

test('broken links are counted and the graph command is named', () => {
  const root = tree(acme({ 'repos/web.md': '# web\n\nSee [[concepts/missing]] and [[concepts/gone]].\n' }))

  const result = doctor(root)

  assert.match(result.stdout, /^FIX {2}links: 2 broken links; run context-central graph$/m)
  assert.equal(result.code, 1)
})

test('a registered repo with no folder is a fix', () => {
  const root = tree(acme({}, { repos: [...ACME_CONFIG.repos, { name: 'mobile' }, { name: 'batch', path: 'services/batch' }] }))

  const result = doctor(root)

  assert.match(result.stdout, /^FIX {2}repos: no folder at mobile, services\/batch; clone there, or take the entry out of estate\.json$/m)
  assert.equal(result.code, 1)
})

test('a checkout the map repository does not ignore is a fix', NEEDS_STAND_IN, () => {
  const root = tree(acme())

  const result = doctor(root, sandbox({ git: GIT_IGNORING_WEB_ONLY }))

  assert.match(result.stdout, /^FIX {2}git: api is not ignored; git add there could stage a checkout; add an allowlist \.gitignore$/m)
  assert.equal(result.code, 1)
})

test('checkouts the map repository ignores are fine', NEEDS_STAND_IN, () => {
  const root = tree(acme())

  const result = doctor(root, sandbox({ git: GIT_IGNORING_BOTH }))

  assert.match(result.stdout, /^ok {3}git$/m)
  assert.equal(result.code, 0)
})

test('a map inside a repository is not asked whether git ignores its repos', NEEDS_STAND_IN, () => {
  const root = tree(
    makeTree({
      '.context-central/estate.json': { contextCentral: 1, name: 'solo', repos: [{ name: 'api', path: 'packages/api' }] },
      'CLAUDE.md': '# Solo\n',
      'packages/api/README.md': '# api\n',
    }),
  )

  const result = doctor(root, sandbox({ git: GIT_IGNORING_WEB_ONLY }))

  assert.match(result.stdout, /^ok {3}git$/m)
  assert.equal(result.code, 0)
})

test('a repo that is the estate root itself is not expected to be ignored', NEEDS_STAND_IN, () => {
  const root = tree(acme({}, { repos: [{ name: 'web' }, { name: 'estate', path: '.' }] }))

  const result = doctor(root, sandbox({ git: GIT_IGNORING_WEB_ONLY }))

  assert.match(result.stdout, /^ok {3}git$/m)
  assert.equal(result.code, 0)
})

test('a repo folder that is not there is not asked about in git', NEEDS_STAND_IN, () => {
  const root = tree(acme({}, { repos: [...ACME_CONFIG.repos, { name: 'mobile' }] }))

  const result = doctor(root, sandbox({ git: GIT_IGNORING_WEB_ONLY }))

  assert.match(result.stdout, /^FIX {2}git: api is not ignored;/m)
})

test('real git is started by its bare name and asked which checkouts it ignores', () => {
  const root = tree(acme())
  const env = realGit()
  spawnSync('git', ['-C', root, 'init', '-q'], { env })

  const result = doctor(root, env)

  assert.equal(
    result.stdout.split('\n').find(line => line.includes(' git')),
    'FIX  git: web, api are not ignored; git add there could stage a checkout; add an allowlist .gitignore',
  )
  assert.equal(result.code, 1)
})

test('with no legacy hooks listed, the hooks check passes whatever the settings hold', () => {
  const root = tree(acme({ '.claude/settings.json': LEGACY_HOOK }))

  const result = doctor(root, sandbox({}, { '.claude/settings.json': legacyHookOf(root) }))

  assert.equal(hooksLine(result), 'ok   hooks')
  assert.equal(result.code, 0)
})

test('a legacy hook in the user settings that names this estate is a fix that names the file', () => {
  const root = tree(acme({}, LEGACY))
  const env = sandbox({}, { '.claude/settings.json': legacyHookOf(root) })

  const result = doctor(root, env)

  assert.equal(hooksLine(result), olderHookIn(join(env.HOME, '.claude/settings.json')))
  assert.equal(result.code, 1)
})

test('the user settings are read from the Claude config folder when one is set', () => {
  const root = tree(acme({}, LEGACY))
  const configDir = tree(makeTree({ 'settings.json': legacyHookOf(root) }))

  const result = doctor(root, { ...sandbox(), CLAUDE_CONFIG_DIR: configDir })

  assert.equal(hooksLine(result), olderHookIn(join(configDir, 'settings.json')))
})

test("a legacy hook in the estate's own settings is a fix wherever its command points", () => {
  const root = tree(acme({ '.claude/settings.local.json': LEGACY_HOOK }, LEGACY))

  const result = doctor(root)

  assert.equal(hooksLine(result), olderHookIn(join(root, '.claude/settings.local.json')))
  assert.equal(result.code, 1)
})

test("another estate's legacy hook in the user settings is left alone", () => {
  const root = tree(acme({}, LEGACY))

  const result = doctor(root, sandbox({}, { '.claude/settings.json': LEGACY_HOOK }))

  assert.equal(hooksLine(result), 'ok   hooks')
})

test('a legacy hook for a sibling folder whose name starts with this estate root is left alone', () => {
  const root = tree(acme({}, LEGACY))

  const result = doctor(root, sandbox({}, { '.claude/settings.json': legacyHookOf(`${root}-archive`) }))

  assert.equal(hooksLine(result), 'ok   hooks')
})

test('a legacy hook that names this estate through $HOME is a fix', () => {
  const home = tree(
    makeTree({
      'estates/acme/estate.json': { ...ACME_CONFIG, ...LEGACY, repos: [] },
      'estates/acme/CLAUDE.md': '# Acme estate\n',
      '.claude/settings.json': commandHook('node "$HOME/estates/acme" --hook old-resolver.mjs'),
    }),
  )

  const result = doctor(join(home, 'estates/acme'), { ...sandbox(), HOME: home })

  assert.equal(hooksLine(result), olderHookIn(join(home, '.claude/settings.json')))
})

test('a legacy hook that names this estate with backslashes all the way is a fix', BACKSLASHES, () => {
  const root = tree(acme({}, LEGACY))
  const env = sandbox({}, { '.claude/settings.json': commandHook(`node ${root}\\bin\\old-resolver.mjs --hook`) })

  assert.equal(hooksLine(doctor(root, env)), olderHookIn(join(env.HOME, '.claude/settings.json')))
})

test('a legacy hook that names this estate with forward slashes all the way is a fix', BACKSLASHES, () => {
  const root = tree(acme({}, LEGACY))
  const env = sandbox({}, { '.claude/settings.json': commandHook(`node ${root.replaceAll('\\', '/')}/bin/old-resolver.mjs --hook`) })

  assert.equal(hooksLine(doctor(root, env)), olderHookIn(join(env.HOME, '.claude/settings.json')))
})

test('a sibling folder is left alone whichever separator the hook command uses', BACKSLASHES, () => {
  const root = tree(acme({}, LEGACY))
  const written = [`node ${root}-archive\\bin\\old-resolver.mjs --hook`, `node ${root.replaceAll('\\', '/')}-archive/bin/old-resolver.mjs --hook`]

  for (const command of written) {
    assert.equal(hooksLine(doctor(root, sandbox({}, { '.claude/settings.json': commandHook(command) }))), 'ok   hooks')
  }
})

test('hooks that are not legacy hooks, and legacy names outside a hook command, are fine', () => {
  const root = tree(acme({ '.claude/settings.json': OTHER_HOOK }, LEGACY))

  const result = doctor(root, sandbox({}, { '.claude/settings.json': { model: `${root}/old-resolver.mjs`, ...OTHER_HOOK } }))

  assert.equal(hooksLine(result), 'ok   hooks')
  assert.equal(result.code, 0)
})

test('a GitHub estate without gh on the path is a fix', () => {
  const root = tree(acme({}, GITHUB))

  const result = doctor(root)

  assert.match(result.stdout, /^FIX {2}gh: gh is not on PATH; install the GitHub CLI$/m)
  assert.equal(result.code, 1)
})

test('a GitHub tracker needs gh as well', () => {
  const root = tree(acme({}, { tracker: { type: 'github' } }))

  assert.match(doctor(root).stdout, /^FIX {2}gh: gh is not on PATH;/m)
})

test('a GitHub estate with gh on the path is fine', NEEDS_STAND_IN, () => {
  const root = tree(acme({}, GITHUB))

  const result = doctor(root, sandbox({ gh: GH_PRESENT }))

  assert.match(result.stdout, /^ok {3}gh$/m)
  assert.equal(result.code, 0)
})

test('a GitHub estate with gh.exe on the path is fine', EXE_NAMES, () => {
  const root = tree(acme({}, GITHUB))

  const result = doctor(root, { ...sandbox(), PATH: tree(makeTree({ 'gh.exe': '' })) })

  assert.match(result.stdout, /^ok {3}gh$/m)
  assert.equal(result.code, 0)
})

test('the configured gh account being the active one is fine', NEEDS_STAND_IN, () => {
  const root = tree(acme({}, GITHUB_AS_BOT))

  const result = doctor(root, sandbox({ gh: GH_ACTIVE_ACME_BOT }))

  assert.match(result.stdout, /^ok {3}gh$/m)
  assert.equal(result.code, 0)
})

test('a different active gh account is a fix that gives the token prefix', NEEDS_STAND_IN, () => {
  const root = tree(acme({}, GITHUB_AS_BOT))

  const result = doctor(root, sandbox({ gh: GH_ACTIVE_SOMEONE_ELSE }))

  assert.equal(
    result.stdout.split('\n').find(line => line.includes(' gh')),
    'FIX  gh: the active gh account is not acme-bot; run gh auth switch --user acme-bot, or start each gh command with GH_TOKEN=$(gh auth token --user acme-bot)',
  )
  assert.equal(result.code, 1)
})

test('the gh account matches whatever its letter case', NEEDS_STAND_IN, () => {
  const root = tree(acme({}, { codeHost: { type: 'github', ghUser: 'Acme-Bot' } }))

  const result = doctor(root, sandbox({ gh: GH_ACTIVE_ACME_BOT }))

  assert.match(result.stdout, /^ok {3}gh$/m)
})

test('a gh from before account switching, logged in as the configured account, is fine', NEEDS_STAND_IN, () => {
  const root = tree(acme({}, GITHUB_AS_BOT))

  const result = doctor(root, sandbox({ gh: GH_BEFORE_ACCOUNT_SWITCHING }))

  assert.match(result.stdout, /^ok {3}gh$/m)
})

test('a gh from before account switching, logged in as someone else, is a fix', NEEDS_STAND_IN, () => {
  const root = tree(acme({}, { codeHost: { type: 'github', ghUser: 'acme-deploy' } }))

  const result = doctor(root, sandbox({ gh: GH_BEFORE_ACCOUNT_SWITCHING }))

  assert.match(result.stdout, /^FIX {2}gh: the active gh account is not acme-deploy;/m)
})

test('a gh account in the config needs gh even when no code host type is given', () => {
  const root = tree(acme({}, { codeHost: { ghUser: 'acme-bot' } }))

  const result = doctor(root)

  assert.match(result.stdout, /^FIX {2}gh: gh is not on PATH; install the GitHub CLI$/m)
  assert.equal(result.code, 1)
})

test('a registered repo path that holds a file, not a folder, is a fix', () => {
  const root = tree(acme({ mobile: 'not a checkout\n' }, { repos: [...ACME_CONFIG.repos, { name: 'mobile' }] }))

  const result = doctor(root)

  assert.match(result.stdout, /^FIX {2}repos: no folder at mobile;/m)
})

test('an estate that is not a git repository passes the git check', NEEDS_STAND_IN, () => {
  const root = tree(acme())

  const result = doctor(root, sandbox({ git: GIT_OUTSIDE_A_REPOSITORY }))

  assert.match(result.stdout, /^ok {3}git$/m)
  assert.equal(result.code, 0)
})

test('a hub path that is a folder is a fix, not a crash', () => {
  const root = tree(acme({ 'guide/readme.md': '# Guide\n' }, { hub: 'guide' }))

  const result = doctor(root)

  assert.match(result.stdout, /^FIX {2}hub: guide does not exist;/m)
  assert.match(result.stdout, /^FIX {2}lint: 1 error; run context-central lint$/m)
  assert.equal(result.stderr, '')
})

test('json lists every check with its fix', () => {
  const root = tree(acme({}, GITHUB))

  const result = doctor(root, sandbox(), '--json')

  assert.deepEqual(JSON.parse(result.stdout), [
    { check: 'node', ok: true, fix: null },
    { check: 'config', ok: true, fix: null },
    { check: 'hub', ok: true, fix: null },
    { check: 'lint', ok: true, fix: null },
    { check: 'links', ok: true, fix: null },
    { check: 'repos', ok: true, fix: null },
    { check: 'git', ok: true, fix: null },
    { check: 'evidence', ok: true, fix: null },
    { check: 'hooks', ok: true, fix: null },
    { check: 'gh', ok: false, fix: 'gh is not on PATH; install the GitHub CLI' },
  ])
  assert.equal(result.code, 1)
})

const SHOT = 'work/PROJ-12/evidence/2026-01-14-limit-reached.png'
const TRACE = 'work/PROJ-12/evidence/2026-01-14-trace.json'
const NO_REPOS = { repos: [] }

function realGit() {
  const home = tree(makeTree({ gitconfig: '' }))
  return { PATH: process.env.PATH, HOME: home, GIT_CONFIG_GLOBAL: join(home, 'gitconfig'), GIT_CONFIG_NOSYSTEM: '1' }
}

function repository(files, config = {}) {
  const root = tree(acme(files, { ...NO_REPOS, ...config }))
  const env = realGit()
  spawnSync('git', ['-C', root, 'init', '-q'], { env })
  return { root, env }
}

const evidenceLine = result => result.stdout.split('\n').find(line => line.includes(' evidence'))

test('evidence set to stay out of git that git does not ignore is a fix naming both ways out', () => {
  const { root, env } = repository({ [SHOT]: 'x' })

  const result = doctor(root, env)

  assert.equal(
    evidenceLine(result),
    `FIX  evidence: evidence is set to stay out of git and git does not ignore ${SHOT}; ignore /work/*/evidence/ in the map's .gitignore, or set "evidence.commit" to true in estate.json`,
  )
  assert.equal(result.code, 1)
})

test('evidence set to be committed that git ignores is a fix that names the first file and counts the rest', () => {
  const { root, env } = repository({ [SHOT]: 'x', [TRACE]: 'x', 'work/PROJ-13/evidence/kept.png': 'x', '.gitignore': '/work/PROJ-12/evidence/\n' }, { evidence: { commit: true } })

  const result = doctor(root, env)

  assert.equal(
    evidenceLine(result),
    `FIX  evidence: evidence is set to be committed and git ignores ${SHOT} and 1 more; take out the ignore rule, or set "evidence.commit" to false in estate.json`,
  )
  assert.equal(result.code, 1)
})

test('evidence passes when git and the setting agree', () => {
  const kept = repository({ [SHOT]: 'x', [TRACE]: 'x' }, { evidence: { commit: true } })
  const left = repository({ [SHOT]: 'x', [TRACE]: 'x', '.gitignore': '/work/*/evidence/\n' })

  for (const { root, env } of [kept, left]) {
    const result = doctor(root, env)

    assert.equal(evidenceLine(result), 'ok   evidence')
    assert.equal(result.code, 0)
  }
})

test('evidence passes where the map is not in a git work tree, and where there is no evidence', () => {
  const outside = tree(acme({ [SHOT]: 'x' }, NO_REPOS))
  const none = repository({})

  assert.equal(evidenceLine(doctor(outside, realGit())), 'ok   evidence')
  assert.equal(evidenceLine(doctor(none.root, none.env)), 'ok   evidence')
})

test('an inner map is asked about its evidence too, and the ignore file init writes for it settles it', () => {
  const root = tree(
    makeTree({
      'answers.json': { layout: 'inner', git: true, config: { name: 'acme' } },
      '.context-central/estate.json': { contextCentral: 1, name: 'acme' },
      [`.context-central/${SHOT}`]: 'x',
    }),
  )
  const env = realGit()
  spawnSync('git', ['-C', root, 'init', '-q'], { env })

  const before = doctor(root, env)
  run(['init', '--from', 'answers.json'], { cwd: root })
  const after = doctor(root, env)

  assert.match(evidenceLine(before), new RegExp(`^FIX  evidence: evidence is set to stay out of git and git does not ignore ${SHOT.replaceAll('.', '\\.')}; `))
  assert.equal(evidenceLine(after), 'ok   evidence')
})

test('evidence that git already tracks is a fix that says to take it out of the index, not to ignore it again', () => {
  const { root, env } = repository({ [SHOT]: 'x', [TRACE]: 'x', '.gitignore': '/work/*/evidence/\n' })
  spawnSync('git', ['-C', root, 'add', '-f', SHOT], { env })

  const result = doctor(root, env)

  assert.equal(
    evidenceLine(result),
    `FIX  evidence: evidence is set to stay out of git and git already tracks ${SHOT}; run git rm --cached on it, or set "evidence.commit" to true in estate.json`,
  )
  assert.equal(result.code, 1)
})

test('tracked evidence with no ignore rule is first told to ignore the folder, and several tracked files are counted', () => {
  const unruled = repository({ [SHOT]: 'x' })
  const ruled = repository({ [SHOT]: 'x', [TRACE]: 'x', '.gitignore': '/work/*/evidence/\n' })
  spawnSync('git', ['-C', unruled.root, 'add', '-f', SHOT], { env: unruled.env })
  spawnSync('git', ['-C', ruled.root, 'add', '-f', SHOT, TRACE], { env: ruled.env })

  assert.match(evidenceLine(doctor(unruled.root, unruled.env)), /git does not ignore work\/PROJ-12\/evidence\/2026-01-14-limit-reached\.png; ignore \/work\/\*\/evidence\/ in the map's \.gitignore/)
  assert.equal(
    evidenceLine(doctor(ruled.root, ruled.env)),
    `FIX  evidence: evidence is set to stay out of git and git already tracks ${SHOT} and 1 more; run git rm --cached on each, or set "evidence.commit" to true in estate.json`,
  )
})
