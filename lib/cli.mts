import { existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { PluginError, UsageError } from './errors.mts'

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

const COMMANDS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'commands')
const COMMAND_NAME = /^[a-z][a-z-]*$/
const HELP_FLAGS = ['--help', '-h']

export async function main(argv: string[], io: Io = processIo()) {
  const [name, ...rest] = argv
  if (!name || name === 'help' || HELP_FLAGS.includes(name)) return help(io)
  const command = await loadCommand(name)
  if (!command) {
    io.err(`context-central: unknown command "${name}". Run "context-central help".`)
    return 2
  }
  if (HELP_FLAGS.includes(rest[0])) return usage(io, [[name, command]])
  try {
    const code = await command.run(rest, io)
    return typeof code === 'number' ? code : 0
  } catch (error) {
    const wrongFlags = String((error as NodeJS.ErrnoException).code).startsWith('ERR_PARSE_ARGS_')
    if (!wrongFlags && !(error instanceof PluginError)) throw error
    io.err(`context-central ${name}: ${(error as Error).message.replace(/\s*\n\s*/g, ' ')}`)
    return wrongFlags || error instanceof UsageError ? 2 : 1
  }
}

function processIo(): Io {
  return {
    cwd: process.cwd(),
    env: process.env,
    nodeVersion: process.versions.node,
    out: text => void process.stdout.write(`${text}\n`),
    err: text => void process.stderr.write(`${text}\n`),
    readStdin,
  }
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
  return usage(io, await Promise.all(names.map(async (name): Promise<[string, Command]> => [name, (await loadCommand(name))!])))
}

function usage(io: Io, commands: [string, Command][]) {
  io.out('Usage: context-central <command> [options]\n')
  for (const [name, command] of commands) io.out(`  ${name.padEnd(10)} ${command.summary ?? ''}`)
  return 0
}
