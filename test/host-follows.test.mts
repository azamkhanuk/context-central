import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { acme, checkout, disposable, hook, makeTree, run, spawned, workTree } from './helpers.mts'
import type { Env, TreeFiles } from './helpers.mts'

const tree = disposable()

type BudgetReport = { files: { path: string, source: string }[], notLoaded: { pathScopedRules: number }, plugin: { indexChars: number, hubChars?: number } | null }
type Facts = { configDir: string, instructionFiles: { rel: string }[], mcpServers: { file: string, names: string[] }[] }

const ON_COPILOT = { COPILOT_AGENT_SESSION_ID: 's1' }
const ON_CLAUDE_CODE = { CLAUDECODE: '1' }
const AS_COPILOTS_HOOK = { COPILOT_PLUGIN_ROOT: '/plugins/context-central' }
const COPILOTS_OWN = '.github/copilot-instructions.md'
const MAP = '.context-central'
const BLOCK = '<!-- context-central:start -->'
const HUB = '# Acme estate\n\nA task about a screen goes to `web`.\n'
const SCOPED = '---\napplyTo: "src/**/*.ts"\n---\n# Only for source\n'

const home = (files: TreeFiles = {}) => tree(makeTree({ '.keep': '', ...files }))
const settings = (env: Env) => JSON.parse(run(['init', '--print-settings'], { env: { HOME: home(), ...env } }).stdout) as unknown
const plain = (cwd: string, env: Env, ...args: string[]) => run(['init', '--plain', ...args], { cwd, env: { HOME: home(), ...env } })
const hubOf = (dir: string, config = 'estate.json') => (JSON.parse(readFileSync(join(dir, config), 'utf8')) as { hub?: string }).hub
const started = (cwd: string) => (JSON.parse(hook('session-start', { sessionId: 's1', cwd, source: 'new' }, { env: { ...AS_COPILOTS_HOOK, CONTEXT_CENTRAL_STATE_DIR: tree(makeTree({})) } }).stdout) as { additionalContext: string }).additionalContext
const budget = (cwd: string, env: Env) => JSON.parse(run(['budget', '--json'], { cwd, env }).stdout) as BudgetReport
const sources = (report: BudgetReport) => report.files.map(file => [file.path, file.source])

test('the settings printed on Claude Code are the ones it has always printed, with the mark Claude Code sets and with no mark at all', () => {
  const claudes = {
    extraKnownMarketplaces: { azamkhanuk: { source: { source: 'github', repo: 'azamkhanuk/claude-plugins' }, autoUpdate: true } },
    enabledPlugins: { 'context-central@azamkhanuk': true },
    permissions: { allow: ['Bash(context-central *)'] },
  }

  assert.deepEqual(settings(ON_CLAUDE_CODE), claudes)
  assert.deepEqual(settings({}), claudes)
})

test("the settings printed on Copilot name the marketplace and turn the plugin on, for a repository's Copilot settings, and hold no permission and no auto-update, which Copilot takes from neither", () => {
  assert.deepEqual(settings(ON_COPILOT), {
    extraKnownMarketplaces: { azamkhanuk: { source: { source: 'github', repo: 'azamkhanuk/claude-plugins' } } },
    enabledPlugins: { 'context-central@azamkhanuk': true },
  })
})

test("a plain map made on Copilot in a folder that is no checkout and holds no hub is given Copilot's own instructions file as its hub, and a session that starts there is not given the hub a second time", () => {
  const dir = tree(makeTree({ 'notes.txt': 'x\n' }))

  const dry = plain(dir, ON_COPILOT, '--dry-run')
  const made = plain(dir, ON_COPILOT)

  assert.equal(dry.stdout.split('\n').includes(`would create ${COPILOTS_OWN}`), true, dry.stdout)
  assert.equal(made.code, 0, made.stderr)
  assert.equal(hubOf(dir), COPILOTS_OWN)
  assert.equal(readFileSync(join(dir, COPILOTS_OWN), 'utf8').includes(BLOCK), true)
  assert.equal(existsSync(join(dir, 'CLAUDE.md')), false)
  assert.equal(started(dir).includes('\n\nHub ('), false)
})

