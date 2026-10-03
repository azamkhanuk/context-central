import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { disposable, makeTree, run } from './helpers.mjs'

const tree = disposable()

const DOC = `# Gateway

Intro line.

## Limits

Ten calls a minute.

### Per route

Orders get twenty.

\`\`\`sh
# not a heading
\`\`\`

## Traps

The limit resets on deploy.
`

const docTree = () => tree(makeTree({ 'notes/doc.md': DOC, 'notes/plain.md': 'No headings here.\n' }))
const slice = (root, ...args) => run(['slice', ...args], { cwd: root })

test('the contents list every heading with its line and the size of its section', () => {
  const root = docTree()

  const result = slice(root, 'notes/doc.md', '--toc')

  assert.equal(result.code, 0)
  assert.equal(
    result.stdout,
    'notes/doc.md: 4 headings (81 B of 156 B)\n1 # Gateway (156 B)\n5 ## Limits (94 B)\n9 ### Per route (62 B)\n17 ## Traps (38 B)\n',
  )
})

test('a file with no headings has empty contents', () => {
  const root = docTree()

  const result = slice(root, 'notes/plain.md', '--toc')

  assert.equal(result.code, 0)
  assert.equal(result.stdout, 'notes/plain.md: 0 headings (0 B of 18 B)\n')
})

test('a heading slice runs to the line before the next heading of the same or a higher level', () => {
  const root = docTree()

  const result = slice(root, 'notes/doc.md', '--heading', 'limits')

  assert.equal(result.code, 0)
  assert.equal(
    result.stdout,
    'notes/doc.md: ## Limits, lines 5-16 (94 B of 156 B)\n## Limits\n\nTen calls a minute.\n\n### Per route\n\nOrders get twenty.\n\n```sh\n# not a heading\n```\n\n',
  )
})

test('a heading slice takes the first heading containing the text', () => {
  const root = docTree()

  const result = slice(root, 'notes/doc.md', '--heading', 'ROUTE')

  assert.equal(result.stdout, 'notes/doc.md: ### Per route, lines 9-16 (62 B of 156 B)\n### Per route\n\nOrders get twenty.\n\n```sh\n# not a heading\n```\n\n')
})

test('the last heading runs to the end of the file', () => {
  const root = docTree()

  const result = slice(root, 'notes/doc.md', '--heading', 'Traps')

  assert.equal(result.stdout, 'notes/doc.md: ## Traps, lines 17-19 (38 B of 156 B)\n## Traps\n\nThe limit resets on deploy.\n')
})

test('a heading that matches nothing is a problem, and a line inside a code fence is not a heading', () => {
  const root = docTree()

  for (const text of ['Billing', 'not a heading']) {
    const result = slice(root, 'notes/doc.md', '--heading', text)

    assert.equal(result.code, 1, text)
    assert.equal(result.stderr, `context-central slice: no heading in notes/doc.md contains "${text}"\n`)
  }
})

test('a line slice shows those lines', () => {
  const root = docTree()

  const result = slice(root, 'notes/doc.md', '--lines', '2-3')

  assert.equal(result.code, 0)
  assert.equal(result.stdout, 'notes/doc.md: lines 2-3 (13 B of 156 B)\n\nIntro line.\n')
})

test('a line slice past the end stops at the last line', () => {
  const root = docTree()

  const result = slice(root, 'notes/doc.md', '--lines', '18-40')

  assert.equal(result.stdout, 'notes/doc.md: lines 18-19 (29 B of 156 B)\n\nThe limit resets on deploy.\n')
})

test('a line slice that starts past the end is a problem', () => {
  const root = docTree()

  const result = slice(root, 'notes/doc.md', '--lines', '30-40')

  assert.equal(result.code, 1)
  assert.match(result.stderr, /notes\/doc\.md has 19 lines/)
})

test('a line range that is not a range is wrong usage', () => {
  const root = docTree()

  for (const range of ['3', '0-4', '9-2', 'a-b']) assert.equal(slice(root, 'notes/doc.md', '--lines', range).code, 2, range)
})

test('a search shows each matching line numbered, with two lines either side', () => {
  const root = docTree()

  const result = slice(root, 'notes/doc.md', '--grep', 'twenty')

  assert.equal(result.code, 0)
  assert.equal(result.stdout, 'notes/doc.md: 1 match for /twenty/ (60 B of 156 B)\n9: ### Per route\n10: \n11: Orders get twenty.\n12: \n13: ```sh\n')
})

test('matches far apart are separate groups', () => {
  const root = docTree()

  const result = slice(root, 'notes/doc.md', '--grep', 'minute|resets', '--context', '1')

  assert.equal(
    result.stdout,
    'notes/doc.md: 2 matches for /minute|resets/ (71 B of 156 B)\n6: \n7: Ten calls a minute.\n8: \n--\n18: \n19: The limit resets on deploy.\n',
  )
})

test('matches whose surroundings touch are one group', () => {
  const root = docTree()

  const result = slice(root, 'notes/doc.md', '--grep', 'calls|twenty')

  assert.equal(
    result.stdout,
    'notes/doc.md: 2 matches for /calls|twenty/ (104 B of 156 B)\n5: ## Limits\n6: \n7: Ten calls a minute.\n8: \n9: ### Per route\n10: \n11: Orders get twenty.\n12: \n13: ```sh\n',
  )
})

