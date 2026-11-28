import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { REPO, run } from './helpers.mts'

const DOCS = readdirSync(join(REPO, 'docs')).filter(name => name.endsWith('.md')).sort().map(name => `docs/${name}`)

const prose = (file: string) => readFileSync(join(REPO, file), 'utf8').replace(/^[ \t]*```[\s\S]*?^[ \t]*```[ \t]*\r?$/gm, '')
const anchors = (file: string) => [...prose(file).matchAll(/^#+ (.+?)\r?$/gm)].map(([, heading]) => heading.toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, '').replaceAll(' ', '-'))
const links = (file: string) => [...prose(file).replace(/`[^`\n]*`/g, '').matchAll(/\]\(([^)\s]+)\)/g)].map(([, target]) => target).filter(target => !/^[a-z]+:/.test(target))

test('every link in the README, in the contributing page and in a file under docs leads to a file that is there, and to a heading that file has', () => {
  const dead = ['README.md', 'CONTRIBUTING.md', ...DOCS].flatMap(page => links(page)
    .filter(target => {
      const [path, anchor] = target.split('#')
      const file = path ? join(dirname(page), path) : page
      return !existsSync(join(REPO, file)) || (anchor !== undefined && !anchors(file).includes(anchor))
    })
    .map(target => `${page}: ${target}`))

  assert.deepEqual(dead, [])
})

test('the README links every file under docs, so none is reached only by its path', () => {
  const linked = links('README.md').map(target => target.split('#')[0])

  assert.deepEqual(DOCS.filter(file => !linked.includes(file)), [])
})

const COMMANDS = join(REPO, 'lib', 'commands')
const commandNames = () => readdirSync(COMMANDS).filter(name => name.endsWith('.mts')).map(name => name.slice(0, -4)).sort()
const flagsOf = (name: string) => [...readFileSync(join(COMMANDS, `${name}.mts`), 'utf8').matchAll(/'?([a-z][a-z-]*)'?: \{ type: '(?:string|boolean)'/g)].map(([, flag]) => flag)
const rowsFor = (name: string) => prose('docs/commands.md').split('\n').filter(line => line.startsWith(`| \`${name}`))

test('the README and the install doc give the two commands the launcher gives, so the plugin installs from one marketplace', () => {
  const add = 'claude plugin marketplace add azamkhanuk/claude-plugins'
  const install = 'claude plugin install context-central@azamkhanuk'
  const missing = ['README.md', 'docs/install.md'].flatMap(page => {
    const lines = readFileSync(join(REPO, page), 'utf8').split(/\r?\n/)
    return [add, install].filter(command => !lines.includes(command)).map(command => `${page}: ${command}`)
  })

  assert.deepEqual(missing, [])
  assert.ok(run(['wrapper']).stdout.includes(`${add}, then: ${install}`))
})

test("the README and the install doc give the same two commands for Copilot, and the entry for a person's own settings that names the marketplace the launcher names", () => {
  const lines = [
    'copilot plugin marketplace add azamkhanuk/claude-plugins',
    'copilot plugin install context-central@azamkhanuk',
    '    "azamkhanuk": { "source": { "source": "github", "repo": "azamkhanuk/claude-plugins" }, "autoUpdate": true }',
  ]
  const missing = ['README.md', 'docs/install.md'].flatMap(page => {
    const written = readFileSync(join(REPO, page), 'utf8').split(/\r?\n/)
    return lines.filter(line => !written.includes(line)).map(line => `${page}: ${line}`)
  })
  const { extraKnownMarketplaces } = JSON.parse(run(['init', '--print-settings']).stdout) as { extraKnownMarketplaces: unknown }

  assert.deepEqual(missing, [])
  assert.deepEqual(extraKnownMarketplaces, { azamkhanuk: { source: { source: 'github', repo: 'azamkhanuk/claude-plugins' }, autoUpdate: true } })
  assert.ok(run(['wrapper']).stdout.includes('On Copilot the same two commands start with copilot.'))
})

test('the commands doc has a row for every command, for help and for --version, naming every flag each command takes', () => {
  const missing = commandNames().flatMap(name => {
    const rows = rowsFor(name)
    return rows.length === 0 ? [name] : flagsOf(name).filter(flag => !rows.some(row => row.includes(`--${flag}`))).map(flag => `${name} --${flag}`)
  })

  const alone = [...(rowsFor('help').some(row => row.includes('`--help`') && row.includes('`-h`')) ? [] : ['help']), ...(rowsFor('--version').length > 0 ? [] : ['--version'])]

  assert.deepEqual([...missing, ...alone], [])
})

const EVALS = join(REPO, 'evals')
const THE_HOSTS_OWN = ['results', 'mocks']
const foldersIn = (dir: string) => readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
const evalFlags = () => [...readFileSync(join(REPO, 'scripts', 'run-evals.mts'), 'utf8').matchAll(/'?([a-z][a-z-]*)'?: \{ type: '(?:string|boolean)'/g)].map(([, flag]) => `--${flag}`)
const evalCases = () => foldersIn(EVALS).filter(group => !THE_HOSTS_OWN.includes(group)).flatMap(group => foldersIn(join(EVALS, group)).map(name => `\`${name}\``))

test('the eval suite page names the one command, every flag it takes, what it always passes to the host and every case of the suite', () => {
  const page = readFileSync(join(REPO, 'docs', 'evals.md'), 'utf8')
  const named = ['npm run evals', ...evalFlags(), '--no-publish', '--scaffold', '--model claude-sonnet-5-5', '--threshold 0', ...evalCases()]

  assert.deepEqual(evalFlags(), ['--group', '--case', '--trial', '--max-cost-usd', '--trust-plugin'])
  assert.ok(evalCases().includes('`where-an-item-stands`'))
  assert.deepEqual(named.filter(text => !page.includes(text)), [])
})
