import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { REPO, disposable, makeTree, run } from './helpers.mts'
import type { Env } from './helpers.mts'

const tree = disposable()

type Told = { host: string, title: string, steps: { heading: string, text: string }[] }

const ON_COPILOT = { COPILOT_AGENT_SESSION_ID: 's1' }
const ON_CLAUDE_CODE = { CLAUDECODE: '1' }
const SHARED_HEADINGS = ['Servers this session holds', 'Allowing a tool', 'Settings', "Settings a session at the map's root will not load"]
const MARKETPLACES_REPOSITORY = 'azamkhanuk/claude-plugins'

const home = () => tree(makeTree({ '.keep': '' }))
const told = (env: Env) => JSON.parse(run(['host', '--json'], { env: { HOME: home(), ...env } }).stdout) as Told
const part = (env: Env, heading: string) => told(env).steps.find(step => step.heading === heading)?.text ?? ''
const whole = (env: Env) => told(env).steps.map(step => step.text).join('\n\n')
const onboard = () => readFileSync(join(REPO, 'skills', 'onboard', 'SKILL.md'), 'utf8')
const printed = (env: Env) => JSON.parse(run(['init', '--print-settings'], { env: { HOME: home(), ...env } }).stdout) as { extraKnownMarketplaces: Record<string, { source: { repo: string } }>, enabledPlugins: Record<string, boolean> }

test('on each host the command prints a part under each heading the onboard skill names, and Copilot one more, on the hub', () => {
  assert.deepEqual(told(ON_CLAUDE_CODE).steps.map(step => step.heading), SHARED_HEADINGS)
  assert.deepEqual(told(ON_COPILOT).steps.map(step => step.heading), [SHARED_HEADINGS[0], 'The hub', ...SHARED_HEADINGS.slice(1)])
})

test('the onboard skill names each heading, and holds no file, command or tool name that belongs to one host', () => {
  const text = onboard()

  for (const heading of [...SHARED_HEADINGS, 'The hub']) assert.equal(text.includes(`\`${heading}\``), true, heading)
  assert.equal(text.includes('`context-central host`'), true)
  for (const ofOneHost of ['.claude/', 'claude plugin', 'mcp__', 'Claude Code', '.github', 'copilot', 'Copilot']) assert.equal(text.includes(ofOneHost), false, ofOneHost)
})

