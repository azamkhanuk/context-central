import { existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { PluginError, UsageError } from './errors.mjs'

const COMMANDS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'commands')
const COMMAND_NAME = /^[a-z][a-z-]*$/
const HELP_FLAGS = ['--help', '-h']

export async function main(argv, io = processIo()) {
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
    const wrongFlags = String(error.code).startsWith('ERR_PARSE_ARGS_')
    if (!wrongFlags && !(error instanceof PluginError)) throw error
    io.err(`context-central ${name}: ${error.message.replace(/\s*\n\s*/g, ' ')}`)
    return wrongFlags || error instanceof UsageError ? 2 : 1
  }
}

function processIo() {
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
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString('utf8')
}

async function loadCommand(name) {
  if (!COMMAND_NAME.test(name)) return null
  const file = join(COMMANDS_DIR, `${name}.mjs`)
  return existsSync(file) ? import(pathToFileURL(file).href) : null
}

async function help(io) {
  const names = readdirSync(COMMANDS_DIR)
    .filter(file => file.endsWith('.mjs'))
    .map(file => file.slice(0, -4))
    .sort()
  return usage(io, await Promise.all(names.map(async name => [name, await loadCommand(name)])))
}

function usage(io, commands) {
  io.out('Usage: context-central <command> [options]\n')
  for (const [name, command] of commands) io.out(`  ${name.padEnd(10)} ${command.summary ?? ''}`)
  return 0
}