test("a plain map made on Copilot where Copilot's own instructions file is there already adds the map's block to that file and leaves what it held", () => {
  const dir = tree(makeTree({ [COPILOTS_OWN]: '# Build\n\nRun the tests before a commit.\n' }))

  const made = plain(dir, ON_COPILOT)

  assert.equal(made.stdout.split('\n').includes(`updated ${COPILOTS_OWN}`), true, made.stdout)
  assert.equal(readFileSync(join(dir, COPILOTS_OWN), 'utf8').startsWith('# Build\n\nRun the tests before a commit.\n\n' + BLOCK), true)
  assert.equal(hubOf(dir), COPILOTS_OWN)
})

test('a plain map made on Copilot in a checkout is given a hub inside the map, kept out of git, which the session-start hook gives since Copilot loads no file that one checkout keeps to itself', () => {
  const made = checkout({ 'README.md': '# Solo\n' })
  tree(made.base)

  const result = plain(made.main, { ...made.env, ...ON_COPILOT })

  assert.equal(result.code, 0, result.stderr)
  assert.equal(hubOf(made.main, `${MAP}/estate.json`), `${MAP}/hub.md`)
  assert.equal(existsSync(join(made.main, 'CLAUDE.local.md')), false)
  assert.equal(existsSync(join(made.main, '.github')), false)
  assert.equal(started(made.main).includes(`\n\nHub (${join(made.main, MAP, 'hub.md')}), which this host does not load by itself:\n`), true)
})

test("a plain map made on Copilot keeps the hub file a folder already holds, Claude Code's or the one any agent reads", () => {
  const withClaudes = tree(makeTree({ 'CLAUDE.md': HUB }))
  const withAgents = tree(makeTree({ 'AGENTS.md': HUB }))

  plain(withClaudes, ON_COPILOT)
  plain(withAgents, ON_COPILOT)

  assert.equal(hubOf(withClaudes), undefined)
  assert.equal(readFileSync(join(withClaudes, 'CLAUDE.md'), 'utf8').includes(BLOCK), true)
  assert.equal(hubOf(withAgents), 'AGENTS.md')
  for (const dir of [withClaudes, withAgents]) assert.equal(existsSync(join(dir, '.github')), false)
})

test("a plain map made on Claude Code is given the hub it has always been given, also in a folder that holds Copilot's own instructions file", () => {
  const empty = tree(makeTree({ 'notes.txt': 'x\n' }))
  const withCopilots = tree(makeTree({ [COPILOTS_OWN]: '# Build\n' }))
  const made = checkout({ 'README.md': '# Solo\n' })
  tree(made.base)

  for (const dir of [empty, withCopilots]) plain(dir, ON_CLAUDE_CODE)
  plain(made.main, { ...made.env, ...ON_CLAUDE_CODE })

  for (const dir of [empty, withCopilots]) {
    assert.equal(hubOf(dir), undefined)
    assert.equal(existsSync(join(dir, 'CLAUDE.md')), true)
  }
  assert.equal(readFileSync(join(withCopilots, COPILOTS_OWN), 'utf8'), '# Build\n')
  assert.equal(hubOf(made.main, `${MAP}/estate.json`), 'CLAUDE.local.md')
})

const ignoreFile = (config: Record<string, unknown>) => {
  const dir = tree(makeTree({ 'answers.json': { layout: 'root', git: true, config: { name: 'acme', ...config } } }))
  const made = run(['init', '--from', 'answers.json'], { cwd: dir })
  assert.equal(made.code, 0, made.stderr)
  return { dir, lines: readFileSync(join(dir, '.gitignore'), 'utf8').split('\n') }
}
const ignoredByGit = (dir: string, path: string) => spawned('git', ['check-ignore', '-q', path], { cwd: dir }).code === 0

test("a map kept in git at an estate's root takes back each folder its hub lies in and ignores what else that folder holds, so git tracks a hub in Copilot's own folder and nothing beside it", () => {
  const { dir, lines } = ignoreFile({ hub: COPILOTS_OWN })
  spawned('git', ['init', '-q', '.'], { cwd: dir })

  assert.deepEqual(lines.slice(lines.indexOf('!/estate.json') + 1, lines.indexOf('!/glossary.md')), ['!/.github/', '/.github/*', `!/${COPILOTS_OWN}`])
  assert.equal(ignoredByGit(dir, COPILOTS_OWN), false)
  assert.equal(ignoredByGit(dir, '.github/workflows/checks.yml'), true)
})

