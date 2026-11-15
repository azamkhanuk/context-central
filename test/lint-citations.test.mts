import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { NEEDS_STAND_IN, SOLO_CONFIG, disposable, git, makeTree, run, solo, standIns, workTree } from './helpers.mts'
import type { Checkout, TreeFiles } from './helpers.mts'

const tree = disposable()

const NOTE = '.context-central/standards/solo.md'
const OK = { code: 0, stdout: 'ok\n', stderr: '' }
const LIMIT = { 'src/limit.js': 'const LIMIT = 60\n\nexport function limited(calls) {\n  return calls > LIMIT\n}\n' }
const ONE_MOVED = `WARN standards: ${NOTE} has 1 citation that has moved since the commit it was read at (\`src/limit.js:4\`, at line 7); /context-central:standards solo refreshes the note\n`

const made = (one: Checkout) => (tree(one.base), one)
const lint = (one: Pick<Checkout, 'env'>, cwd: string, ...flags: string[]) => run(['lint', ...flags], { cwd, env: one.env })
const warned = (one: Checkout, cwd = one.main) => lint(one, cwd).stdout
const headOf = (one: Checkout, dir = one.main) => git(one, dir, 'rev-parse', 'HEAD').stdout.trim()

function put(root: string, path: string, content: string) {
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), content)
}

function committed(one: Checkout, files: TreeFiles, dir = one.main) {
  for (const [path, content] of Object.entries(files)) put(dir, path, String(content))
  git(one, dir, 'add', '-A')
  git(one, dir, 'commit', '-q', '-m', 'more')
  return headOf(one, dir)
}

function noted(one: Checkout, parts: string, commit = headOf(one).slice(0, 7), rel = NOTE) {
  put(one.main, rel, `# solo\n\nThe lines are those of \`solo\` at \`${commit}\`, on 2026-01-15.\n\n${parts}`)
}

test('a citation whose line reads as it did at the commit the note names earns no line, though its file has changed round it', () => {
  const one = made(solo(LIMIT))
  noted(one, '## Code\n\n- A limit is a constant, as `src/limit.js:1`. Source: the owner, 2026-01-15.\n')

  committed(one, { 'src/limit.js': 'const LIMIT = 60\nconst WINDOW = 1000\n\nexport function limited(calls) {\n  return calls > LIMIT\n}\n' })

  assert.deepEqual(lint(one, one.main), OK)
  assert.deepEqual(lint(one, one.main, '--strict'), OK)
})

test('a cited line that no longer reads as it did earns one warning, with the citation as the note writes it and its line in the note, and fails only under --strict', () => {
  const one = made(solo(LIMIT))
  noted(one, '## Code\n\n- A limit is compared in one place, as `src/limit.js:4`.\n')

  committed(one, { 'src/limit.js': 'const LIMIT = 60\nconst WINDOW = 1000\n\nexport function limited(calls) {\n  return calls > LIMIT\n}\n' })

  assert.deepEqual(lint(one, one.main), { code: 0, stdout: ONE_MOVED, stderr: '' })
  assert.equal(lint(one, one.main, '--strict').code, 1)
  assert.deepEqual(JSON.parse(lint(one, one.main, '--json').stdout), [{ level: 'WARN', check: 'standards', rel: NOTE, message: ONE_MOVED.slice('WARN '.length, -1) }])
})

test('a cited line changed only in the white space at its ends has not moved', () => {
  const one = made(solo(LIMIT))
  noted(one, '## Code\n\n- A limit is compared in one place, as `src/limit.js:4`.\n')

  committed(one, { 'src/limit.js': 'const LIMIT = 60\r\n\r\nexport function limited(calls) {\r\n\t\treturn calls > LIMIT  \r\n}\r\n' })

  assert.deepEqual(lint(one, one.main), OK)
})

test('a citation whose file is gone has moved', () => {
  const one = made(solo(LIMIT))
  noted(one, '## Code\n\n- A limit is compared in one place, as `src/limit.js:4`.\n')

  rmSync(join(one.main, 'src/limit.js'))
  committed(one, { 'src/limits.js': LIMIT['src/limit.js'] })

  assert.equal(warned(one), ONE_MOVED)
})

