import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BRANCH = 'release'
const { name, version } = JSON.parse(readFileSync(join('.claude-plugin', 'plugin.json'), 'utf8')) as { name: string, version: string }
const tag = `${name}--v${version}`

function git(...args: string[]) {
  const ran = spawnSync('git', args, { encoding: 'utf8' })
  if (ran.status !== 0) throw new Error((ran.stderr || ran.error?.message || `git ${args[0]} exited ${ran.status}`).trim())
  return ran.stdout
}

function onOrigin() {
  const refs = git('ls-remote', 'origin', `refs/tags/${tag}`, `refs/tags/${tag}^{}`, `refs/heads/${BRANCH}`)
    .split('\n')
    .filter(Boolean)
    .map(line => line.split('\t'))
  const at = (ref: string) => refs.find(([, named]) => named === ref)?.[0]
  return { tagged: at(`refs/tags/${tag}^{}`) ?? at(`refs/tags/${tag}`), branch: at(`refs/heads/${BRANCH}`) }
}

try {
  const { tagged, branch } = onOrigin()
  if (!tagged) {
    console.log(`${tag} is not out, so ${BRANCH} stays where it is`)
  } else if (branch === tagged) {
    console.log(`${BRANCH} is at ${tag} already`)
  } else {
    const whole = git('rev-parse', '--is-shallow-repository').trim() === 'true' ? ['--unshallow'] : []
    const there = branch ? [`+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`] : []
    git('fetch', '-q', '--no-tags', ...whole, 'origin', `+refs/tags/${tag}:refs/tags/${tag}`, ...there)
    const kind = git('cat-file', '-t', tagged).trim()
    if (kind !== 'commit') throw new Error(`${tag} names a ${kind}, not a commit`)
    git('push', '-q', 'origin', `${tagged}:refs/heads/${BRANCH}`)
    console.log(`${BRANCH} moved to ${tag}, ${tagged.slice(0, 7)}`)
  }
} catch (error) {
  console.error(`${BRANCH} could not be moved to ${tag}: ${(error as Error).message}`)
  process.exitCode = 1
}