test('the same holds for a hub two folders down, and a folder whose name git would read as a pattern is written so that git reads it as a name', () => {
  const deep = ignoreFile({ hub: 'shared/notes/hub.md' })
  const odd = ignoreFile({ hub: 'no[te]s/hub.md' })
  for (const { dir } of [deep, odd]) spawned('git', ['init', '-q', '.'], { cwd: dir })

  assert.deepEqual(deep.lines.slice(deep.lines.indexOf('!/estate.json') + 1, deep.lines.indexOf('!/glossary.md')), ['!/shared/', '/shared/*', '!/shared/notes/', '/shared/notes/*', '!/shared/notes/hub.md'])
  assert.equal(ignoredByGit(deep.dir, 'shared/notes/hub.md'), false)
  assert.equal(ignoredByGit(deep.dir, 'shared/other.md'), true)
  assert.equal(ignoredByGit(deep.dir, 'shared/notes/other.md'), true)
  assert.equal(ignoredByGit(odd.dir, 'no[te]s/hub.md'), false)
  assert.equal(ignoredByGit(odd.dir, 'notes/hub.md'), true)
})

test('a hub inside a registered checkout, in a folder the map keeps whole or at the root leaves the file as it has always been written, so no checkout is taken back from what git ignores', () => {
  const inACheckout = ignoreFile({ hub: 'web/AGENTS.md', repos: [{ name: 'web', path: 'web' }] })
  const inANodeFolder = ignoreFile({ hub: 'docs/hub.md' })
  const atTheRoot = ignoreFile({})
  const written = (hub: string) => ['/*', '!/estate.json', `!/${hub}`, '!/glossary.md', '!/.claude/', '!/bin/', '!/package.json', '!/.gitignore', '!/.gitattributes']

  assert.deepEqual(inACheckout.lines.slice(0, 9), written('web/AGENTS.md'))
  assert.deepEqual(inANodeFolder.lines.slice(0, 9), written('docs/hub.md'))
  assert.deepEqual(atTheRoot.lines.slice(0, 9), written('CLAUDE.md'))
  for (const { lines } of [inACheckout, inANodeFolder, atTheRoot]) assert.deepEqual(lines.filter(line => line.endsWith('/*') && line !== '/*' && !line.includes('evidence')), [])
})

test("a plain map made on Copilot in a folder that holds Claude Code's settings folder and no hub file is given Copilot's own hub, since that folder says nothing of a hub to Copilot", () => {
  const dir = tree(makeTree({ '.claude/settings.json': {} }))
  const made = checkout({ 'README.md': '# Solo\n', '.claude/settings.json': {} })
  tree(made.base)

  plain(dir, ON_COPILOT)
  plain(made.main, { ...made.env, ...ON_COPILOT })

  assert.equal(hubOf(dir), COPILOTS_OWN)
  assert.equal(existsSync(join(dir, 'CLAUDE.md')), false)
  assert.equal(hubOf(made.main, `${MAP}/estate.json`), `${MAP}/hub.md`)
  assert.equal(existsSync(join(made.main, 'CLAUDE.local.md')), false)
})

test('a plain map made on Copilot from a linked work tree is made in the main checkout with its hub inside the map, and a session that starts in the work tree is given that hub', () => {
  const made = checkout({ 'README.md': '# Solo\n' })
  tree(made.base)
  const linked = workTree(made, join(made.base, 'tree'))

  const result = plain(linked, { ...made.env, ...ON_COPILOT })

  assert.equal(result.code, 0, result.stderr)
  assert.equal(hubOf(made.main, `${MAP}/estate.json`), `${MAP}/hub.md`)
  assert.equal(existsSync(join(linked, MAP)), false)
  assert.equal(started(linked).includes(`\n\nHub (${join(made.main, MAP, 'hub.md')}), which this host does not load by itself:\n`), true)
})

