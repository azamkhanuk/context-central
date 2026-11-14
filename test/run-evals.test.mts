import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { test } from 'node:test'
import { NEEDS_STAND_IN, REPO, disposable, makeTree, spawned, standIns } from './helpers.mts'
import type { Json, Result, TreeFiles } from './helpers.mts'

const SCRIPT = join(REPO, 'scripts', 'run-evals.mts')
const STAMP = '2026-01-15T12-00-00-000Z'
const NOTHING_STARTED = 0
const NOT_AS_ROOT = process.getuid?.() === 0 ? { skip: 'root writes to a folder whatever its mode' } : NEEDS_STAND_IN

const tree = disposable()

const THE_HOST = `#!/bin/sh
here="\${0%/*}"
refuse() { echo "stand-in claude: $1" >&2; exit 64; }
[ "$1" = plugin ] && [ "$2" = eval ] || refuse "only plugin eval is taken"
shift 2
[ -f "$here/carries-on" ] && heard=: || heard="exit 99"
[ -f "$here/dies" ] || for signal in TERM INT HUP; do trap "echo $signal > '$here/signalled'; $heard" $signal; done
start=$(( $(cat "$here/starts" 2>/dev/null || echo 0) + 1 ))
echo "$start" > "$here/starts"
printf '%s\\n' "$@" > "$here/args-$start"
[ -f "$here/dies" ] && kill -"$(cat "$here/dies")" $$
waited=0
while [ -f "$here/hold" ] && [ ! -f "$here/go" ] && [ $waited -lt 200 ]; do sleep 0.1; waited=$((waited + 1)); done
case "$1" in --*|'') refuse "the target comes first" ;; esac
shift
out=
while [ $# -gt 0 ]; do
  case "$1" in
    --no-publish|--scaffold|--trust-plugin|--keep-temp) shift ;;
    --model|--threshold|--max-cost-usd|--runs|--ablation|--case) [ $# -ge 2 ] || refuse "$1 takes a value"; shift 2 ;;
    --output-dir) out="$2"; shift 2 ;;
    --tag|--allow-tools) shift; while [ $# -gt 0 ]; do case "$1" in --*) break ;; *) shift ;; esac; done ;;
    *) refuse "unknown option $1" ;;
  esac
done
[ -n "$out" ] || refuse "no --output-dir"
mkdir -p "$out"
printf '{"costUsd": %s}\\n' "$(cat "$here/cost-$start" 2>/dev/null || cat "$here/cost")" > "$out/aggregate-result.json"
echo "the host ran start $start"
exit "$(cat "$here/code")"
`

const PLUGIN = { '.claude-plugin/plugin.json': { name: 'acme-tools', version: '0.1.0' } }
const PROMPT = '---\ntags: [x]\n---\n\nSay hello.\n'
const TWO_GROUPS: TreeFiles = {
  ...PLUGIN,
  'evals/acme.sh': 'true\n',
  'evals/reading/group.json': { allowTools: [] },
  'evals/reading/first/prompt.md': PROMPT,
  'evals/reading/second/prompt.md': PROMPT,
  'evals/writing/group.json': { allowTools: ['Write', 'Bash(acme *)'] },
  'evals/writing/third/prompt.md': PROMPT,
}

type Host = { dir: string, starts: () => number, args: (start: number) => string[], signalled: () => string | null, release: () => void }

function host({ code = 0, cost = '0.25', costs = {}, held = false, dies = '', carriesOn = false }: { code?: number, cost?: string, costs?: Record<number, string>, held?: boolean, dies?: string, carriesOn?: boolean } = {}): Host {
  const figures = Object.fromEntries(Object.entries(costs).map(([start, figure]) => [`cost-${start}`, figure]))
  const dir = tree(standIns({ claude: THE_HOST, code: `${code}\n`, cost, ...figures, ...(held ? { hold: '' } : {}), ...(dies ? { dies } : {}), ...(carriesOn ? { 'carries-on': '' } : {}) }))
  return {
    dir,
    starts: () => (existsSync(join(dir, 'starts')) ? Number(readFileSync(join(dir, 'starts'), 'utf8')) : NOTHING_STARTED),
    args: start => readFileSync(join(dir, `args-${start}`), 'utf8').trimEnd().split('\n'),
    signalled: () => (existsSync(join(dir, 'signalled')) ? readFileSync(join(dir, 'signalled'), 'utf8').trim() : null),
    release: () => writeFileSync(join(dir, 'go'), ''),
  }
}