test('a citation with no line number has moved only when its file is gone', () => {
  const one = made(solo(LIMIT))
  noted(one, '## Design\n\n- The limiter is one module, `src/limit.js`.\n')

  committed(one, { 'src/limit.js': 'export const limited = () => false\n' })
  const changed = lint(one, one.main)
  rmSync(join(one.main, 'src/limit.js'))
  committed(one, {})

  assert.deepEqual(changed, OK)
  assert.equal(warned(one), `WARN standards: ${NOTE} has 1 citation that has moved since the commit it was read at (\`src/limit.js\`, at line 7); /context-central:standards solo refreshes the note\n`)
})

test('a range of lines has moved when any line of it reads another way, and not when the lines beside it do', () => {
  const beside = made(solo(LIMIT))
  const inside = made(solo(LIMIT))
  for (const one of [beside, inside]) noted(one, '## Code\n\n- A limit is compared in one function, as `src/limit.js:3-5`.\n')

  committed(beside, { 'src/limit.js': 'const LIMIT = 90\n\nexport function limited(calls) {\n  return calls > LIMIT\n}\n' })
  committed(inside, { 'src/limit.js': 'const LIMIT = 60\n\nexport function limited(calls) {\n  return calls >= LIMIT\n}\n' })

  assert.deepEqual(lint(beside, beside.main), OK)
  assert.equal(warned(inside), `WARN standards: ${NOTE} has 1 citation that has moved since the commit it was read at (\`src/limit.js:3-5\`, at line 7); /context-central:standards solo refreshes the note\n`)
})

test('a citation of a line the file did not have at the commit has moved, alone or at the end of a range', () => {
  const one = made(solo(LIMIT))

  noted(one, '## Code\n\n- A limit is compared in one place, as `src/limit.js:6`.\n- And in one function, as `src/limit.js:5-900000000`.\n- And nowhere else, as `src/limit.js:0`.\n')

  assert.equal(warned(one), `WARN standards: ${NOTE} has 3 citations that have moved since the commit they were read at (first \`src/limit.js:6\`, at line 7); /context-central:standards solo refreshes the note\n`)
})

test('several moved citations earn one warning with their count and the first, and a citation in two rules counts twice', () => {
  const one = made(solo({ ...LIMIT, 'src/window.js': 'export const WINDOW = 1000\n' }))
  noted(one, '## Design\n\n- The limiter is one module, `src/limit.js`.\n\n## Code\n\n- A window is a constant, as `src/window.js:1`.\n- A limit is compared in one place, as `src/limit.js:4`,\n  beside the window of `src/window.js:1`.\n\n## Tests\n\n- A limit is tested at its edge, as `src/limit.js:1`.\n')

  committed(one, { 'src/limit.js': 'const LIMIT = 60\n\nexport function limited(calls) {\n  return calls >= LIMIT\n}\n', 'src/window.js': 'export const WINDOW = 500\n' })

  assert.equal(warned(one), `WARN standards: ${NOTE} has 3 citations that have moved since the commit they were read at (first \`src/window.js:1\`, at line 11); /context-central:standards solo refreshes the note\n`)
})

test('a span in backticks that is no path, a path the repo never held and a folder are passed over', () => {
  const one = made(solo(LIMIT))
  noted(one, '## Code\n\n- Run `npm test` on `main` with `--strict`, never `src/limit.js:four` or `:4`, and read `src`, `src/`, `.`, `src/gone.js:1`, `/etc/hosts:1`, `C:\\limit.js:1` and `https://acme.example/limit.js:4`.\n')

  committed(one, { 'src/limit.js': 'export const limited = () => false\n' })

  assert.deepEqual(lint(one, one.main), OK)
})

