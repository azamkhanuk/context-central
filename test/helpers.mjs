import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after } from 'node:test'
import { fileURLToPath } from 'node:url'

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const BIN = join(REPO, 'bin', 'context-central')

export const WINDOWS = process.platform === 'win32'
export const onlyOnWindows = reason => (WINDOWS ? {} : { skip: reason })
export const notOnWindows = reason => (WINDOWS ? { skip: reason } : {})
export const NEEDS_STAND_IN = notOnWindows('the stand-in for the tool is a shell script, which Windows cannot start')
export const EXE_NAMES = onlyOnWindows('only Windows finds a tool under a name ending in .exe or .com')

export function makeTree(files) {
  const root = withoutSymlinks(mkdtempSync(join(tmpdir(), 'context-central-test-')))
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`)
  }
  return root
}

function withoutSymlinks(path) {
  return realpathSync(path)
}

export function removeTree(root) {
  rmSync(root, { recursive: true, force: true })
}

export function disposable() {
  const trees = []
  after(() => trees.forEach(removeTree))
  return root => (trees.push(root), root)
}

export function spawned(command, args, { cwd = undefined, env = {}, input = undefined } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    input,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: process.env.HOME, CONTEXT_CENTRAL_NOW: '2026-01-15T12:00:00Z', ...env },
  })
  return { code: result.status, stdout: result.stdout, stderr: result.stderr }
}

export function run(args, { cwd = undefined, env = {}, stdin = '' } = {}) {
  return spawned(process.execPath, [BIN, ...args], { cwd, input: stdin, env })
}

export function hook(event, input, options = {}) {
  return run(['hook', event], { ...options, stdin: JSON.stringify(input) })
}

export const ACME_CONFIG = {
  contextCentral: 1,
  name: 'acme',
  title: 'Acme estate',
  repos: [
    { name: 'web', role: 'front end', baseBranch: 'main' },
    { name: 'api', role: 'back end', baseBranch: 'main' },
  ],
  leftAlone: ['scratch'],
  tracker: {
    type: 'jira',
    site: 'https://tracker.acme.example',
    projects: ['PROJ'],
    keyPatterns: ['PROJ-\\d+'],
  },
}

export const ACME_FILES = {
  'CLAUDE.md': '# Acme estate\n\n| The task is about | Go to |\n|---|---|\n| a screen | `web` |\n| a number that renders wrong | `api` |\n',
  'repos/web.md': '# web\n\nThe front end. Talks to [[repos/api]] through [[concepts/gateway]].\n',
  'repos/api.md': '# api\n\nThe back end. Rate limits are set per route.\n',
  'concepts/gateway.md': '# The gateway\n\nEvery call from web reaches api through one gateway. See [[edges/web-api]].\n',
  'edges/web-api.md': '# web to api\n\n| Path prefix | Owner | Status |\n|---|---|---|\n| /orders | api | verified |\n',
  'work/PROJ-12/STATE.md':
    '---\nitem: PROJ-12\ntitle: Rate limit the gateway\nstatus: active\n---\n# PROJ-12: Rate limit the gateway\n\n## Where it stands\n\nLimits are designed and not built. See [[concepts/gateway]] and [[repos/api]].\n\n## Next\n\nBuild the limiter in api.\n',
  'work/PROJ-12/SPEC.md': '# Spec: rate limit the gateway\n\nLimit each client to a fixed number of calls a minute.\n',
  'work/PROJ-12/notes/2026-01-10-research-rate-limits.md': '# Research: rate limits\n\nToken bucket fits.\n',
  'work/PROJ-12/sources/01-2026-01-09-PROJ-12-full-text.md': '# PROJ-12 full text\n\nThe ticket as written, in full.\n',
  'web/README.md': '# web checkout\n',
  'web/src/index.js': 'export {}\n',
  'api/README.md': '# api checkout\n',
  'scratch/notes.md': '# scratch\n',
  'elsewhere/readme.md': '# not registered\n',
}

export function acme(extraFiles = {}, configOverrides = {}) {
  return makeTree({ 'estate.json': { ...ACME_CONFIG, ...configOverrides }, ...ACME_FILES, ...extraFiles })
}

export const ACME_SHOT = 'work/PROJ-12/evidence/2026-01-14-limit-reached.png'
export const INDEX_CLOSING_LINE = "A work item's state file records where it stands and what is next. context-central resolve <item> lists the notes behind it. Evidence that is not text sits in the item's evidence/ folder, named in a note."

const ACME_STATE = 'work/PROJ-12/STATE.md'
const sizeOf = rel => Buffer.byteLength(ACME_FILES[rel])

export function acmeIndex(root) {
  return [
    `Context map "Acme estate": ${root}`,
    `Hub: ${join(root, 'CLAUDE.md')}`,
    'Work in flight (1):',
    `- PROJ-12 | Rate limit the gateway | ${join(root, ACME_STATE)}`,
    INDEX_CLOSING_LINE,
  ].join('\n')
}

export function acmePointers(root) {
  return [
    'Context for work item PROJ-12:',
    `- ${join(root, ACME_STATE)} (${sizeOf(ACME_STATE)} B) state file: where the work stands and what is next`,
    `- ${join(root, 'work/PROJ-12/SPEC.md')} (${sizeOf('work/PROJ-12/SPEC.md')} B) spec of the work item`,
    `- ${join(root, 'concepts/gateway.md')} (${sizeOf('concepts/gateway.md')} B) linked from the work item`,
    `- ${join(root, 'repos/api.md')} (${sizeOf('repos/api.md')} B) linked from the work item`,
    `Other notes of this item: 1 file (${sizeOf('work/PROJ-12/notes/2026-01-10-research-rate-limits.md')} B) under ${join(root, 'work/PROJ-12')}.`,
    `Deep tier: 1 file (${sizeOf('work/PROJ-12/sources/01-2026-01-09-PROJ-12-full-text.md')} B) under ${join(root, 'work/PROJ-12/sources')}, not listed one by one.`,
  ].join('\n')
}
