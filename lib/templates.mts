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
  log: 'dated notes, one file a month.',
}

const RESOLVE_LINE =
  "`context-central resolve <item or words>` lists the notes behind a task. A work item's name or title always answers. Other words answer when they single out one item or note; otherwise it says there is no confident match."

export function hubTemplate({ name, title, repos, writeRules, nodeDirs, workDir }: Settings, inMap: InMap = rel => rel) {
  return [
    `# ${title}`,
    '',
    `The context map for the ${name} estate. This file routes a task to the notes that cover it. Status belongs in state files, not here.`,
    '',
    ...section('Where a task goes', routingTable(repos, inMap)),
    ...section('Write rules', ruleLines(writeRules)),
    BLOCK_START,
    ...section('The parts of the map', partLines(nodeDirs, workDir, inMap)),
    RESOLVE_LINE,
    BLOCK_END,
    '',
  ].join('\n')
}

export function mapBlock({ workDir }: Settings, inMap: InMap = rel => rel) {
  return [
    BLOCK_START,
    '## Context map',
    '',
    `This folder has a context map. Work in flight is recorded in \`${inMap(workDir)}/<item>/STATE.md\` and the estate's terms in \`${inMap('glossary.md')}\`. Evidence that is not text sits in \`${inMap(workDir)}/<item>/evidence/\`. ${RESOLVE_LINE}`,
    BLOCK_END,
    '',
  ].join('\n')
}

const NODE_TEMPLATES: Record<string, (title: string) => string> = {
  repos: title => `# ${title}\n\n## What it is\n\n## Traps\n\n## How to work in it\n`,
  areas: title => `# ${title}\n\n## What it covers\n\n## Traps\n`,
  edges: title =>
    `# ${title}\n\nStatus is \`verified\` (checked in the code) or \`inferred\` (read from names or documents).\n\n| From | To | Status |\n|---|---|---|\n`,
}

export function nodeTemplate(kind: string, title: string) {
  return Object.hasOwn(NODE_TEMPLATES, kind) ? NODE_TEMPLATES[kind](title) : `# ${title}\n`
}

export function decisionTemplate(number: string, title: string) {
  return `# ${number}: ${title}\n\n## Context\n\n## Decision\n\n## Consequences\n`
}

export function stateTemplate(id: string, title: string) {
  return `---
item: ${id}
title: ${title}
status: active
---
# ${id}: ${title}

## Where it stands

## Done

## Next

## Blocked

## Standing traps

## Where the detail lives

- Spec: \`SPEC.md\` beside this file, once written.
- Notes: \`notes/\`. Full text of tickets, PRs, threads and meetings: \`sources/\`.
- Evidence that is not text (screenshots, recordings, exports): \`evidence/\`, each file named in a note.
`
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
    extraKnownMarketplaces: { [MARKETPLACE]: { source: { source: 'github', repo } } },
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
      const plugins = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).plugins || {}
      const key = Object.keys(plugins).find(name => name.startsWith("${PLUGIN}@"))
      const install = key && [].concat(plugins[key])[0]
      if (install && install.installPath) console.log(install.installPath)
    ' "$installed" 2>/dev/null)
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
// cmd reads what a program prints in the console code page, which garbles a path outside ASCII, so node finds the bin script and runs it.
const RUN_BIN_SCRIPT = [
  "const fs = require('fs')",
  "const [record, ...args] = process.argv.slice(1)",
  `const installed = () => { try { const plugins = JSON.parse(fs.readFileSync(record, 'utf8')).plugins || {}; const key = Object.keys(plugins).find(name => name.startsWith('${PLUGIN}@')); const install = key && [].concat(plugins[key])[0]; return install && install.installPath ? require('path').join(install.installPath, 'bin', '${PLUGIN}') : '' } catch { return '' } }`,
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
    `node -e "${RUN_BIN_SCRIPT}" -- "%config%\\plugins\\installed_plugins.json" %*`,
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

function partLines(nodeDirs: string[], workDir: string, inMap: InMap) {
  const parts = nodeDirs.map(dir => (dir === workDir ? `- \`${inMap(dir)}/<item>/STATE.md\`: where a piece of work stands and what is next. Files that are not text sit in \`evidence/\` beside it.` : `- \`${inMap(dir)}/\`: ${PARTS[dir] ?? 'notes.'}`))
  return [...parts, `- \`${inMap('glossary.md')}\`: the estate's terms.`]
}
