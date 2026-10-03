export const BLOCK_START = '<!-- context-central:start -->'
export const BLOCK_END = '<!-- context-central:end -->'

const PLUGIN = 'context-central'
const MARKETPLACE = 'context-central'

const PARTS = {
  repos: 'one note per repo: what it is, its traps, how to work in it.',
  areas: 'one corner of a repo, in depth.',
  concepts: 'the ideas the estate relies on, one per note.',
  edges: 'where one repo meets another, each row marked verified or inferred.',
  decisions: 'numbered records of what was decided and why.',
  docs: 'longer reference notes.',
  log: 'dated notes, one file a month.',
}

export function hubTemplate({ name, title, repos, writeRules, nodeDirs, workDir }, inMap = rel => rel) {
  return [
    `# ${title}`,
    '',
    `The context map for the ${name} estate. This file routes a task to the notes that cover it. Status belongs in state files, not here.`,
    '',
    ...section('Where a task goes', routingTable(repos, inMap)),
    ...section('Write rules', ruleLines(writeRules)),
    BLOCK_START,
    ...section('The parts of the map', partLines(nodeDirs, workDir, inMap)),
    '`context-central resolve <item or words>` lists the notes behind a task.',
    BLOCK_END,
    '',
  ].join('\n')
}

export function mapBlock({ workDir }, inMap = rel => rel) {
  return [
    BLOCK_START,
    '## Context map',
    '',
    `This folder has a context map. Work in flight is recorded in \`${inMap(workDir)}/<item>/STATE.md\` and the estate's terms in \`${inMap('glossary.md')}\`. \`context-central resolve <item or words>\` lists the notes behind a task.`,
    BLOCK_END,
    '',
  ].join('\n')
}

const NODE_TEMPLATES = {
  repos: title => `# ${title}\n\n## What it is\n\n## Traps\n\n## How to work in it\n`,
  areas: title => `# ${title}\n\n## What it covers\n\n## Traps\n`,
  edges: title =>
    `# ${title}\n\nStatus is \`verified\` (checked in the code) or \`inferred\` (read from names or documents).\n\n| From | To | Status |\n|---|---|---|\n`,
}

export function nodeTemplate(kind, title) {
  return Object.hasOwn(NODE_TEMPLATES, kind) ? NODE_TEMPLATES[kind](title) : `# ${title}\n`
}

export function decisionTemplate(number, title) {
  return `# ${number}: ${title}\n\n## Context\n\n## Decision\n\n## Consequences\n`
}

export function stateTemplate(id, title) {
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

export function gitignoreTemplate({ hub, nodeDirs }) {
  const allowed = ['estate.json', hub, 'glossary.md', '.claude/', 'bin/', 'package.json', '.gitignore', '.gitattributes', ...nodeDirs.map(dir => `${dir}/`)]
  return ['/*', ...allowed.map(path => `!/${path}`), ''].join('\n')
}

export function gitattributesTemplate() {
  return 'log/*.md merge=union\n'
}

export function settingsTemplate(repo) {
  return {
    extraKnownMarketplaces: { [MARKETPLACE]: { source: { source: 'github', repo } } },
    enabledPlugins: { [`${PLUGIN}@${MARKETPLACE}`]: true },
    permissions: { allow: [`Bash(${PLUGIN} *)`] },
  }
}

export function launcherTemplate() {
  return `#!/bin/sh
if ! command -v node >/dev/null 2>&1; then
  echo "${PLUGIN}: node was not found on the PATH. Install Node 20 or later." >&2
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
  echo "${PLUGIN}: the plugin was not found. Add its marketplace with claude plugin marketplace add, then: claude plugin install ${PLUGIN}@${MARKETPLACE}" >&2
  echo "Or set CONTEXT_CENTRAL_CLI to the path of its bin/${PLUGIN} file." >&2
  exit 1
fi
exec node "$cli" "$@"
`
}

function section(heading, lines) {
  return lines.length > 0 ? [`## ${heading}`, '', ...lines, ''] : []
}

function routingTable(repos, inMap) {
  if (repos.length === 0) return []
  const rows = repos.map(repo => `| \`${repo.name}\` | ${repo.role ?? 'not recorded'} |`)
  return ['| Repo | Role |', '|---|---|', ...rows, '', `A repo gets a note under \`${inMap('repos')}/\` once work starts in it; link the note from this table then.`]
}

function ruleLines(rules) {
  if (!rules) return []
  if (typeof rules === 'string') return [`- ${rules}`]
  if (Array.isArray(rules)) return rules.map(rule => `- ${text(rule)}`)
  return Object.entries(rules).map(([name, rule]) => `- ${name}: ${text(rule)}`)
}

function text(value) {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function partLines(nodeDirs, workDir, inMap) {
  const parts = nodeDirs.map(dir => (dir === workDir ? `- \`${inMap(dir)}/<item>/STATE.md\`: where a piece of work stands and what is next.` : `- \`${inMap(dir)}/\`: ${PARTS[dir] ?? 'notes.'}`))
  return [...parts, `- \`${inMap('glossary.md')}\`: the estate's terms.`]
}