test('a path that leads out of the repo is never asked of git, so the citations beside it are still compared', () => {
  const one = made(solo(LIMIT))
  put(one.base, 'outside.js', 'export {}\n')
  noted(one, '## Code\n\n- Nothing is read from `../outside.js:1`, `src/../../outside.js:1`, `..` or `src\\..\\..\\outside.js:1`.\n- A limit is compared in one place, as `src/limit.js:4`.\n')

  committed(one, { 'src/limit.js': 'export const limited = () => false\n' })

  assert.equal(warned(one), `WARN standards: ${NOTE} has 1 citation that has moved since the commit it was read at (\`src/limit.js:4\`, at line 8); /context-central:standards solo refreshes the note\n`)
})

test('a path is read once normalised, so one written with a dot or a doubled slash is the same file', () => {
  const one = made(solo(LIMIT))
  noted(one, '## Code\n\n- A limit is compared in one place, as `./src//limit.js:4`.\n')

  committed(one, { 'src/limit.js': 'export const limited = () => false\n' })

  assert.equal(warned(one), `WARN standards: ${NOTE} has 1 citation that has moved since the commit it was read at (\`./src//limit.js:4\`, at line 7); /context-central:standards solo refreshes the note\n`)
})

test('only a list item at the top level of one of the four parts is a rule, with the lines nested under it', () => {
  const one = made(solo(LIMIT))
  put(one.main, NOTE, [
    '# solo',
    '',
    `The lines are those of \`solo\` at \`${headOf(one).slice(0, 7)}\`, on 2026-01-15, as \`src/limit.js:4\`.`,
    '',
    '## Code',
    '',
    'A limit is compared in one place, as `src/limit.js:4`.',
    '',
    '- A limit is a constant.',
    '',
    '  It is compared in one place, as `src/limit.js:5`.',
    '',
    '### Older rules',
    '',
    '## Change log',
    '',
    '- The rule on `src/limit.js:4` was added.',
    '',
  ].join('\n'))

  committed(one, { 'src/limit.js': 'export const limited = () => false\n' })

  assert.equal(warned(one), `WARN standards: ${NOTE} has 1 citation that has moved since the commit it was read at (\`src/limit.js:5\`, at line 11); /context-central:standards solo refreshes the note\n`)
})

test('a note with no rule, and one whose rules cite nothing, earn no line', () => {
  const empty = made(solo(LIMIT))
  const uncited = made(solo(LIMIT))
  noted(empty, '## Design\n\n## Code\n\n## Tests\n\n## Review\n')
  noted(uncited, '## Design\n\n- The limiter is one module. Source: the owner, 2026-01-15.\n')

  for (const one of [empty, uncited]) committed(one, { 'src/limit.js': 'export const limited = () => false\n' })

  assert.deepEqual(lint(empty, empty.main), OK)
  assert.deepEqual(lint(uncited, uncited.main), OK)
})

test('a note whose lines end with a carriage return is read as any other', () => {
  const one = made(solo(LIMIT))
  put(one.main, NOTE, `# solo\r\n\r\nThe lines are those of \`solo\` at \`${headOf(one).slice(0, 7)}\`, on 2026-01-15.\r\n\r\n## Code\r\n\r\n- A limit is compared in one place, as \`src/limit.js:4\`.\r\n`)

  committed(one, { 'src/limit.js': 'export const limited = () => false\n' })

  assert.equal(warned(one), ONE_MOVED)
})

test('a cited file that is not text is compared as its bytes read as text', () => {
  const one = made(solo())
  const picture = (last: number) => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0a, 0x00, 0xff, last, 0x0a])
  writeFileSync(join(one.main, 'src/shot.png'), picture(1))
  committed(one, {})
  noted(one, '## Tests\n\n- A page is held to its picture, as `src/shot.png:2`.\n')
  const same = lint(one, one.main)

  writeFileSync(join(one.main, 'src/shot.png'), picture(2))
  committed(one, {})

  assert.deepEqual(same, OK)
  assert.equal(warned(one), `WARN standards: ${NOTE} has 1 citation that has moved since the commit it was read at (\`src/shot.png:2\`, at line 7); /context-central:standards solo refreshes the note\n`)
})

const AT_ITS_EDGE = 'const LIMIT = 60\n\nexport function limited(calls) {\n  return calls >= LIMIT\n}\n'
const PAST_ITS_EDGE = 'const LIMIT = 60\n\nexport function limited(calls) {\n  return calls - 1 >= LIMIT\n}\n'