test("on Copilot budget counts what Copilot puts before the model at a start: a person's own file, the repository's and the folder's instructions and rules, each once, with what a file brings in", () => {
  const root = tree(makeTree({
    'home/.copilot/copilot-instructions.md': '# Mine\n',
    'home/.copilot/instructions/style.instructions.md': '# My style\n',
    'home/.claude/CLAUDE.md': '# Read by Claude Code alone\n',
    'repo/.git/HEAD': 'ref: refs/heads/main\n',
    [`repo/${COPILOTS_OWN}`]: '# Build\n\nNotes: @../docs/notes.md\n',
    'repo/docs/notes.md': '# Notes\n',
    'repo/AGENTS.md': '# Agents\n',
    'repo/CLAUDE.md': '# Shared\n',
    'repo/CLAUDE.local.md': '# Kept to this checkout, and not loaded by Copilot\n',
    'repo/.claude/rules/tests.md': '# Tests\n',
    'repo/.github/instructions/every.instructions.md': '---\napplyTo: "**"\n---\n# Everywhere\n',
    'repo/.github/instructions/source.instructions.md': SCOPED,
    'repo/web/AGENTS.md': '# Web\n',
    'repo/web/src/AGENTS.md': '# Below the start\n',
  }))
  const at = (...rel: string[]) => join(root, 'repo', ...rel)

  const report = budget(at('web'), { HOME: join(root, 'home'), ...ON_COPILOT })

  assert.deepEqual(sources(report), [
    [join(root, 'home/.copilot/copilot-instructions.md'), 'user'],
    [join(root, 'home/.copilot/instructions/style.instructions.md'), 'user instructions'],
    [at(COPILOTS_OWN), 'repository'],
    [at('docs/notes.md'), 'import'],
    [at('AGENTS.md'), 'repository'],
    [at('CLAUDE.md'), 'repository'],
    [at('.claude/rules/tests.md'), 'repository rule'],
    [at('.github/instructions/every.instructions.md'), 'repository instructions'],
    [at('web/AGENTS.md'), 'folder'],
  ])
  assert.deepEqual(report.notLoaded, { pathScopedRules: 1 })
})

test("on Copilot budget reads a person's own instructions from the folder COPILOT_HOME names, and counts a folder that is no repository by itself", () => {
  const root = tree(makeTree({ 'moved/copilot-instructions.md': '# Mine\n', 'home/.copilot/copilot-instructions.md': '# Not read\n', 'plain/AGENTS.md': '# Agents\n', 'AGENTS.md': '# Above, and not loaded\n' }))

  const report = budget(join(root, 'plain'), { HOME: join(root, 'home'), COPILOT_HOME: join(root, 'moved'), ...ON_COPILOT })

  assert.deepEqual(sources(report), [[join(root, 'moved/copilot-instructions.md'), 'user'], [join(root, 'plain/AGENTS.md'), 'folder']])
})

test("on Copilot budget adds the hub's text to what the plugin's hooks give at a start, where Copilot does not load the hub by itself, and leaves it out where it does", () => {
  const given = tree(acme({ 'CLAUDE.local.md': HUB }, { hub: 'CLAUDE.local.md' }))
  const loaded = tree(acme())
  const env = { HOME: home(), ...ON_COPILOT }

  assert.equal(budget(given, env).plugin?.hubChars, HUB.trimEnd().length)
  assert.equal(budget(loaded, env).plugin?.hubChars, undefined)
  assert.match(run(['budget'], { cwd: given, env }).stdout, new RegExp(`\\nPlugin hooks add: index [\\d,]+ characters at session start, and the hub's text, ${HUB.trimEnd().length} characters, which this host does not load by itself\\n$`))
})

test("on Copilot budget counts a file of a name Copilot loads in a folder between the repository's root and the start folder, and not one below the start", () => {
  const root = tree(makeTree({ 'repo/.git/HEAD': 'ref: refs/heads/main\n', 'repo/web/AGENTS.md': '# Web\n', 'repo/web/.claude/rules/web.md': '# A rule between, which Copilot does not load\n', 'repo/web/src/deep/AGENTS.md': '# Below\n', 'repo/web/src/app.js': 'export {}\n' }))

  const report = budget(join(root, 'repo/web/src'), { HOME: home(), ...ON_COPILOT })

  assert.deepEqual(sources(report), [[join(root, 'repo/web/AGENTS.md'), 'folder']])
})

