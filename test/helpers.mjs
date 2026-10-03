import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after } from 'node:test'
import { fileURLToPath } from 'node:url'

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const BIN = join(REPO, 'bin', 'context-central')

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

export function run(args, { cwd = undefined, env = {}, stdin = '' } = {}) {
  const result = spawnSync(process.execPath, [BIN, ...args], {
    cwd,
    input: stdin,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: process.env.HOME, CONTEXT_CENTRAL_NOW: '2026-01-15T12:00:00Z', ...env },
  })
  return { code: result.status, stdout: result.stdout, stderr: result.stderr }
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
