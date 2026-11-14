import assert from 'node:assert/strict'
import { test } from 'node:test'
import { acme, disposable, run } from './helpers.mts'

const tree = disposable()

const SAVED = '01-2026-01-09-PROJ-12-full-text.md'
const OK = { code: 0, stdout: 'ok\n', stderr: '' }

const lint = (root: string, ...flags: string[]) => run(['lint', ...flags], { cwd: root })
const withNote = (text: string, at = 'concepts/limits.md') => tree(acme({ [at]: text }))

test('a claim marked verified that names no source earns its note one warning, with the line of the claim, and fails only under --strict', () => {
  const root = withNote('# Limits\n\n- Each shop gets 60 calls a minute. `verified`\n')

  assert.deepEqual(lint(root), { code: 0, stdout: 'WARN mark: concepts/limits.md has 1 claim marked verified that names no source (at line 3)\n', stderr: '' })
  assert.equal(lint(root, '--strict').code, 1)
  assert.deepEqual(JSON.parse(lint(root, '--json').stdout), [{ level: 'WARN', check: 'mark', rel: 'concepts/limits.md', message: 'mark: concepts/limits.md has 1 claim marked verified that names no source (at line 3)' }])
})

test('several claims with no source in one note are one line, with their count and the line of the first', () => {
  const root = withNote('# Limits\n\n- The bucket fills at a steady rate. `verified` (`api/src/limit.js:5`)\n- Each shop gets 60 calls a minute. `verified`\n- The limit is per shop. `verified`\n- A call over the limit is refused. `verified`\n')

  assert.equal(lint(root).stdout, 'WARN mark: concepts/limits.md has 3 claims marked verified that name no source (first at line 4)\n')
})

test('a claim names its source on its own line by a path with a line number, a web address, a link to a file or the name of a saved source', () => {
  const root = withNote(
    [
      '# Limits',
      '',
      '- The bucket holds a minute of calls. `verified` `api/src/limit.js:3`',
      '- A token bucket is the usual choice. `verified` https://example.com/token-bucket',
      '- Every call comes in through the gateway. `verified` ([the gateway](gateway.md))',
      '- The edge lists the routes. `verified` [[edges/web-api]]',
      `- The ticket asks for a limit for each shop. \`verified\` in ${SAVED}`,
      '',
    ].join('\n'),
  )

  assert.deepEqual(lint(root), OK)
})

test('a claim names its source on a line nested under it, with blank lines among them', () => {
  const root = withNote('# Limits\n\n- Each shop gets 60 calls a minute. `verified`\n\n  - The limiter takes it per minute.\n\n    - `api/src/limit.js:1`\n- The limit is per shop.\n')

  assert.deepEqual(lint(root), OK)
})

test('a source on a line that is not nested under the claim does not count for it', () => {
  const root = withNote('# Limits\n\n- Each shop gets 60 calls a minute. `verified`\n- See `api/src/limit.js:1` and https://example.com/token-bucket.\n\nSee also [the gateway](gateway.md).\n')

  assert.equal(lint(root).stdout, 'WARN mark: concepts/limits.md has 1 claim marked verified that names no source (at line 3)\n')
})

test('the name of a file the map does not hold under a sources folder is no source', () => {
  const root = withNote('# Limits\n\n- Each shop gets 60 calls a minute. `verified` in 2026-01-10-research-rate-limits.md and notes.txt\n')

  assert.equal(lint(root).stdout, 'WARN mark: concepts/limits.md has 1 claim marked verified that names no source (at line 3)\n')
})

test('a line that names both marks is about the marks and is passed over', () => {
  const root = withNote('# Limits\n\nEach claim is marked `verified` or `inferred`.\n\n| Claim | Mark |\n|---|---|\n| read in a primary source | `verified`, never `inferred` |\n')

  assert.deepEqual(lint(root), OK)
})

test('a row of a table that carries the mark is a claim, and a line that only talks about the mark is counted as one', () => {
  const root = withNote('# Limits\n\n| Claim | Mark |\n|---|---|\n| 60 calls a minute | `verified` |\n| per shop | `verified`, `api/src/limit.js:2` |\n\nA claim marked `verified` was read in a primary source.\n')

  assert.equal(lint(root).stdout, 'WARN mark: concepts/limits.md has 2 claims marked verified that name no source (first at line 5)\n')
})

test('a claim inside a fenced block is not a claim, and a fence left open hides the rest of the note', () => {
  const closed = withNote('# Limits\n\n```\n- Each shop gets 60 calls a minute. `verified`\n```\n\n~~~md\n- The limit is per shop. `verified`\n~~~\n')
  const open = withNote('# Limits\n\n```\nAn example.\n\n- Each shop gets 60 calls a minute. `verified`\n')

  assert.deepEqual(lint(closed), OK)
  assert.deepEqual(lint(open), OK)
})