test("a rule that names its own commit after a citation has every citation of it read there, where the note's commit would call them moved", () => {
  const learned = made(solo({ ...LIMIT, 'src/window.js': 'export const WINDOW = 1000\n' }))
  const unsourced = made(solo({ ...LIMIT, 'src/window.js': 'export const WINDOW = 1000\n' }))
  const rule = '- A limit is met at its edge, in the window of `src/window.js:1`.'
  for (const one of [learned, unsourced]) {
    const read = headOf(one).slice(0, 7)
    const built = committed(one, { 'src/limit.js': AT_ITS_EDGE, 'src/window.js': 'export const WINDOW = 500\n' }).slice(0, 7)
    noted(one, `## Code\n\n${rule}${one === learned ? ` Source: review rounds 1 and 2 of the work item \`PROJ-12\`, 2026-01-15, \`src/limit.js:4\` and \`src/window.js:1\` at \`${built}\`.` : ' As `src/limit.js:4`.'}\n`, read)
  }

  const asBuilt = lint(learned, learned.main)
  committed(learned, { 'src/limit.js': PAST_ITS_EDGE })

  assert.deepEqual(asBuilt, OK)
  assert.equal(warned(unsourced), `WARN standards: ${NOTE} has 2 citations that have moved since the commit they were read at (first \`src/window.js:1\`, at line 7); /context-central:standards solo refreshes the note\n`)
  assert.equal(warned(learned), ONE_MOVED)
})

test("a commit in a rule is the rule's own only straight after a citation with its line and the word at", () => {
  const one = made(solo(LIMIT))
  const read = headOf(one).slice(0, 7)
  const built = committed(one, { 'src/limit.js': AT_ITS_EDGE }).slice(0, 7)

  noted(one, `## Code\n\n- A limit is met at its edge, as \`src/limit.js:4\`, since \`${built}\` changed the module \`src/limit.js\` at \`${built}\`.\n`, read)

  assert.equal(warned(one), ONE_MOVED)
})

test('a rule whose own commit is not yet in the history of the head earns no line, and is compared once the head holds it', () => {
  const one = made(solo(LIMIT))
  const read = headOf(one).slice(0, 7)
  git(one, one.main, 'checkout', '-q', '-b', 'work/limit')
  const built = committed(one, { 'src/limit.js': AT_ITS_EDGE }).slice(0, 7)
  committed(one, { 'src/limit.js': PAST_ITS_EDGE })
  git(one, one.main, 'checkout', '-q', 'main')
  noted(one, `## Code\n\n- A limit is met at its edge. Source: review round 1 of the work item \`PROJ-12\`, 2026-01-15, \`src/limit.js:4\` at \`${built}\`.\n`, read)

  const onTheBase = lint(one, one.main)
  git(one, one.main, 'merge', '-q', 'work/limit')

  assert.deepEqual(onTheBase, OK)
  assert.equal(warned(one), ONE_MOVED)
})

test("a note whose commit is not yet in the history of the head earns no line, and its citations are compared once the head holds it", () => {
  const one = made(solo(LIMIT))
  git(one, one.main, 'checkout', '-q', '-b', 'work/limit')
  const refreshed = committed(one, { 'src/limit.js': AT_ITS_EDGE }).slice(0, 7)
  committed(one, { 'src/limit.js': PAST_ITS_EDGE })
  git(one, one.main, 'checkout', '-q', 'main')
  noted(one, '## Code\n\n- A limit is met at its edge, as `src/limit.js:4`.\n', refreshed)

  const onTheBase = lint(one, one.main)
  git(one, one.main, 'merge', '-q', 'work/limit')

  assert.deepEqual(onTheBase, OK)
  assert.equal(warned(one), ONE_MOVED)
})

test('a path is counted from the estate root where the repo held no such file under its own folder, in a repository of its own below the root', () => {
  const settings = { contextCentral: 1, name: 'acme', repos: [{ name: 'api' }, { name: 'web' }] }
  const base = tree(makeTree({ 'estate.json': settings, 'CLAUDE.md': '# Acme\n', gitconfig: '', 'api/src/limit.js': LIMIT['src/limit.js'], 'api/api/routes.js': 'export const routes = []\n' }))
  const api: Checkout = { base, main: join(base, 'api'), env: { GIT_CONFIG_GLOBAL: join(base, 'gitconfig'), GIT_CONFIG_NOSYSTEM: '1' } }
  git(api, api.main, 'init', '-q', '-b', 'main')
  committed(api, {})
  put(base, 'standards/api.md', `# api\n\nThe lines are those of \`api\` at \`${headOf(api).slice(0, 7)}\`, on 2026-01-15.\n\n## Code\n\n- Routes are one list, as \`api/routes.js:1\`.\n- A limit is compared in one place, as \`api/src/limit.js:4\`, never as \`web/src/limit.js:4\` or \`api/\`.\n`)

  committed(api, { 'src/limit.js': AT_ITS_EDGE, 'api/routes.js': 'export const routes = [limited]\n' })

  assert.equal(run(['lint'], { cwd: base, env: api.env }).stdout, 'WARN standards: standards/api.md has 2 citations that have moved since the commit they were read at (first `api/routes.js:1`, at line 7); /context-central:standards api refreshes the note\n')
})

test('a registered folder inside a larger repository is asked from its own folder, with a path counted from it or from the estate root', () => {
  const settings = { ...SOLO_CONFIG, repos: [{ name: 'api', path: 'packages/api/' }, { name: 'web', path: 'packages/web' }] }
  const one = made(solo({ '.context-central/estate.json': settings, 'packages/api/src/limit.js': LIMIT['src/limit.js'], 'packages/web/src/limit.js': LIMIT['src/limit.js'] }))
  for (const repo of ['api', 'web']) noted(one, `## Code\n\n- A limit is compared in one place, as \`src/limit.js:4\` and \`packages/${repo}/src/limit.js:4\`.\n`, headOf(one).slice(0, 7), `.context-central/standards/${repo}.md`)

  committed(one, { 'packages/api/src/limit.js': AT_ITS_EDGE })

  assert.equal(warned(one), 'WARN standards: .context-central/standards/api.md has 2 citations that have moved since the commit they were read at (first `src/limit.js:4`, at line 7); /context-central:standards api refreshes the note\n')
})

test('a note under another name is read for a repo whose name cannot name a note, and no other file the repo lists is', () => {
  const rules = '## Code\n\n- A limit is compared in one place, as `src/limit.js:4`.\n'
  const settings = { ...SOLO_CONFIG, repos: [{ name: 'solo tools', path: '.', standards: ['docs/rules.md', '.context-central/standards/tools.md'] }] }
  const one = made(solo({ ...LIMIT, '.context-central/estate.json': settings, 'docs/rules.md': `# Rules\n\nRead at \`0123abc\`.\n\n${rules}` }))
  noted(one, rules, headOf(one).slice(0, 7), '.context-central/standards/tools.md')

  committed(one, { 'src/limit.js': AT_ITS_EDGE })

  assert.equal(warned(one), 'WARN standards: .context-central/standards/tools.md has 1 citation that has moved since the commit it was read at (`src/limit.js:4`, at line 7); /context-central:standards solo tools refreshes the note\n')
})

test('in a git work tree a citation is compared with the head of the work tree, and in the main checkout with its own', () => {
  const one = made(solo(LIMIT))
  noted(one, '## Code\n\n- A limit is compared in one place, as `src/limit.js:4`.\n')
  const linked = workTree(one, join(one.base, 'tree'))

  committed(one, { 'src/limit.js': AT_ITS_EDGE }, linked)

  assert.equal(warned(one, linked), ONE_MOVED)
  assert.deepEqual(lint(one, one.main), OK)
})

test('with no git on the PATH nothing is said of a standards note', () => {
  const one = made(solo(LIMIT))
  noted(one, '## Code\n\n- A limit is compared in one place, as `src/limit.js:4`.\n')
  committed(one, { 'src/limit.js': 'export const limited = () => false\n' })

  assert.deepEqual(lint({ env: { ...one.env, PATH: tree(makeTree({})) } }, one.main), OK)
})

test('nothing is said of the note of a repo whose folder is missing, and the note of the repo beside it is still read', () => {
  const settings = { ...SOLO_CONFIG, repos: [{ name: 'gone', path: 'gone' }, { name: 'solo', path: '.' }] }
  const one = made(solo({ ...LIMIT, '.context-central/estate.json': settings }))
  noted(one, '## Code\n\n- A limit is compared in one place, as `src/limit.js:4`.\n', headOf(one).slice(0, 7), '.context-central/standards/gone.md')
  noted(one, '## Code\n\n- A limit is compared in one place, as `src/limit.js:4`.\n')

  committed(one, { 'src/limit.js': 'export const limited = () => false\n' })

  assert.equal(warned(one), ONE_MOVED)
})

test('nothing is said of the note of a repo whose folder is in no repository', () => {
  const settings = { contextCentral: 1, name: 'acme', repos: [{ name: 'api' }] }
  const note = '# api\n\nThe lines are those of `api` at `0123abc`, on 2026-01-15.\n\n## Code\n\n- A limit is compared in one place, as `limit.js:1`.\n'
  const root = tree(makeTree({ 'estate.json': settings, 'CLAUDE.md': '# Acme\n', 'standards/api.md': note, 'api/limit.js': 'export {}\n' }))

  assert.deepEqual(run(['lint'], { cwd: root }), OK)
  assert.deepEqual(run(['lint', '--strict'], { cwd: root }), OK)
})

test('a git that gives no answer in five seconds is asked once for a note, and nothing is said of it', NEEDS_STAND_IN, () => {
  const one = made(solo(LIMIT))
  noted(one, '## Code\n\n- A limit is compared in one place, as `src/limit.js:4`.\n')
  committed(one, { 'src/limit.js': 'export const limited = () => false\n' })
  const standIn = tree(standIns({ git: '#!/bin/sh\necho asked >> "$0.log"\nexec /bin/sleep 7\n' }))

  const result = lint({ env: { ...one.env, PATH: standIn } }, one.main)

  assert.deepEqual(result, OK)
  assert.equal(readFileSync(join(standIn, 'git.log'), 'utf8'), 'asked\n')
})

test('a git that exits other than 0 says nothing of the note', NEEDS_STAND_IN, () => {
  const one = made(solo(LIMIT))
  noted(one, '## Code\n\n- A limit is compared in one place, as `src/limit.js:4`.\n')
  committed(one, { 'src/limit.js': 'export const limited = () => false\n' })
  const standIn = tree(standIns({ git: '#!/bin/sh\necho "fatal: refused" >&2\nexit 128\n' }))

  assert.deepEqual(lint({ env: { ...one.env, PATH: standIn } }, one.main), OK)
})

test('the largest note, a thousand citations of a thousand files, starts git twice', NEEDS_STAND_IN, () => {
  const files = Object.fromEntries(Array.from({ length: 1000 }, (_, at) => [`src/part-${at}.js`, `export const part = ${at}\n`]))
  const one = made(solo(files))
  const real = process.env.PATH ?? ''
  const counting = tree(standIns({ git: `#!/bin/sh\necho "$*" >> "$0.log"\nPATH='${real}' exec git "$@"\n` }))
  const read = headOf(one)
  noted(one, `## Code\n\n${Object.keys(files).map(path => `- A part is one constant, as \`${path}:1\`.`).join('\n')}\n`)
  committed(one, { 'src/part-999.js': 'export const part = 0\n' })

  const result = lint({ env: { ...one.env, PATH: counting } }, one.main)

  assert.equal(result.stdout, `WARN node: standards/solo.md is 49 KB (soft cap 20 KB)\nWARN standards: ${NOTE} has 1 citation that has moved since the commit it was read at (\`src/part-999.js:1\`, at line 1006); /context-central:standards solo refreshes the note\n`)
  assert.equal(readFileSync(join(counting, 'git.log'), 'utf8'), `cat-file --batch\nrev-list ${read} --not HEAD\n`)
})
