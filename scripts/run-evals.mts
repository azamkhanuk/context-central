#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { clock } from '../lib/text.mts'

const CEILING_USD = '10'
const ALWAYS = ['--no-publish', '--scaffold', '--model', 'claude-sonnet-5-5', '--threshold', '0']
const TRIAL = ['--runs', '1', '--ablation', 'none', '--keep-temp']
const NAME = /^[a-z][a-z0-9-]*$/
const CASE_FILES = ['prompt.md', 'case.yaml']
const PLAIN_WORD = /^[\w@%+=:,./-]+$/
const STDOUT = 1

class Refusal extends Error {}

type Group = { name: string, allowTools: string[], cases: string[] }
type Start = { group: Group, pick: string[] }
type Flags = ReturnType<typeof flagsIn>

function main(args: string[], env: NodeJS.ProcessEnv, cwd: string) {
  const flags = flagsIn(args)
  const ceiling = ceilingOf(flags['max-cost-usd'] ?? CEILING_USD)
  if (!existsSync(join(cwd, '.claude-plugin', 'plugin.json'))) throw new Refusal('no .claude-plugin/plugin.json here: run it from the root of the plugin')
  const starts = startsAsked(caseGroups(join(cwd, 'evals')), flags)
  const results = join(cwd, 'evals', 'results', clock(env).toISOString().replace(/[:.]/g, '-'))
  if (existsSync(results)) throw new Refusal(`${results} is there already`)
  const code = started(starts, ceiling, results, flags, env, cwd)
  if (existsSync(results)) say(`run-evals: results in ${results}`)
  return code
}

function started(starts: Start[], ceiling: number, results: string, flags: Flags, env: NodeJS.ProcessEnv, cwd: string) {
  let left = ceiling
  for (const [at, { group, pick }] of starts.entries()) {
    const later = starts.slice(at + 1).map(start => start.group.name)
    if (left <= 0) return stopped(2, `nothing is left of the ceiling of ${ceiling} USD`, [group.name, ...later])
    const out = join(results, group.name)
    const grants = group.allowTools.length > 0 ? ['--allow-tools', ...group.allowTools] : []
    const code = host(['.', ...ALWAYS, '--max-cost-usd', String(left), '--output-dir', out, ...(flags['trust-plugin'] ? ['--trust-plugin'] : []), ...(flags.trial ? TRIAL : []), ...pick, ...grants], env, cwd)
    if (code !== 0) return stopped(code, `the host ended ${group.name} with ${code}`, later)
    if (later.length === 0) break
    const document = join(out, 'aggregate-result.json')
    const cost = costIn(document)
    if (cost === null) return stopped(1, `${document} gives no costUsd, so what is left of the ceiling is not known`, later)
    left = Number((left - cost).toFixed(6))
  }
  return 0
}

function flagsIn(args: string[]) {
  const { values } = parsed(args)
  if (values.group !== undefined && values.case !== undefined) throw new Refusal('give --group or --case, not both')
  if (values.trial && values.case === undefined) throw new Refusal('--trial goes with --case')
  return values
}

function parsed(args: string[]) {
  try {
    return parseArgs({ args, options: { group: { type: 'string' }, case: { type: 'string' }, trial: { type: 'boolean' }, 'max-cost-usd': { type: 'string' }, 'trust-plugin': { type: 'boolean' } } })
  } catch (error) {
    const { code, message } = error as NodeJS.ErrnoException
    if (!String(code).startsWith('ERR_PARSE_ARGS_')) throw error
    throw new Refusal(message.split('. ')[0])
  }
}

function ceilingOf(figure: string) {
  const usd = Number(figure)
  if (figure.trim() === '' || !Number.isFinite(usd) || usd <= 0) throw new Refusal(`--max-cost-usd takes a number of USD above 0, not "${figure}"`)
  return usd
}

function caseGroups(dir: string): Group[] {
  const groups = folders(dir)
    .filter(name => existsSync(join(dir, name, 'group.json')))
    .map(name => ({ name, allowTools: grantsIn(dir, name), cases: folders(join(dir, name)).filter(found => CASE_FILES.some(file => existsSync(join(dir, name, found, file)))) }))
  if (groups.length === 0) throw new Refusal('no case group under evals/: a case group is a folder there that holds group.json')
  const cases = groups.flatMap(group => group.cases.map(name => ({ name, at: `${group.name}/${name}` })))
  const misnamed = [...groups.map(group => group.name), ...cases.map(one => one.at)].find(at => !at.split('/').every(name => NAME.test(name)))
  if (misnamed) throw new Refusal(`evals/${misnamed} is not named in small letters, digits and dashes, starting with a letter`)
  const twice = cases.find((one, at) => cases.findIndex(other => other.name === one.name) < at)
  if (twice) throw new Refusal(`two cases are named "${twice.name}": ${cases.filter(one => one.name === twice.name).map(one => one.at).join(' and ')}`)
  return groups
}

function folders(dir: string) {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

function grantsIn(dir: string, group: string) {
  const grants = (jsonIn(join(dir, group, 'group.json')) as { allowTools?: unknown } | null)?.allowTools
  if (!Array.isArray(grants) || !grants.every(grant => typeof grant === 'string' && grant !== '' && !grant.startsWith('-'))) throw new Refusal(`evals/${group}/group.json must be { "allowTools": [...] }, a list of grants, none of them a flag`)
  return grants as string[]
}

function startsAsked(groups: Group[], flags: Flags): Start[] {
  const { group: asked, case: one } = flags
  if (asked !== undefined) {
    const group = groups.find(candidate => candidate.name === asked)
    if (!group) throw new Refusal(`no case group "${asked}" under evals/; there are: ${groups.map(candidate => candidate.name).join(', ')}`)
    return [{ group, pick: ['--tag', asked] }]
  }
  if (one !== undefined) {
    const group = groups.find(candidate => candidate.cases.includes(one))
    if (!group) throw new Refusal(`no case "${one}" under evals/; there are: ${groups.flatMap(candidate => candidate.cases).join(', ')}`)
    return [{ group, pick: ['--case', one] }]
  }
  return groups.map(group => ({ group, pick: ['--tag', group.name] }))
}

function host(args: string[], env: NodeJS.ProcessEnv, cwd: string) {
  say(`run-evals: claude plugin eval ${args.map(quoted).join(' ')}`)
  const { error, status } = spawnSync('claude', ['plugin', 'eval', ...args], { cwd, env, stdio: 'inherit' })
  if ((error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') throw new Refusal('no claude on the PATH')
  if (error) throw error
  return status ?? 1
}

function costIn(document: string) {
  const cost = (jsonIn(document) as { costUsd?: unknown } | null)?.costUsd
  return typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 ? cost : null
}

function jsonIn(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function stopped(code: number, why: string, notStarted: string[]) {
  console.error(`run-evals: ${why}${notStarted.length > 0 ? `; not started: ${notStarted.join(', ')}` : ''}`)
  return code
}

function quoted(word: string) {
  return PLAIN_WORD.test(word) ? word : `'${word.replaceAll("'", "'\\''")}'`
}

// The host writes while this process waits on it, so a line has to be out before the host starts.
function say(line: string) {
  writeSync(STDOUT, `${line}\n`)
}

try {
  process.exitCode = main(process.argv.slice(2), process.env, process.cwd())
} catch (error) {
  if (!(error instanceof Refusal)) throw error
  console.error(`run-evals: ${error.message}`)
  process.exitCode = 2
}