test('a state file and a note of a work item are read, and a file of the deep tier and the hub are not', () => {
  const claim = '- Each shop gets 60 calls a minute. `verified`\n'
  const root = tree(acme({
    'CLAUDE.md': `# Acme estate\n\n${claim}`,
    'work/PROJ-12/sources/02-2026-01-11-thread-full-text.md': `# A thread\n\n${claim}`,
    'work/PROJ-12/notes/2026-01-10-research-rate-limits.md': `# Research: rate limits\n\n${claim}`,
    'work/PROJ-12/STATE.md': `---\nitem: PROJ-12\ntitle: Rate limit the gateway\nstatus: active\n---\n# PROJ-12\n\n${claim}\nSee \`02-2026-01-11-thread-full-text.md\`.\n`,
  }))

  assert.equal(
    lint(root).stdout,
    'WARN mark: work/PROJ-12/STATE.md has 1 claim marked verified that names no source (at line 8)\nWARN mark: work/PROJ-12/notes/2026-01-10-research-rate-limits.md has 1 claim marked verified that names no source (at line 3)\n',
  )
})

test('a saved source that is not Markdown is a source by its name', () => {
  const root = tree(acme({
    'docs/sources/pricing-page.html': '<html></html>\n',
    'work/PROJ-12/sources/vendor-report.pdf': 'a report\n',
    'concepts/limits.md': '# Limits\n\n- The vendor allows 60 calls a minute. `verified` in vendor-report.pdf\n- The plans are on one page. `verified`, pricing-page.html\n',
  }))

  assert.doesNotMatch(lint(root).stdout, /^WARN mark:/m)
})

test('the hub is not read where it sits in a node folder', () => {
  const root = tree(acme({ 'docs/HUB.md': '# Acme estate\n\n- Each shop gets 60 calls a minute. `verified`\n' }, { hub: 'docs/HUB.md' }))

  assert.doesNotMatch(lint(root).stdout, /^WARN mark:/m)
})

test('a fence closes only on a line of its own kind that is as long, and a line that opens with a code span is no fence', () => {
  const nested = withNote('# Limits\n\n````md\n```\n- Each shop gets 60 calls a minute. `verified`\n```\n````\n')
  const mixed = withNote('# Limits\n\n~~~\n```\n- Each shop gets 60 calls a minute. `verified`\n~~~\n')
  const span = withNote('# Limits\n\n```npm test``` runs the checks.\n\n- Each shop gets 60 calls a minute. `verified`\n')

  assert.deepEqual(lint(nested), OK)
  assert.deepEqual(lint(mixed), OK)
  assert.equal(lint(span).stdout, 'WARN mark: concepts/limits.md has 1 claim marked verified that names no source (at line 5)\n')
})

test('a claim inside a fenced block is not a claim in a note whose lines end with a carriage return and a line feed', () => {
  const root = withNote('# Limits\r\n\r\n```md\r\n- Each shop gets 60 calls a minute. `verified`\r\n```\r\n\r\n- The limit is per shop. `verified`\r\n')

  assert.equal(lint(root).stdout, 'WARN mark: concepts/limits.md has 1 claim marked verified that names no source (at line 7)\n')
})

test('a fence is a fence however far it is indented, under a nested bullet, a numbered step or a block quote', () => {
  const nested = withNote('# Limits\n\n- A step.\n  - A smaller step.\n\n    ```md\n    - Each shop gets 60 calls a minute. `verified`\n    ```\n')
  const numbered = withNote('# Limits\n\n10. A step.\n\n\t```md\n\t- Each shop gets 60 calls a minute. `verified`\n\t```\n')
  const quoted = withNote('# Limits\n\n> ```md\n> - Each shop gets 60 calls a minute. `verified`\n> ```\n')

  assert.deepEqual(lint(nested), OK)
  assert.deepEqual(lint(numbered), OK)
  assert.deepEqual(lint(quoted), OK)
})

test('a source nested under a claim counts inside a block quote, and where the claim is indented with spaces and the source with a tab', () => {
  const quoted = withNote('# Limits\n\n> - Each shop gets 60 calls a minute. `verified`\n>   - `api/src/limit.js:1`\n')
  const mixed = withNote('# Limits\n\n  - Each shop gets 60 calls a minute. `verified`\n\t- `api/src/limit.js:1`\n')

  assert.deepEqual(lint(quoted), OK)
  assert.deepEqual(lint(mixed), OK)
})

test('in a block quote a source on a line that is not nested under the claim does not count for it', () => {
  const root = withNote('# Limits\n\n> - Each shop gets 60 calls a minute. `verified`\n> - See `api/src/limit.js:1`.\n\n- The limit is per shop. `verified`\n> See https://example.com/token-bucket.\n')

  assert.equal(lint(root).stdout, 'WARN mark: concepts/limits.md has 2 claims marked verified that name no source (first at line 3)\n')
})
