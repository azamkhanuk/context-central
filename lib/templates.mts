import { EVIDENCE_DIR } from './nodes.mts'
import type { Repo, Settings, WriteRules } from './estate.mts'

export type InMap = (rel: string) => string

export const BLOCK_START = '<!-- context-central:start -->'
export const BLOCK_END = '<!-- context-central:end -->'

const PLUGIN = 'context-central'
const MARKETPLACE = 'context-central'

const PARTS: Record<string, string | undefined> = {
  repos: 'one note per repo: what it is, its traps, how to work in it.',
  areas: 'one corner of a repo, in depth.',
  concepts: 'the ideas the estate relies on, one per note.',
  edges: 'where one repo meets another, each row marked verified or inferred.',
  decisions: 'numbered records of what was decided and why.',
  docs: 'longer reference notes.',
  standards: 'one note per repo: how its code is designed, written, tested and reviewed, each rule with its source.',
  log: 'dated notes, one file a month.',
}

const RESOLVE_LINE =
  "`context-central resolve <item or words>` lists the notes behind a task. A work item's name or title always answers. Other words answer when they single out one item or note; otherwise it says there is no confident match."

export function hubTemplate({ name, title, repos, writeRules, nodeDirs, workDir, glossary }: Settings, inMap: InMap = rel => rel) {
  return [
    `# ${title}`,
    '',
    `The context map for the ${name} estate. This file routes a task to the notes that cover it. Status belongs in state files, not here.`,
    '',
    ...section('Where a task goes', routingTable(repos, inMap)),
    ...section('Write rules', ruleLines(writeRules)),
    BLOCK_START,
    ...section('The parts of the map', partLines(nodeDirs, workDir, glossary ?? inMap('glossary.md'), inMap)),
    RESOLVE_LINE,
    BLOCK_END,
    '',
  ].join('\n')
}

export function mapBlock({ workDir, glossary }: Settings, inMap: InMap = rel => rel) {
  return [
    BLOCK_START,
    '## Context map',
    '',
    `This folder has a context map. Work in flight is recorded in \`${inMap(workDir)}/<item>/STATE.md\` and the estate's terms in \`${glossary ?? inMap('glossary.md')}\`. Evidence that is not text sits in \`${inMap(workDir)}/<item>/evidence/\`. ${RESOLVE_LINE}`,
    BLOCK_END,
    '',
  ].join('\n')
}

const NODE_TEMPLATES: Record<string, (title: string) => string> = {
  repos: title => `# ${title}\n\n## What it is\n\n## Traps\n\n## How to work in it\n`,
  areas: title => `# ${title}\n\n## What it covers\n\n## Traps\n`,
  edges: title =>
    `# ${title}\n\nStatus is \`verified\` (checked in the code) or \`inferred\` (read from names or documents).\n\n| From | To | Status |\n|---|---|---|\n`,
  standards: title =>
    `# ${title}\n\nEach rule names its source: who said it and when, or the file that shows it. An example is a pointer to real code, as a path and a line. The lines are those of \`${title}\` at \`<commit>\`, on <date>.\n\n## Design\n\n## Code\n\n## Tests\n\n## Review\n`,
}

export function nodeTemplate(kind: string, title: string) {
  return Object.hasOwn(NODE_TEMPLATES, kind) ? NODE_TEMPLATES[kind](title) : `# ${title}\n`
}

export function decisionTemplate(number: string, title: string) {
  return `# ${number}: ${title}\n\n## Context\n\n## Decision\n\n## Consequences\n`
}

export interface Adopted {
  status: string
  day: string
  older: string | null
  linked: string[]
}

