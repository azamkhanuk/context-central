import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { PluginError, UsageError, messageOf } from './errors.mts'
import { manifestPath } from './manifest.mts'

export type Env = NodeJS.ProcessEnv

export interface Io {
  cwd: string
  env: Env
  nodeVersion: string
  out: (text: string) => void
  err: (text: string) => void
  readStdin: () => Promise<string>
}

export type ExitCode = number | void

export interface Command {
  summary?: string
  run: (args: string[], io: Io) => ExitCode | Promise<ExitCode>
}

type Row = [name: string, summary: string | undefined]

const COMMANDS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'commands')
const COMMAND_NAME = /^[a-z][a-z-]*$/
const HELP_FLAGS = ['--help', '-h']
const VERSION_FLAG = '--version'
const TRACE_HINT = 'Set CONTEXT_CENTRAL_DEBUG=1 to see the trace.'

export async function main(argv: string[], io: Io = processIo()) {
  const [name, ...rest] = argv
  let known = ''
  try {
    if (!name || name === 'help' || HELP_FLAGS.includes(name)) return await help(io)
    if (name === VERSION_FLAG) return version(io)
    const command = await loadCommand(name)
    if (!command) {
      io.err(`context-central: unknown command "${name}". Run "context-central help".`)
      return 2
    }
    known = ` ${name}`
    if (HELP_FLAGS.includes(rest[0])) return usage(io, [[name, command.summary]])
    const code = await command.run(rest, io)
    return typeof code === 'number' ? code : 0
  } catch (error) {
    const wrongFlags = String((error as NodeJS.ErrnoException | null)?.code).startsWith('ERR_PARSE_ARGS_')
    const said = `context-central${known}: ${messageOf(error)}`
    if (wrongFlags || error instanceof PluginError) {
      io.err(said)
      return wrongFlags || error instanceof UsageError ? 2 : 1
    }
    const trace = error instanceof Error ? error.stack : undefined
    io.err(!io.env.CONTEXT_CENTRAL_DEBUG ? `${said}. ${TRACE_HINT}` : trace ? `${said}\n${trace}` : said)
    return 1
  }
}

function processIo(): Io {
  for (const stream of [process.stdout, process.stderr]) stream.on('error', endQuietly)
  return {
    cwd: process.cwd(),
    env: process.env,
    nodeVersion: process.versions.node,
    out: text => void process.stdout.write(`${text}\n`),
    err: text => void process.stderr.write(`${text}\n`),
    readStdin,
  }
}

function endQuietly(error: NodeJS.ErrnoException) {
  process.exit(error.code === 'EPIPE' ? 0 : 1)
}

async function readStdin() {
  if (process.stdin.isTTY) return ''
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

async function loadCommand(name: string): Promise<Command | null> {
  if (!COMMAND_NAME.test(name)) return null
  const file = join(COMMANDS_DIR, `${name}.mts`)
  return existsSync(file) ? (import(pathToFileURL(file).href) as Promise<Command>) : null
}

async function help(io: Io) {
  const names = readdirSync(COMMANDS_DIR)
    .filter(file => file.endsWith('.mts'))
    .map(file => file.slice(0, -4))
    .sort()
  const commands = await Promise.all(names.map(async (name): Promise<Row> => [name, (await loadCommand(name))!.summary]))
  return usage(io, [...commands, [VERSION_FLAG, 'Print the release, the Node it runs on and the system']])
}

function usage(io: Io, rows: Row[]) {
  io.out('Usage: context-central <command> [options]\n')
  for (const [name, summary] of rows) io.out(`  ${name.padEnd(10)} ${summary ?? ''}`)
  return 0
}

function version(io: Io) {
  const path = manifestPath(io.env)
  const release = releaseIn(path)
  if (!release) throw new PluginError(`${path} gives no version`)
  io.out(`context-central ${release} (Node ${io.nodeVersion}, ${process.platform} ${process.arch})`)
  return 0
}

function releaseIn(path: string) {
  try {
    const { version } = JSON.parse(readFileSync(path, 'utf8')) as { version?: unknown }
    return typeof version === 'string' && version ? version : null
  } catch {
    return null
  }
}