test('a search with no context shows only the matching lines', () => {
  const root = docTree()

  const result = slice(root, 'notes/doc.md', '--grep', 'minute|resets', '--context', '0')

  assert.equal(result.stdout, 'notes/doc.md: 2 matches for /minute|resets/ (58 B of 156 B)\n7: Ten calls a minute.\n--\n19: The limit resets on deploy.\n')
})

test('a pattern that matches nothing is a problem', () => {
  const root = docTree()

  const result = slice(root, 'notes/doc.md', '--grep', 'billing')

  assert.equal(result.code, 1)
  assert.equal(result.stderr, 'context-central slice: no line in notes/doc.md matches /billing/\n')
})

test('a pattern that is not a regular expression is wrong usage', () => {
  const root = docTree()

  assert.equal(slice(root, 'notes/doc.md', '--grep', '(').code, 2)
})

test('a slice over the byte limit is cut at a line end and says so', () => {
  const root = docTree()

  const result = slice(root, 'notes/doc.md', '--lines', '1-19', '--max-bytes', '40')

  assert.equal(result.code, 0)
  assert.equal(result.stdout, 'notes/doc.md: lines 1-19 (35 B of 156 B)\n# Gateway\n\nIntro line.\n\n## Limits\n\n[cut at 40 bytes; narrow the slice]\n')
})

test('a slice within the byte limit is not cut', () => {
  const root = docTree()

  const result = slice(root, 'notes/doc.md', '--lines', '1-19', '--max-bytes', '156')

  assert.equal(result.stdout, `notes/doc.md: lines 1-19 (156 B of 156 B)\n${DOC}`)
})

test('a byte limit that is not a positive whole number is wrong usage', () => {
  const root = docTree()

  for (const limit of ['0', '-5', 'lots']) assert.equal(slice(root, 'notes/doc.md', '--toc', `--max-bytes=${limit}`).code, 2, limit)
})

test('exactly one way of slicing must be chosen', () => {
  const root = docTree()

  assert.equal(slice(root, 'notes/doc.md').code, 2)
  assert.equal(slice(root, 'notes/doc.md', '--toc', '--lines', '1-2').code, 2)
  assert.equal(slice(root, '--toc').code, 2)
})

test('the file can be named by its absolute path', () => {
  const root = docTree()
  const path = join(root, 'notes/doc.md')

  const result = slice(tree(makeTree({})), path, '--lines', '3-3')

  assert.equal(result.stdout, `${path}: lines 3-3 (12 B of 156 B)\nIntro line.\n`)
})

test('a file that is not there is a problem', () => {
  const root = docTree()

  const result = slice(root, 'notes/missing.md', '--toc')

  assert.equal(result.code, 1)
  assert.equal(result.stderr, 'context-central slice: notes/missing.md: no such file\n')
})

test('a flag slice does not know, or a flag missing its value, is wrong usage said in one line', () => {
  const root = docTree()

  for (const args of [['--bogus'], ['--heading'], ['--grep', '-x']]) {
    const result = slice(root, 'notes/doc.md', ...args)

    assert.equal(result.code, 2, args.join(' '))
    assert.match(result.stderr, /^context-central slice: .*\n$/, args.join(' '))
  }
})

test('a pattern that starts with a dash can be given with an equals sign', () => {
  const root = tree(makeTree({ 'list.md': 'Steps\n- build\n- ship\n' }))

  const result = slice(root, 'list.md', '--grep=- ship', '--context', '0')

  assert.equal(result.stdout, 'list.md: 1 match for /- ship/ (10 B of 21 B)\n3: - ship\n')
})

test('a fence is closed only by its own kind of mark', () => {
  const root = tree(makeTree({ 'fenced.md': '~~~\n```\n# inside\n~~~\n# Outside\n' }))

  const result = slice(root, 'fenced.md', '--toc')

  assert.equal(result.stdout, 'fenced.md: 1 heading (19 B of 31 B)\n5 # Outside (10 B)\n')
})

test('a comment in the frontmatter is not a heading', () => {
  const root = tree(makeTree({ 'node.md': '---\ntitle: Gateway\n# set by hand\n---\n# Gateway\n' }))

  const result = slice(root, 'node.md', '--toc')

  assert.equal(result.stdout, 'node.md: 1 heading (19 B of 47 B)\n5 # Gateway (10 B)\n')
})

test('a heading can be asked for as the contents print it, hashes and all', () => {
  const root = docTree()

  const result = slice(root, 'notes/doc.md', '--heading', '## traps')

  assert.equal(result.stdout, 'notes/doc.md: ## Traps, lines 17-19 (38 B of 156 B)\n## Traps\n\nThe limit resets on deploy.\n')
})

test('a heading on the last line of the file is a section of one line', () => {
  const root = tree(makeTree({ 'tail.md': '# Gateway\n\nText.\n\n## Open questions' }))

  const result = slice(root, 'tail.md', '--heading', 'open')

  assert.equal(result.code, 0)
  assert.equal(result.stdout, 'tail.md: ## Open questions, lines 5-5 (18 B of 36 B)\n## Open questions\n')
})

test('a line longer than the byte limit is cut inside the line', () => {
  const root = docTree()

  const result = slice(root, 'notes/doc.md', '--lines', '3-3', '--max-bytes', '5')

  assert.equal(result.stdout, 'notes/doc.md: lines 3-3 (6 B of 156 B)\nIntro\n[cut at 5 bytes; narrow the slice]\n')
})
