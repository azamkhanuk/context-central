import { readFileSync, realpathSync } from 'node:fs'
import { ConfigError } from '../errors.mts'
import { coverage, findEstate, loadEstate } from '../estate.mts'
import { buildIndex } from '../index-text.mts'
import { findWorkItem } from '../nodes.mts'
import { formatPointers, formatUnanswered, resolveQuery, unansweredIn } from '../resolve.mts'
import { loadSession, resetSession, saveSession } from '../session.mts'
import { truncate } from '../text.mts'
import type { Env, Io } from '../cli.mts'
import type { Estate, MapLocation } from '../estate.mts'

interface HookInput {
  cwd?: string
  session_id?: unknown
  source?: string
  prompt?: unknown
  context_tokens: number
  prompt_cache_likely_expired?: unknown
}

interface HookAnswer {
  hookSpecificOutput?: { hookEventName: string; additionalContext: string }
  systemMessage?: string
}

type Handler = (estate: Estate, input: HookInput, env: Env) => HookAnswer | null

export const summary = 'Answer a Claude Code hook: session-start or user-prompt-submit'

const EVENTS: Record<string, Handler> = { 'session-start': sessionStart, 'user-prompt-submit': userPromptSubmit }
const CARRIES_STATE: (string | undefined)[] = ['compact', 'resume']
const CONTEXT_CHARS = 9500
const CUT = '\n[cut here; the file holds the rest]'

export async function run(args: string[], io: Io) {
  try {
    const answer = respond(args[0], JSON.parse(await io.readStdin()) as HookInput, io.env)
    if (answer) io.out(JSON.stringify(answer))
  } catch (error) {
    if (io.env.CONTEXT_CENTRAL_DEBUG) io.err(`context-central hook: ${(error as Error).stack ?? error}`)
  }
  return 0
}

function respond(event: string, input: HookInput, env: Env): HookAnswer | null {
  if (!Object.hasOwn(EVENTS, event ?? '')) throw new Error(`unknown hook event "${event}"`)
  const handler = EVENTS[event]
  const startDir = env.CLAUDE_PROJECT_DIR || input.cwd
  if (!startDir) return null
  const found = findEstate(startDir)
  if (!found || inAnotherMap(found, input.cwd)) return null
  try {
    const estate = loadEstate(startDir)!
    return coverage(estate, startDir) ? handler(estate, input, env) : null
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error
    return { systemMessage: `context-central: ${error.message}` }
  }
}

function inAnotherMap(found: MapLocation, cwd: string | undefined) {
  const other = cwd && findEstate(cwd)
  return !!other && real(other.configPath) !== real(found.configPath)
}

function real(path: string) {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

function sessionStart(estate: Estate, input: HookInput, env: Env): HookAnswer {
  if (input.source === 'clear') resetSession(env, input.session_id)
  const index = buildIndex(estate, { absolute: true })
  const text = CARRIES_STATE.includes(input.source) ? withState(estate, index, loadSession(env, input.session_id).active) : index
  return { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: truncate(text, CONTEXT_CHARS, CUT) }, ...resumeNotice(estate, input) }
}

function withState(estate: Estate, index: string, active: string | null) {
  const entry = active && findWorkItem(estate, active)?.entry
  if (!entry) return index
  return `${index}\n\nState of ${active} (${entry.path}):\n${readFileSync(entry.path, 'utf8').trimEnd()}`
}

function resumeNotice(estate: Estate, input: HookInput): HookAnswer {
  const threshold = estate.config.budgets.resumeNoticeTokens
  const tokens = input.context_tokens
  if (input.source !== 'resume' || input.prompt_cache_likely_expired !== true || !threshold || !(tokens >= threshold)) return {}
  return {
    systemMessage: `context-central: this session resumes with about ${Math.round(tokens / 1000)}k tokens uncached. If the earlier conversation is no longer needed, a fresh session started from the work item's state file is cheaper.`,
  }
}

function userPromptSubmit(estate: Estate, input: HookInput, env: Env): HookAnswer | null {
  if (typeof input.prompt !== 'string') return null
  // A pasted log or diff matches notes and titles by chance, so only a short prompt is matched on its words.
  const short = input.prompt.length <= estate.config.budgets.hookTextChars
  const session = loadSession(env, input.session_id)
  const isNew = ({ key }: { key: string }) => !session.delivered.includes(key)
  const resolution = [resolveQuery(estate, input.prompt, { plainWords: short })].filter(found => found !== null).filter(isNew)
  const unanswered = (short ? unansweredIn(estate, input.prompt) : []).filter(isNew)
  if (resolution.length + unanswered.length === 0) return null
  saveSession(env, input.session_id, { delivered: [...session.delivered, ...[...resolution, ...unanswered].map(({ key }) => key)], active: resolution[0]?.item ?? session.active })
  const lines = [...resolution.map(found => formatPointers(found, { absolute: true })), ...unanswered.map(formatUnanswered)]
  return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: lines.join('\n') } }
}