export function stateTemplate(id: string, title: string, ticket: string | null = null, from: Adopted | null = null) {
  const stands = from?.older ? `\nAdopted on ${from.day}. What is known of this item is in its older entry file, ${link(from.older)}, which is left as it was.\n` : ''
  const detail = from?.older ? [`- Older entry file: ${link(from.older)}.`, ...from.linked.map(path => `- It pointed to ${link(path)}.`), ''].join('\n') : ''
  return `---
item: ${id}
title: ${title}
status: ${from?.status ?? 'active'}
${ticket ? `ticket: "${ticket}"\n` : ''}---
# ${id}: ${title}

## Where it stands
${stands}
## Done

## Next

## Blocked

## Standing traps

## Where the detail lives

${detail}- Spec: \`SPEC.md\` beside this file, once written.
- Notes: \`notes/\`. Full text of tickets, PRs, threads and meetings: \`sources/\`.
- Evidence that is not text (screenshots, recordings, exports): \`evidence/\`, each file named in a note.
`
}

function link(path: string) {
  const target = path.replace(/[\s()#%]/g, char => (char === '(' || char === ')' ? `%${char.charCodeAt(0).toString(16)}` : encodeURIComponent(char)))
  return `[${path.replace(/^(\.\.\/)+/, '')}](${target})`
}

export function glossaryTemplate() {
  return [
    '# Glossary',
    '',
    "The estate's terms. One entry each: the term in bold, one or two sentences on what it means here, then the words to avoid for it.",
    '',
    '```',
    '**Term**: What it means in this estate, in one or two sentences.',
    '_Avoid_: the synonyms that are not used for it',
    '```',
    '',
  ].join('\n')
}

export function gitignoreTemplate({ hub, nodeDirs, workDir, evidence }: Settings) {
  const allowed = ['estate.json', hub, 'glossary.md', '.claude/', 'bin/', 'package.json', '.gitignore', '.gitattributes', ...nodeDirs.map(dir => `${dir}/`)]
  return ['/*', ...allowed.map(path => `!/${path}`), ...(evidence.commit ? [] : [evidenceIgnoreRule(workDir)]), ''].join('\n')
}

export function evidenceIgnoreRule(workDir: string) {
  return `/${workDir}/*/${EVIDENCE_DIR}/`
}

export function gitattributesTemplate() {
  return 'log/*.md merge=union\n'
}

export function settingsTemplate(repo: string) {
  return {
    extraKnownMarketplaces: { [MARKETPLACE]: { source: { source: 'github', repo }, autoUpdate: true } },
    enabledPlugins: { [`${PLUGIN}@${MARKETPLACE}`]: true },
    permissions: { allow: [`Bash(${PLUGIN} *)`] },
  }
}

export function launcherTemplate() {
  return `#!/bin/sh
if ! command -v node >/dev/null 2>&1; then
  echo "${NO_NODE}" >&2
  exit 1
fi
cli="\${CONTEXT_CENTRAL_CLI:-}"
if [ -z "$cli" ]; then
  installed="\${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins/installed_plugins.json"
  if [ -f "$installed" ]; then
    root=$(node -e '
      ${CHOOSE_INSTALL}
      console.log(choose(process.argv[1], process.argv[2]))
    ' "$installed" "$0" 2>/dev/null)
    if [ -n "$root" ]; then cli="$root/bin/${PLUGIN}"; fi
  fi
fi
if [ -z "$cli" ] || [ ! -f "$cli" ]; then
  echo "${NO_PLUGIN[0]}" >&2
  echo "${NO_PLUGIN[1]}" >&2
  exit 1
fi
exec node "$cli" "$@"
`
}

const NO_NODE = `${PLUGIN}: node was not found on the PATH. Install Node 22.18 or later.`
const NO_PLUGIN = [
  `${PLUGIN}: the plugin was not found. Add its marketplace with claude plugin marketplace add, then: claude plugin install ${PLUGIN}@${MARKETPLACE}`,
  `Or set CONTEXT_CENTRAL_CLI to the path of its bin/${PLUGIN} file.`,
]
// One text for both launchers: sh wraps it in single quotes and cmd in double, so every string in it is in backticks and it holds no percent sign.
const CHOOSE_INSTALL = [
  'const choose = (record, launcher) => { const fs = require(`fs`), path = require(`path`)',
  'const real = file => { try { return fs.realpathSync.native(file) } catch (error) { return `` } }',
  `const read = () => { try { const plugins = JSON.parse(fs.readFileSync(record, \`utf8\`)).plugins || {}; return Object.keys(plugins).filter(name => name.startsWith(\`${PLUGIN}@\`)).reduce((all, name) => all.concat(plugins[name]), []).filter(install => install && install.installPath) } catch (error) { return [] } }`,
  'const installs = read()',
  'const projects = installs.filter(install => install.projectPath).map(install => [real(install.projectPath), install.installPath])',
  'const person = installs.find(install => install.scope === `user`)',
  'let dir = real(launcher)',
  'while (dir && path.dirname(dir) !== dir) { dir = path.dirname(dir); const own = projects.find(([folder]) => folder === dir); if (own) return own[1] }',
  'return person ? person.installPath : `` }',
].join('; ')
// cmd reads what a program prints in the console code page, which garbles a path outside ASCII, so node finds the bin script and runs it.
const RUN_BIN_SCRIPT = [
  "const fs = require('fs')",
  "const [record, launcher, ...args] = process.argv.slice(1)",
  CHOOSE_INSTALL,
  `const installed = () => { const root = choose(record, launcher); return root ? require('path').join(root, 'bin', '${PLUGIN}') : '' }`,
  'const isFile = file => { try { return fs.statSync(file).isFile() } catch { return false } }',
  'const cli = process.env.CONTEXT_CENTRAL_CLI || installed()',
  "if (cli && isFile(cli)) process.exit(require('child_process').spawnSync(process.execPath, [cli, ...args], { stdio: 'inherit' }).status ?? 1)",
  `process.stderr.write('${NO_PLUGIN.map(line => `${line}\\r\\n`).join('')}')`,
  'process.exitCode = 1',
].join('; ')

export function cmdLauncherTemplate() {
  return [
    '@echo off',
    'setlocal disabledelayedexpansion',
    'where node >nul 2>nul || goto no_node',
    'set "config=%CLAUDE_CONFIG_DIR%"',
    'if not defined config set "config=%USERPROFILE%\\.claude"',
    `node -e "${RUN_BIN_SCRIPT}" -- "%config%\\plugins\\installed_plugins.json" "%~f0" %*`,
    'exit /b %errorlevel%',
    ':no_node',
    `>&2 echo ${NO_NODE}`,
    'exit /b 1',
    '',
  ].join('\r\n')
}

export function launcherAttributesTemplate() {
  return `${PLUGIN} text eol=lf\n${PLUGIN}.cmd text eol=crlf\n`
}

function section(heading: string, lines: string[]) {
  return lines.length > 0 ? [`## ${heading}`, '', ...lines, ''] : []
}

function routingTable(repos: Repo[], inMap: InMap) {
  if (repos.length === 0) return []
  const rows = repos.map(repo => `| \`${repo.name}\` | ${repo.role ?? 'not recorded'} |`)
  return ['| Repo | Role |', '|---|---|', ...rows, '', `A repo gets a note under \`${inMap('repos')}/\` once work starts in it; link the note from this table then.`]
}

function ruleLines(rules: WriteRules | undefined) {
  if (!rules) return []
  if (typeof rules === 'string') return [`- ${rules}`]
  if (Array.isArray(rules)) return rules.map(rule => `- ${text(rule)}`)
  return Object.entries(rules).map(([name, rule]) => `- ${name}: ${text(rule)}`)
}

function text(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function partLines(nodeDirs: string[], workDir: string, glossary: string, inMap: InMap) {
  const parts = nodeDirs.map(dir => (dir === workDir ? `- \`${inMap(dir)}/<item>/STATE.md\`: where a piece of work stands and what is next. Files that are not text sit in \`evidence/\` beside it.` : `- \`${inMap(dir)}/\`: ${PARTS[dir] ?? 'notes.'}`))
  return [...parts, `- \`${glossary}\`: the estate's terms.`]
}