const plugin = (files: TreeFiles = TWO_GROUPS) => tree(makeTree(files))
const started = (root: string, path: string, flags: string[], now?: string) => spawned(process.execPath, [SCRIPT, ...flags], { cwd: root, env: { PATH: path, ...(now ? { CONTEXT_CENTRAL_NOW: now } : {}) } })
const withTools = (dir: string) => [dir, '/usr/bin', '/bin'].join(delimiter)
const evals = (root: string, { dir }: Host, ...flags: string[]) => started(root, withTools(dir), flags)

function inFlight(root: string, { dir }: Host, ...flags: string[]) {
  const child = spawn(process.execPath, [SCRIPT, ...flags], { cwd: root, env: { PATH: withTools(dir), HOME: process.env.HOME, CONTEXT_CENTRAL_NOW: '2026-01-15T12:00:00Z' } })
  const said = { stdout: '', stderr: '' }
  child.stdout.setEncoding('utf8').on('data', (text: string) => (said.stdout += text))
  child.stderr.setEncoding('utf8').on('data', (text: string) => (said.stderr += text))
  return { child, said, ended: new Promise<Result>(resolve => child.on('close', code => resolve({ code, ...said }))) }
}

async function until(holds: () => boolean) {
  for (let waited = 0; !holds(); waited += 20) {
    if (waited > 10_000) assert.fail('waited ten seconds for the stand-in')
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}
const results = (root: string, group: string) => join(root, 'evals', 'results', STAMP, group)
const always = (root: string, group: string, ceiling = '10') => ['.', '--no-publish', '--scaffold', '--model', 'claude-sonnet-5-5', '--threshold', '0', '--max-cost-usd', ceiling, '--output-dir', results(root, group)]
const startedLine = (root: string, group: string, rest: string) => `run-evals: claude plugin eval ${always(root, group).join(' ')} ${rest}\n`

function refused(why: string, files: TreeFiles, ...flags: string[]) {
  const stand = host()
  const result = evals(plugin(files), stand, ...flags)

  assert.deepEqual({ ...result, starts: stand.starts() }, { code: 2, stdout: '', stderr: `run-evals: ${why}\n`, starts: NOTHING_STARTED })
}

test('the host is started for a case group with the report kept local, the scaffolds on, the model pinned, no score that fails the run and a ceiling of 10 USD', NEEDS_STAND_IN, () => {
  const stand = host()
  const root = plugin()

  const result = evals(root, stand, '--group', 'reading')

  assert.equal(result.code, 0, result.stderr)
  assert.deepEqual(stand.args(1), [...always(root, 'reading'), '--tag', 'reading'])
})

test('with no flag every case group is started, in the order of their names', NEEDS_STAND_IN, () => {
  const stand = host()
  const root = plugin()

  const result = evals(root, stand)

  assert.equal(result.code, 0, result.stderr)
  assert.equal(stand.starts(), 2)
  assert.deepEqual(stand.args(1).slice(-2), ['--tag', 'reading'])
  assert.deepEqual(stand.args(2).slice(-5), ['--tag', 'writing', '--allow-tools', 'Write', 'Bash(acme *)'])
})

test("a case group's grants come last and its cases are named by its tag, and a group that only reads is started with no grant", NEEDS_STAND_IN, () => {
  const stand = host()
  const root = plugin()

  evals(root, stand)

  assert.equal(stand.args(1).includes('--allow-tools'), false)
  assert.deepEqual(stand.args(2), [...always(root, 'writing', '9.75'), '--tag', 'writing', '--allow-tools', 'Write', 'Bash(acme *)'])
})

test('the ceiling is for the run as a whole: a later start is given what the earlier ones left of it', NEEDS_STAND_IN, () => {
  const stand = host({ cost: '0.0018' })
  const root = plugin({ ...TWO_GROUPS, 'evals/later/group.json': { allowTools: [] }, 'evals/later/fourth/prompt.md': PROMPT })

  evals(root, stand, '--max-cost-usd', '1')

  const ceilings = [1, 2, 3].map(start => stand.args(start)[stand.args(start).indexOf('--max-cost-usd') + 1])
  assert.deepEqual(ceilings, ['1', '0.9982', '0.9964'])
})

test('a figure the person gives replaces the ceiling of 10 USD', NEEDS_STAND_IN, () => {
  const stand = host()
  const root = plugin()

  evals(root, stand, '--group', 'reading', '--max-cost-usd', '2.5')

  assert.deepEqual(stand.args(1), [...always(root, 'reading', '2.5'), '--tag', 'reading'])
})

test('one case is started by its name, with the grants of its case group', NEEDS_STAND_IN, () => {
  const stand = host()
  const root = plugin()

  const result = evals(root, stand, '--case', 'third')

  assert.equal(result.code, 0, result.stderr)
  assert.equal(stand.starts(), 1)
  assert.deepEqual(stand.args(1), [...always(root, 'writing'), '--case', 'third', '--allow-tools', 'Write', 'Bash(acme *)'])
})

test('a trial run is one case, once, in the arm with the plugin, with its temporary folder kept', NEEDS_STAND_IN, () => {
  const stand = host()
  const root = plugin()

  evals(root, stand, '--case', 'first', '--trial')

  assert.deepEqual(stand.args(1), [...always(root, 'reading'), '--runs', '1', '--ablation', 'none', '--keep-temp', '--case', 'first'])
})

test('the host is told the plugin is trusted only when the person says so', NEEDS_STAND_IN, () => {
  const stand = host()
  const root = plugin()

  evals(root, stand, '--group', 'reading', '--trust-plugin')

  assert.deepEqual(stand.args(1), [...always(root, 'reading'), '--trust-plugin', '--tag', 'reading'])
})

test('each start is printed before the host is started, and the results folder at the end', NEEDS_STAND_IN, () => {
  const stand = host()
  const root = plugin()

  const result = evals(root, stand)

  assert.deepEqual(result, {
    code: 0,
    stdout: [
      startedLine(root, 'reading', '--tag reading'),
      'the host ran start 1\n',
      `run-evals: claude plugin eval ${always(root, 'writing', '9.75').join(' ')} --tag writing --allow-tools Write 'Bash(acme *)'\n`,
      'the host ran start 2\n',
      `run-evals: results in ${join(root, 'evals', 'results', STAMP)}\n`,
    ].join(''),
    stderr: '',
  })
})

for (const code of [1, 2, 130, 143]) {
  test(`when the host ends a case group with ${code} the command ends with ${code}, starts no later group and names it`, NEEDS_STAND_IN, () => {
    const stand = host({ code })
    const root = plugin()

    const result = evals(root, stand)

    assert.equal(stand.starts(), 1)
    assert.deepEqual({ code: result.code, stderr: result.stderr }, { code, stderr: `run-evals: the host ended reading with ${code}; not started: writing\n` })
  })
}

for (const [signal, code] of [['TERM', 143], ['KILL', 137]] as const) {
  test(`a host ended by SIG${signal} is reported as ${code}, as a shell reports it, and no later case group is started`, NEEDS_STAND_IN, () => {
    const stand = host({ dies: signal })

    const result = evals(plugin(), stand)

    assert.deepEqual({ code: result.code, stderr: result.stderr, starts: stand.starts() }, { code, stderr: `run-evals: the host ended reading with ${code}; not started: writing\n`, starts: 1 })
  })
}

test('a terminate sent to the command is passed on to the host, and the command ends as the host does', NEEDS_STAND_IN, async () => {
  const stand = host({ held: true })
  const run = inFlight(plugin(), stand)
  await until(() => stand.starts() === 1)

  run.child.kill('SIGTERM')
  await until(() => run.said.stderr.includes('SIGTERM'))
  stand.release()
  const result = await run.ended

  assert.equal(stand.signalled(), 'TERM')
  assert.deepEqual({ code: result.code, stderr: result.stderr, starts: stand.starts() }, { code: 99, stderr: 'run-evals: SIGTERM: passed on to the host\nrun-evals: the host ended reading with 99; not started: writing\n', starts: 1 })
})

test('after a terminate is passed on no later case group is started, even where the host ends its own with 0', NEEDS_STAND_IN, async () => {
  const stand = host({ held: true, carriesOn: true })
  const run = inFlight(plugin(), stand)
  await until(() => stand.starts() === 1)

  run.child.kill('SIGTERM')
  await until(() => run.said.stderr.includes('SIGTERM'))
  stand.release()
  const result = await run.ended

  assert.equal(stand.signalled(), 'TERM')
  assert.deepEqual({ code: result.code, stderr: result.stderr, starts: stand.starts() }, { code: 143, stderr: 'run-evals: SIGTERM: passed on to the host\nrun-evals: stopped by SIGTERM; not started: writing\n', starts: 1 })
})

for (const [signal, heard] of [['SIGTERM', 'passed on to the host'], ['SIGINT', 'the host is left to end writing, and no later case group is started']] as const) {
  test(`${signal} during the last case group changes nothing where the host ends it with 0, since every case group asked for ran to its end`, NEEDS_STAND_IN, async () => {
    const stand = host({ held: true, carriesOn: true })
    const root = plugin()
    const run = inFlight(root, stand, '--group', 'writing')
    await until(() => stand.starts() === 1)

    run.child.kill(signal)
    await until(() => run.said.stderr.includes(signal))
    stand.release()
    const result = await run.ended

    assert.deepEqual({ code: result.code, stderr: result.stderr }, { code: 0, stderr: `run-evals: ${signal}: ${heard}\n` })
    assert.ok(result.stdout.endsWith(`run-evals: results in ${join(root, 'evals', 'results', STAMP)}\n`), result.stdout)
  })
}

for (const [signal, code] of [['SIGINT', 130], ['SIGHUP', 129]] as const) {
  test(`${signal} sent to the command alone is not passed on, since a terminal gives it to the host too, and once the host ends no later case group is started`, NEEDS_STAND_IN, async () => {
    const stand = host({ held: true })
    const run = inFlight(plugin(), stand)
    await until(() => stand.starts() === 1)

    run.child.kill(signal)
    await until(() => run.said.stderr.includes(signal))
    stand.release()
    const result = await run.ended

    assert.equal(stand.signalled(), null)
    assert.deepEqual({ code: result.code, stderr: result.stderr, starts: stand.starts() }, { code, stderr: `run-evals: ${signal}: the host is left to end reading, and no later case group is started\nrun-evals: stopped by ${signal}; not started: writing\n`, starts: 1 })
  })
}

test('a second run started at the same moment is refused while the first is in flight, so neither writes over the other', NEEDS_STAND_IN, async () => {
  const stand = host({ held: true })
  const root = plugin()
  const first = inFlight(root, stand, '--group', 'reading')
  await until(() => stand.starts() === 1)

  const second = evals(root, stand, '--group', 'reading')
  stand.release()
  const result = await first.ended

  assert.deepEqual({ code: second.code, stderr: second.stderr }, { code: 2, stderr: `run-evals: ${join(root, 'evals', 'results', STAMP)} is there already\n` })
  assert.deepEqual({ code: result.code, stderr: result.stderr, starts: stand.starts() }, { code: 0, stderr: '', starts: 1 })
})

test('when the host ends the last case group non-zero the command ends with its code and names no group', NEEDS_STAND_IN, () => {
  const stand = host({ code: 1 })

  const result = evals(plugin(), stand, '--group', 'writing')

  assert.deepEqual({ code: result.code, stderr: result.stderr }, { code: 1, stderr: 'run-evals: the host ended writing with 1\n' })
})

test('when nothing is left of the ceiling before a case group starts, it is not started and the command ends with 2', NEEDS_STAND_IN, () => {
  const stand = host({ cost: '1.5' })

  const result = evals(plugin(), stand, '--max-cost-usd', '1')

  assert.equal(stand.starts(), 1)
  assert.deepEqual({ code: result.code, stderr: result.stderr }, { code: 2, stderr: 'run-evals: nothing is left of the ceiling of 1 USD; not started: writing\n' })
})

for (const [what, cost] of [['no cost', '{}'], ['a cost that is not a number', '"a lot"'], ['nothing that can be read', '']]) {
  test(`when a result document carries ${what} and a case group is still to start, the command ends with 1 and does not start it`, NEEDS_STAND_IN, () => {
    const stand = host({ cost })
    const root = plugin()

    const result = evals(root, stand)

    assert.equal(stand.starts(), 1)
    assert.deepEqual({ code: result.code, stderr: result.stderr }, { code: 1, stderr: `run-evals: ${join(results(root, 'reading'), 'aggregate-result.json')} gives no costUsd, so what is left of the ceiling is not known; not started: writing\n` })
  })
}

test('the cost of the last case group is not read, since nothing is left to start', NEEDS_STAND_IN, () => {
  const stand = host({ costs: { 2: '' } })

  const result = evals(plugin(), stand)

  assert.deepEqual({ code: result.code, stderr: result.stderr, starts: stand.starts() }, { code: 0, stderr: '', starts: 2 })
})

test('a case group with no case is started, and the answer is left to the host', NEEDS_STAND_IN, () => {
  const stand = host({ code: 1 })
  const root = plugin({ ...PLUGIN, 'evals/empty/group.json': { allowTools: [] } })

  const result = evals(root, stand)

  assert.deepEqual(stand.args(1), [...always(root, 'empty'), '--tag', 'empty'])
  assert.equal(result.code, 1)
})

test('a second run at another moment gets a results folder of its own', NEEDS_STAND_IN, () => {
  const stand = host()
  const root = plugin()
  const at = (now: string) => started(root, withTools(stand.dir), ['--group', 'reading'], now)

  at('2026-01-15T12:00:00.000Z')
  at('2026-01-15T12:00:00.250Z')

  assert.deepEqual(readdirSync(join(root, 'evals', 'results')).sort(), ['2026-01-15T12-00-00-000Z', '2026-01-15T12-00-00-250Z'])
})

test('a flag the command does not know is refused, and nothing is started', NEEDS_STAND_IN, () => {
  refused("Unknown option '--publish-report'", TWO_GROUPS, '--publish-report')
})

test('a flag the command does not know is named whole, a dot in it included', NEEDS_STAND_IN, () => {
  refused("Unknown option '--publish. now'", TWO_GROUPS, '--publish. now')
})

test('a word that is no flag is refused, and nothing is started', NEEDS_STAND_IN, () => {
  refused("Unexpected argument 'reading'", TWO_GROUPS, 'reading')
})

test('a case group and a case cannot both be asked for', NEEDS_STAND_IN, () => {
  refused('give --group or --case, not both', TWO_GROUPS, '--group', 'reading', '--case', 'first')
})

test('a trial run is refused without a case', NEEDS_STAND_IN, () => {
  refused('--trial goes with --case', TWO_GROUPS, '--trial')
  refused('--trial goes with --case', TWO_GROUPS, '--group', 'reading', '--trial')
})

test('a case group that is not there is refused, with the ones that are', NEEDS_STAND_IN, () => {
  refused('no case group "missing" under evals/; there are: reading, writing', TWO_GROUPS, '--group', 'missing')
})

test('a case that is not there is refused, with the ones that are', NEEDS_STAND_IN, () => {
  refused('no case "missing" under evals/; there are: first, second, third', TWO_GROUPS, '--case', 'missing')
})

for (const figure of ['0', '-1', 'ten', '', 'Infinity', '1e999', '1e-7', '0.0000001', '0x10', ' 5', '5.', '1000000000', '1000000000000000000000']) {
  test(`a ceiling of "${figure}" is refused, since it is not a plain figure above 0 that the host is handed as it is written`, NEEDS_STAND_IN, () => {
    refused(`--max-cost-usd takes a figure in USD above 0, as 10 or 2.5, not "${figure}"`, TWO_GROUPS, `--max-cost-usd=${figure}`)
  })
}

test('a ceiling that starts with a dash and is given as a word of its own is refused in one line', NEEDS_STAND_IN, () => {
  const stand = host()

  const result = evals(plugin(), stand, '--max-cost-usd', '-5')

  assert.deepEqual({ code: result.code, stdout: result.stdout, starts: stand.starts() }, { code: 2, stdout: '', starts: NOTHING_STARTED })
  assert.match(result.stderr, /^run-evals: Option '--max-cost-usd[^\n]*\n$/)
})

for (const twice of [['--max-cost-usd', '5', '--max-cost-usd', '20'], ['--group', 'reading', '--group', 'writing'], ['--case', 'first', '--case', 'third']]) {
  test(`${twice[0]} given twice is refused, since the last would win without a word`, NEEDS_STAND_IN, () => {
    refused(`${twice[0]} is given more than once`, TWO_GROUPS, ...twice)
  })
}

test('an eval folder that is a file is refused as holding no case group', NEEDS_STAND_IN, () => {
  refused('no case group under evals/: a case group is a folder there that holds group.json', { ...PLUGIN, evals: 'not a folder\n' })
})

test('a clock that is not a time is refused', NEEDS_STAND_IN, () => {
  const stand = host()

  const result = started(plugin(), withTools(stand.dir), [], 'yesterday')

  assert.deepEqual({ ...result, starts: stand.starts() }, { code: 2, stdout: '', stderr: 'run-evals: CONTEXT_CENTRAL_NOW is "yesterday", which is not a time\n', starts: NOTHING_STARTED })
})

for (const [link, to] of [['linked', 'writing'], ['reading/linked', 'writing/third']]) {
  test(`a case group or a case that is a link, at evals/${link}, is refused, since it would be passed over without a word`, NEEDS_STAND_IN, () => {
    const stand = host()
    const root = plugin()
    symlinkSync(join(root, 'evals', to), join(root, 'evals', link))

    const result = evals(root, stand)

    assert.deepEqual({ ...result, starts: stand.starts() }, { code: 2, stdout: '', stderr: `run-evals: evals/${link} is a link: a case group and a case are folders of their own\n`, starts: NOTHING_STARTED })
  })
}

test("a link that is neither a case group nor a case is passed over, as the host's own results folder may be one", NEEDS_STAND_IN, () => {
  const stand = host()
  const root = plugin()
  const elsewhere = tree(makeTree({ 'shared/notes.md': 'shared by the cases\n' }))
  symlinkSync(elsewhere, join(root, 'evals', 'results'))
  symlinkSync(join(elsewhere, 'shared'), join(root, 'evals', 'reading', 'shared'))

  const result = evals(root, stand, '--group', 'reading')

  assert.deepEqual({ code: result.code, stderr: result.stderr, starts: stand.starts() }, { code: 0, stderr: '', starts: 1 })
  assert.ok(existsSync(join(elsewhere, STAMP, 'reading', 'aggregate-result.json')))
})

test('a folder that is not the root of a plugin is refused', NEEDS_STAND_IN, () => {
  refused('no .claude-plugin/plugin.json here: run it from the root of the plugin', Object.fromEntries(Object.entries(TWO_GROUPS).filter(([path]) => !path.startsWith('.claude-plugin'))))
})

test('a plugin with no case group is refused', NEEDS_STAND_IN, () => {
  refused('no case group under evals/: a case group is a folder there that holds group.json', PLUGIN)
  refused('no case group under evals/: a case group is a folder there that holds group.json', { ...PLUGIN, 'evals/loose/first/prompt.md': PROMPT })
})

const WRONG_GRANTS: [string, Json | string][] = [
  ['a list that holds a number', { allowTools: ['Write', 5] }],
  ['one string', { allowTools: 'Write' }],
  ['no allowTools', {}],
  ['a list alone', ['Write']],
  ['text that is not JSON', 'allowTools: []\n'],
  ['a grant the host would read as a flag', { allowTools: ['Write', '--publish-report'] }],
]

for (const [what, written] of WRONG_GRANTS) {
  test(`a group.json that holds ${what} is refused, whichever case group was asked for`, NEEDS_STAND_IN, () => {
    refused('evals/writing/group.json must be { "allowTools": [...] }, a list of grants, none of them a flag', { ...TWO_GROUPS, 'evals/writing/group.json': written }, '--group', 'reading')
  })
}

test('two cases of one name are refused, since the host picks a case by its name', NEEDS_STAND_IN, () => {
  refused('two cases are named "first": reading/first and writing/first', { ...TWO_GROUPS, 'evals/writing/first/prompt.md': PROMPT })
})

for (const misnamed of ['Other', '-tag', 'reading/-case', 'reading/Second.case']) {
  test(`a case group or a case at evals/${misnamed} is refused for its name, which the host could read as a flag or pass over`, NEEDS_STAND_IN, () => {
    const files = misnamed.includes('/') ? { [`evals/${misnamed}/prompt.md`]: PROMPT } : { [`evals/${misnamed}/group.json`]: { allowTools: [] } }

    refused(`evals/${misnamed} is not named in small letters, digits and dashes, starting with a letter`, { ...TWO_GROUPS, ...files })
  })
}

test('a results folder that is there already is refused, so no run writes over another', NEEDS_STAND_IN, () => {
  const stand = host()
  const root = plugin()
  mkdirSync(join(root, 'evals', 'results', STAMP), { recursive: true })

  const result = evals(root, stand)

  assert.deepEqual({ ...result, starts: stand.starts() }, { code: 2, stdout: '', stderr: `run-evals: ${join(root, 'evals', 'results', STAMP)} is there already\n`, starts: NOTHING_STARTED })
})

test('an evals/results that is a file is refused in one line, and nothing is started', NEEDS_STAND_IN, () => {
  const stand = host()
  const root = plugin({ ...TWO_GROUPS, 'evals/results': 'not a folder\n' })

  const result = evals(root, stand)

  assert.deepEqual({ ...result, starts: stand.starts() }, { code: 2, stdout: '', stderr: `run-evals: ${join(root, 'evals', 'results')} cannot be made a folder (EEXIST)\n`, starts: NOTHING_STARTED })
})

test('a results folder that may not be written in is refused in one line, and nothing is started', NOT_AS_ROOT, () => {
  const stand = host()
  const root = plugin()
  const folder = join(root, 'evals', 'results')
  mkdirSync(folder)
  chmodSync(folder, 0o555)

  const result = evals(root, stand)
  chmodSync(folder, 0o755)

  assert.deepEqual({ ...result, starts: stand.starts() }, { code: 2, stdout: '', stderr: `run-evals: ${join(folder, STAMP)} cannot be made (EACCES)\n`, starts: NOTHING_STARTED })
})

test('a results folder the host wrote nothing in is removed and not named', NEEDS_STAND_IN, () => {
  const stand = host({ dies: 'TERM' })
  const root = plugin()

  const result = evals(root, stand, '--group', 'reading')

  assert.deepEqual(result, { code: 143, stdout: startedLine(root, 'reading', '--tag reading'), stderr: 'run-evals: the host ended reading with 143\n' })
  assert.equal(existsSync(join(root, 'evals', 'results', STAMP)), false)
})

test('a claude on the PATH that may not be started is said in one line, and the command ends with 2', NEEDS_STAND_IN, () => {
  const root = plugin()

  const result = started(root, tree(makeTree({ claude: THE_HOST })), ['--group', 'reading'])

  assert.deepEqual(result, { code: 2, stdout: startedLine(root, 'reading', '--tag reading'), stderr: 'run-evals: claude cannot be started (EACCES)\n' })
  assert.equal(existsSync(join(root, 'evals', 'results', STAMP)), false)
})

test('with no claude on the PATH the command says so and ends with 2', NEEDS_STAND_IN, () => {
  const root = plugin()

  const result = started(root, tree(makeTree({})), ['--group', 'reading'])

  assert.deepEqual(result, { code: 2, stdout: startedLine(root, 'reading', '--tag reading'), stderr: 'run-evals: no claude on the PATH\n' })
  assert.equal(existsSync(join(root, 'evals', 'results', STAMP)), false)
})

test("the suite's own cases that only read are started with no grant", NEEDS_STAND_IN, () => {
  const stand = host()
  const root = plugin(PLUGIN)
  cpSync(join(REPO, 'evals'), join(root, 'evals'), { recursive: true, filter: source => !source.startsWith(join(REPO, 'evals', 'results')) })

  const result = evals(root, stand, '--group', 'reading')

  assert.equal(result.code, 0, result.stderr)
  assert.deepEqual(stand.args(1), [...always(root, 'reading'), '--tag', 'reading'])
})

test('npm run evals is the one command', () => {
  const { scripts } = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as { scripts: Record<string, string> }

  assert.equal(scripts.evals, 'node scripts/run-evals.mts')
})
