#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmdirSync, writeSync } from 'node:fs'
import { constants } from 'node:os'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { clock } from '../lib/text.mts'

const CEILING_USD = '10'
const ALWAYS = ['--no-publish', '--scaffold', '--model', 'claude-sonnet-5-5', '--threshold', '0']
const TRIAL = ['--runs', '1', '--ablation', 'none', '--keep-temp']
const NAME = /^[a-z][a-z0-9-]*$/
const FIGURE = /^\d{1,9}(?:\.\d+)?$/
const FIRST_SENTENCE = /^(?:[^'.]|'[^']*')*/
const GROUP_FILES = ['group.json']
const CASE_FILES = ['prompt.md', 'case.yaml']
const PLAIN_WORD = /^[\w@%+=:,./-]+$/
const STDOUT = 1
// A terminal gives an interrupt or a hang-up to the host itself, so passing those on would tell it twice.
const PASSED_ON: NodeJS.Signals[] = ['SIGTERM']
const LEFT_TO_THE_TERMINAL: NodeJS.Signals[] = ['SIGINT', 'SIGHUP']

class Refusal extends Error {}

type Group = { name: string, allowTools: string[], cases: string[] }
type Start = { group: Group, pick: string[] }
type Flags = ReturnType<typeof flagsIn>
type Ended = { code: number, stoppedBy: NodeJS.Signals | null }

async function main(args: string[], env: NodeJS.ProcessEnv, cwd: string) {
  const flags = flagsIn(args)
  const ceiling = ceilingOf(flags.ceiling ?? CEILING_USD)
  if (!existsSync(join(cwd, '.claude-plugin', 'plugin.json'))) throw new Refusal('no .claude-plugin/plugin.json here: run it from the root of the plugin')
  const starts = startsAsked(caseGroups(join(cwd, 'evals')), flags)
  const results = claimed(join(cwd, 'evals', 'results', stamp(env)))
  const code = await started(starts, ceiling, results, flags, env, cwd).finally(() => removeIfEmpty(results))
  if (existsSync(results)) say(`run-evals: results in ${results}`)
  return code
}

async function started(starts: Start[], ceiling: number, results: string, flags: Flags, env: NodeJS.ProcessEnv, cwd: string) {
  let left = ceiling
  for (const [at, { group, pick }] of starts.entries()) {
    const later = starts.slice(at + 1).map(start => start.group.name)
    if (left <= 0) return stopped(2, `nothing is left of the ceiling of ${ceiling} USD`, [group.name, ...later])
    const out = join(results, group.name)
    const grants = group.allowTools.length > 0 ? ['--allow-tools', ...group.allowTools] : []
    const { code, stoppedBy } = await host(['.', ...ALWAYS, '--max-cost-usd', String(left), '--output-dir', out, ...(flags.trust ? ['--trust-plugin'] : []), ...(flags.trial ? TRIAL : []), ...pick, ...grants], group.name, env, cwd)
    if (code !== 0) return stopped(code, `the host ended ${group.name} with ${code}`, later)
    if (later.length === 0) break
    if (stoppedBy) return stopped(exitCodeOf(stoppedBy), `stopped by ${stoppedBy}`, later)
    const document = join(out, 'aggregate-result.json')
    const cost = costIn(document)
    if (cost === null) return stopped(1, `${document} gives no costUsd, so what is left of the ceiling is not known`, later)
    left = sixPlaces(left - cost)
  }
  return 0
}

function flagsIn(args: string[]) {
  const { values } = parsed(args)
  const once = (name: 'group' | 'case' | 'max-cost-usd') => {
    const given = values[name] ?? []
    if (given.length > 1) throw new Refusal(`--${name} is given more than once`)
    return given[0]
  }
  const flags = { group: once('group'), case: once('case'), ceiling: once('max-cost-usd'), trial: values.trial ?? false, trust: values['trust-plugin'] ?? false }
  if (flags.group !== undefined && flags.case !== undefined) throw new Refusal('give --group or --case, not both')
  if (flags.trial && flags.case === undefined) throw new Refusal('--trial goes with --case')
  return flags
}

function parsed(args: string[]) {
  try {
    return parseArgs({ args, options: { group: { type: 'string', multiple: true }, case: { type: 'string', multiple: true }, trial: { type: 'boolean' }, 'max-cost-usd': { type: 'string', multiple: true }, 'trust-plugin': { type: 'boolean' } } })
  } catch (error) {
    const { code, message } = error as NodeJS.ErrnoException
    if (!String(code).startsWith('ERR_PARSE_ARGS_')) throw error
    throw new Refusal(FIRST_SENTENCE.exec(message)?.[0] ?? message)
  }
}

function ceilingOf(figure: string) {
  const usd = FIGURE.test(figure) ? sixPlaces(Number(figure)) : 0
  if (!Number.isFinite(usd) || usd <= 0) throw new Refusal(`--max-cost-usd takes a figure in USD above 0, as 10 or 2.5, not "${figure}"`)
  return usd
}

function sixPlaces(usd: number) {
  return Number(usd.toFixed(6))
}

function stamp(env: NodeJS.ProcessEnv) {
  const now = clock(env)
  if (Number.isNaN(now.getTime())) throw new Refusal(`CONTEXT_CENTRAL_NOW is "${env.CONTEXT_CENTRAL_NOW}", which is not a time`)
  return now.toISOString().replace(/[:.]/g, '-')
}

// Making the folder is what claims it: two runs at one moment cannot both make it.
function claimed(results: string) {
  const all = join(results, '..')
  try {
    mkdirSync(all, { recursive: true })
  } catch (error) {
    throw new Refusal(`${all} cannot be made a folder (${(error as NodeJS.ErrnoException).code})`)
  }
  try {
    mkdirSync(results)
  } catch (error) {
    const { code } = error as NodeJS.ErrnoException
    throw new Refusal(code === 'EEXIST' ? `${results} is there already` : `${results} cannot be made (${code})`)
  }
  return results
}

function removeIfEmpty(folder: string) {
  try {
    rmdirSync(folder)
  } catch {
    return
  }
}

function caseGroups(dir: string): Group[] {
  const groups = foldersHolding(GROUP_FILES, dir, 'evals').map(name => ({ name, allowTools: grantsIn(dir, name), cases: foldersHolding(CASE_FILES, join(dir, name), `evals/${name}`) }))
  if (groups.length === 0) throw new Refusal('no case group under evals/: a case group is a folder there that holds group.json')
  const cases = groups.flatMap(group => group.cases.map(name => ({ name, at: `${group.name}/${name}` })))
  const misnamed = [...groups.map(group => group.name), ...cases.map(one => one.at)].find(at => !at.split('/').every(name => NAME.test(name)))
  if (misnamed) throw new Refusal(`evals/${misnamed} is not named in small letters, digits and dashes, starting with a letter`)
  const twice = cases.find((one, at) => cases.findIndex(other => other.name === one.name) < at)
  if (twice) throw new Refusal(`two cases are named "${twice.name}": ${cases.filter(one => one.name === twice.name).map(one => one.at).join(' and ')}`)
  return groups
}

function foldersHolding(files: string[], dir: string, shown: string) {
  const found = entriesOf(dir).filter(entry => files.some(file => existsSync(join(dir, entry.name, file))))
  const link = found.find(entry => entry.isSymbolicLink())
  if (link) throw new Refusal(`${shown}/${link.name} is a link: a case group and a case are folders of their own`)
  return found.map(entry => entry.name).sort()
}

function entriesOf(dir: string) {
  try {
    return readdirSync(dir, { withFileTypes: true })
  } catch (error) {
    if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) return []
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

function host(args: string[], group: string, env: NodeJS.ProcessEnv, cwd: string) {
  say(`run-evals: claude plugin eval ${args.map(quoted).join(' ')}`)
  return new Promise<Ended>((resolve, reject) => {
    const child = spawn('claude', ['plugin', 'eval', ...args], { cwd, env, stdio: 'inherit' })
    let stoppedBy: NodeJS.Signals | null = null
    const passOn = (signal: NodeJS.Signals) => {
      stoppedBy = signal
      console.error(`run-evals: ${signal}: passed on to the host`)
      child.kill(signal)
    }
    const leave = (signal: NodeJS.Signals) => {
      stoppedBy = signal
      console.error(`run-evals: ${signal}: the host is left to end ${group}, and no later case group is started`)
    }
    const heard = (hear: 'on' | 'off') => {
      for (const signal of PASSED_ON) process[hear](signal, passOn)
      for (const signal of LEFT_TO_THE_TERMINAL) process[hear](signal, leave)
    }
    heard('on')
    child.on('error', error => {
      heard('off')
      const { code } = error as NodeJS.ErrnoException
      reject(child.pid === undefined ? new Refusal(code === 'ENOENT' ? 'no claude on the PATH' : `claude cannot be started (${code})`) : error)
    })
    child.on('close', (status, signal) => {
      heard('off')
      resolve({ code: status ?? (signal ? exitCodeOf(signal) : 1), stoppedBy })
    })
  })
}

function exitCodeOf(signal: NodeJS.Signals) {
  return 128 + constants.signals[signal]
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
  process.exitCode = await main(process.argv.slice(2), process.env, process.cwd())
} catch (error) {
  if (!(error instanceof Refusal)) throw error
  console.error(`run-evals: ${error.message}`)
  process.exitCode = 2
}
