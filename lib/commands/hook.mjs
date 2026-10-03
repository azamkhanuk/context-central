import { readFileSync, realpathSync } from 'node:fs'
import { ConfigError } from '../errors.mjs'
import { coverage, findEstate, loadEstate } from '../estate.mjs'
import { buildIndex } from '../index-text.mjs'
import { findWorkItem } from '../nodes.mjs'
import { formatPointers, resolveQuery } from '../resolve.mjs'
import { loadSession, resetSession, saveSession } from '../session.mjs'
import { truncate } from '../text.mjs'

export const summary = 'Answer a Claude Code hook: session-start or user-prompt-submit'

const EVENTS = { 'session-start': sessionStart, 'user-prompt-submit': userPromptSubmit }
const CARRIES_STATE = ['compact', 'resume']
const CONTEXT_CHARS = 9500
const CUT = '\n[cut here; the file holds the rest]'

export async function run(args, io) {
  try {
    const answer = respond(args[0], JSON.parse(await io.readStdin()), io.env)
    if (answer) io.out(JSON.stringify(answer))
  } catch (error) {
    if (io.env.CONTEXT_CENTRAL_DEBUG) io.err(`context-central hook: ${error.stack ?? error}`)
  }
  return 0
}

function respond(event, input, env) {
  if (!Object.hasOwn(EVENTS, event ?? '')) throw new Error(`unknown hook event "${event}"`)
  const handler = EVENTS[event]
  const startDir = env.CLAUDE_PROJECT_DIR || input.cwd
  if (!startDir) return null
  const found = findEstate(startDir)
  if (!found || inAnotherMap(found, input.cwd)) return null
  try {
    const estate = loadEstate(startDir)
    return coverage(estate, startDir) ? handler(estate, input, env) : null
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error
    return { systemMessage: `context-central: ${error.message}` }
  }
}

function inAnotherMap(found, cwd) {
  const other = cwd && findEstate(cwd)
  return Boolean(other) && real(other.configPath) !== real(found.configPath)
}

function real(path) {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

function sessionStart(estate, input, env) {
  if (input.source === 'clear') resetSession(env, input.session_id)
  const index = buildIndex(estate, { absolute: true })
  const text = CARRIES_STATE.includes(input.source) ? withState(estate, index, loadSession(env, input.session_id).active) : index
  return { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: truncate(text, CONTEXT_CHARS, CUT) }, ...resumeNotice(estate, input) }
}

function withState(estate, index, active) {
  const entry = active && findWorkItem(estate, active)?.entry
  if (!entry) return index
  return `${index}\n\nState of ${active} (${entry.path}):\n${readFileSync(entry.path, 'utf8').trimEnd()}`
}

function resumeNotice(estate, input) {
  const threshold = estate.config.budgets.resumeNoticeTokens
  const tokens = input.context_tokens
  if (input.source !== 'resume' || input.prompt_cache_likely_expired !== true || !threshold || !(tokens >= threshold)) return {}
  return {
    systemMessage: `context-central: this session resumes with about ${Math.round(tokens / 1000)}k tokens uncached. If the earlier conversation is no longer needed, a fresh session started from the work item's state file is cheaper.`,
  }
}

function userPromptSubmit(estate, input, env) {
  if (typeof input.prompt !== 'string') return null
  // A pasted log or diff matches notes by chance, so only a short prompt is matched on its words.
  const resolution = resolveQuery(estate, input.prompt, { freeText: input.prompt.length <= estate.config.budgets.hookTextChars })
  if (!resolution) return null
  const session = loadSession(env, input.session_id)
  if (session.delivered.includes(resolution.key)) return null
  saveSession(env, input.session_id, { delivered: [...session.delivered, resolution.key], active: resolution.item ?? session.active })
  return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: formatPointers(resolution, { absolute: true }) } }
}