test("on Claude Code the parts hold what the onboard skill held before it had a second host: Claude Code's settings files, its name for a server's tool and its own commands", () => {
  assert.equal(part(ON_CLAUDE_CODE, 'Servers this session holds'), "The MCP servers and connectors this session itself holds are read from the names in its own tool list. A tool named `mcp__<server>__<tool>` belongs to the server `<server>`.")
  assert.equal(part(ON_CLAUDE_CODE, 'Allowing a tool'), "Offer allow rules for the read tools just used, for `.claude/settings.local.json` on this machine only. A server's tool is allowed by its full name, `mcp__<server>__<tool>`. Write them only on a yes.")
  assert.match(part(ON_CLAUDE_CODE, 'Settings'), /^Run `context-central init --print-settings` and show the JSON\. Ask where it goes: `\.claude\/settings\.json` \(shared with everyone who uses the map\) or `\.claude\/settings\.local\.json` \(this machine only\)\. /)
  assert.match(part(ON_CLAUDE_CODE, 'Settings'), /\n\nThen say what decides whether the plugin loads\. Claude Code reads project settings only from the folder a session starts in, /)
  assert.match(part(ON_CLAUDE_CODE, 'Settings'), / With neither, `CONTEXT_CENTRAL_CLI` names the plugin's `bin\/context-central` file\.$/)
  assert.equal(part(ON_CLAUDE_CODE, "Settings a session at the map's root will not load"), "Layout `root` only. A session started at the estate root loads none of the repos' own settings. Read each registered repo's `.claude/settings.json`, `.claude/settings.local.json` and `.mcp.json`, and list every `permissions.deny` rule, `permissions.ask` rule and MCP server name found, by repo. Offer to copy them up into the map's settings and `.mcp.json`; copy only what the person picks.")
  assert.doesNotMatch(whole(ON_CLAUDE_CODE), /copilot|\.github/i)
})

test("on Copilot the parts are in Copilot's own terms: its settings files, its instructions file, its rule for a tool and its own commands, and they name Claude only in the address of the marketplace", () => {
  const text = whole(ON_COPILOT)

  assert.match(part(ON_COPILOT, 'Servers this session holds'), /^Run `copilot mcp list`, .* a server's tool is named `<server>-<tool>`/)
  assert.match(part(ON_COPILOT, 'The hub'), /the hub is `\.github\/copilot-instructions\.md`, the file Copilot's own `init` writes .* the hub is `\.context-central\/hub\.md`, which Copilot does not load/)
  assert.match(part(ON_COPILOT, 'Allowing a tool'), /^Copilot keeps no file of rules for a person to write, so write none\. .*`--allow-tool`, once for each rule: a server's tool is written `<server>\(<tool>\)`, and a command `shell\(<command>:\*\)`\. .*`shell\(context-central:\*\)`/)
  assert.match(part(ON_COPILOT, 'Settings'), /^Run `context-central init --print-settings` and show the JSON, .*`\.github\/copilot\/settings\.json` \(shared with everyone who uses the map\) or `\.github\/copilot\/settings\.local\.json` \(this machine only, /)
  assert.match(part(ON_COPILOT, 'Settings'), /`copilot plugin marketplace add azamkhanuk\/claude-plugins` .* `copilot plugin install context-central@azamkhanuk`.*`~\/\.copilot\/settings\.json`, give the marketplace's entry `"autoUpdate": true`/)
  assert.match(part(ON_COPILOT, "Settings a session at the map's root will not load"), /`\.github\/copilot\/settings\.json`, `\.github\/copilot\/settings\.local\.json`, `\.mcp\.json` and `\.github\/mcp\.json`/)
  assert.deepEqual([...text.matchAll(/claude/gi)].map(found => text.slice(found.index - 'azamkhanuk/'.length, found.index + 'claude-plugins'.length)).filter(around => around !== MARKETPLACES_REPOSITORY), [])
  assert.doesNotMatch(text, /mcp__|permissions\./)
})

test("each host's part on settings installs the plugin from the marketplace, under the name the printed settings give them", () => {
  for (const [env, program] of [[ON_CLAUDE_CODE, 'claude'], [ON_COPILOT, 'copilot']] as const) {
    const { extraKnownMarketplaces, enabledPlugins } = printed(env)
    const [[marketplace, { source }]] = Object.entries(extraKnownMarketplaces)
    const [plugin] = Object.keys(enabledPlugins)

    assert.equal(source.repo, MARKETPLACES_REPOSITORY)
    assert.equal(part(env, 'Settings').includes(`\`${program} plugin marketplace add ${source.repo}\``), true, program)
    assert.equal(part(env, 'Settings').includes(`\`${program} plugin install ${plugin}\``), true, program)
    assert.equal(plugin.endsWith(`@${marketplace}`), true)
  }
})

test("every command of the plugin that a host's parts name is a command it has, with a flag that command takes", () => {
  for (const env of [ON_CLAUDE_CODE, ON_COPILOT]) {
    const named = [...whole(env).matchAll(/`context-central ([a-z-]+)((?: --[a-z-]+)*)`/g)].map(([, command, flags]) => [command, ...flags.trim().split(' ').filter(Boolean)])

    assert.ok(named.length > 0)
    for (const [command, ...flags] of named) {
      assert.equal(run([command, '--help']).code, 0, command)
      for (const flag of flags) assert.notEqual(run([command, flag], { cwd: home(), env: { HOME: home() } }).code, 2, `${command} ${flag}`)
    }
  }
})

test('without --json the command prints the host, then each part under its heading and a colon, a blank line between', () => {
  const lines = run(['host'], { env: { HOME: home(), ...ON_COPILOT } }).stdout.split('\n')

  assert.deepEqual(lines.slice(0, 3), ['Host: the Copilot command line', '', 'Servers this session holds:'])
  assert.equal(lines.includes('The hub:'), true)
  assert.equal(lines.includes("Settings a session at the map's root will not load:"), true)
})