test('on Copilot budget counts the instructions files of a folder the person has named to Copilot as one more to load from, and none of its other files', () => {
  const root = tree(makeTree({ 'plain/notes.txt': 'x\n', 'shared/team.instructions.md': '# Team\n', 'shared/.github/instructions/more.instructions.md': '# More\n', 'shared/scoped.instructions.md': SCOPED, 'shared/AGENTS.md': '# Not loaded from here\n' }))

  const report = budget(join(root, 'plain'), { HOME: home(), COPILOT_CUSTOM_INSTRUCTIONS_DIRS: join(root, 'shared'), ...ON_COPILOT })

  assert.deepEqual(sources(report), [[join(root, 'shared/team.instructions.md'), 'added folder instructions'], [join(root, 'shared/.github/instructions/more.instructions.md'), 'added folder instructions']])
  assert.deepEqual(report.notLoaded, { pathScopedRules: 1 })
})

test("on Copilot budget counts of a long hub only what the hook gives of it, which is what the index leaves of the hook's limit", () => {
  const long = `# Acme estate\n\n${'A task about a screen goes to web.\n'.repeat(600)}`
  const root = tree(acme({ 'CLAUDE.local.md': long }, { hub: 'CLAUDE.local.md' }))
  const given = started(root)
  const ofTheHub = given.slice(given.indexOf(':\n', given.indexOf('\n\nHub (')) + 2).replace('\n[cut here; the file holds the rest]', '')

  const report = budget(root, { HOME: home(), ...ON_COPILOT })

  assert.equal(given.length <= 9500, true)
  assert.equal(long.length > 20000, true)
  assert.equal(report.plugin?.hubChars, ofTheHub.length)
})

test('on Copilot budget run from a linked work tree counts the hub the hook gives a session that starts there', () => {
  const made = checkout({ 'README.md': '# Solo\n' })
  tree(made.base)
  plain(made.main, { ...made.env, ...ON_COPILOT })
  const linked = workTree(made, join(made.base, 'tree'))
  const given = started(linked)
  const ofTheHub = given.slice(given.indexOf(':\n', given.indexOf('\n\nHub (')) + 2)

  const report = budget(linked, { ...made.env, HOME: home(), ...ON_COPILOT })

  assert.equal(report.plugin?.hubChars, ofTheHub.length)
  assert.equal(ofTheHub.length > 0, true)
})

test('on Claude Code budget counts what it has always counted, and says nothing of a hub', () => {
  const root = tree(makeTree({ 'home/.claude/CLAUDE.md': '# Mine\n', 'home/.copilot/copilot-instructions.md': '# Read by Copilot alone\n', 'estate/CLAUDE.md': HUB, [`estate/${COPILOTS_OWN}`]: '# Build\n' }))

  const report = budget(join(root, 'estate'), { HOME: join(root, 'home'), ...ON_CLAUDE_CODE })

  assert.deepEqual(sources(report), [[join(root, 'home/.claude/CLAUDE.md'), 'user'], [join(root, 'estate/CLAUDE.md'), 'ancestor']])
})

test("on Copilot detect reports Copilot's own instructions file, and the servers of its own file where the folder has no file of servers that any host reads, and names Copilot's folder as the one its settings are kept in", () => {
  const dir = tree(makeTree({ [COPILOTS_OWN]: '# Build\n', 'AGENTS.md': '# Agents\n', '.github/mcp.json': { mcpServers: { passedOver: {} } }, '.mcp.json': { mcpServers: { docs: {} } }, 'web/.github/copilot-instructions.md': '# Web\n', 'web/.github/mcp.json': { mcpServers: { issues: {} } } }))
  const mine = home()
  const facts = (env: Env) => JSON.parse(run(['detect', '--json'], { cwd: dir, env: { HOME: mine, ...env } }).stdout) as Facts

  const copilots = facts(ON_COPILOT)
  const claudes = facts(ON_CLAUDE_CODE)

  assert.deepEqual(copilots.instructionFiles.map(file => file.rel), ['AGENTS.md', COPILOTS_OWN, `web/${COPILOTS_OWN}`])
  assert.deepEqual(copilots.mcpServers, [{ file: '.mcp.json', names: ['docs'] }, { file: 'web/.github/mcp.json', names: ['issues'] }])
  assert.equal(copilots.configDir, join(mine, '.copilot'))
  assert.deepEqual(claudes.instructionFiles.map(file => file.rel), ['AGENTS.md'])
  assert.deepEqual(claudes.mcpServers, [{ file: '.mcp.json', names: ['docs'] }])
  assert.equal(claudes.configDir, join(mine, '.claude'))
})
