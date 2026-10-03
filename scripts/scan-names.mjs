#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { plural } from '../lib/text.mjs'

const MAX_GIT_OUTPUT = 256 * 1024 * 1024

class Refusal extends Error {}

function main(args, env, cwd) {
  const names = readNames(args[0] ?? env.CONTEXT_CENTRAL_PRIVATE_NAMES)
  const root = git(cwd, ['rev-parse', '--show-toplevel']).trim()
  const files = trackedFiles(root)
  const commits = commitMessages(root)
  const hits = [...files.flatMap(file => fileHits(root, file, names)), ...commits.flatMap(commit => commitHits(commit, names))]
  if (hits.length === 0) {
    console.log(`clean: ${plural(names.length, 'name')} checked against ${plural(files.length, 'file')} and ${plural(commits.length, 'commit')}`)
    return 0
  }
  for (const hit of hits) console.log(hit)
  return 1
}

function readNames(path) {
  if (!path) throw new Refusal('give a names file, or set CONTEXT_CENTRAL_PRIVATE_NAMES to its path')
  const names = readList(path)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
  if (names.length === 0) throw new Refusal(`${path} lists no names`)
  return names.map(name => ({ name, pattern: wholeWord(name) }))
}

function readList(path) {
  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    throw new Refusal(`cannot read ${path} (${error.code})`)
  }
}

function wholeWord(name) {
  const literal = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
  return new RegExp(`(?<![\\p{L}\\p{N}])${literal}(?![\\p{L}\\p{N}])`, 'iu')
}

function trackedFiles(root) {
  return git(root, ['ls-files', '-z']).split('\0').filter(Boolean)
}

function commitMessages(root) {
  return git(root, ['log', '--all', '-z', '--format=%h%n%B'])
    .split('\0')
    .filter(Boolean)
    .map(entry => ({ sha: entry.slice(0, entry.indexOf('\n')), message: entry.slice(entry.indexOf('\n') + 1) }))
}

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: MAX_GIT_OUTPUT })
  if (result.error) throw new Refusal(`cannot run git (${result.error.message})`)
  if (result.status !== 0) throw new Refusal(`${cwd} is not a git repository that git can read`)
  return result.stdout
}

function fileHits(root, file, names) {
  const staged = git(root, ['show', `:${file}`])
  return [
    ...found(file, names).map(name => `${file}: path: ${name}`),
    ...staged.split('\n').flatMap((line, index) => found(line, names).map(name => `${file}:${index + 1}: ${name}`)),
  ]
}

function commitHits(commit, names) {
  return found(commit.message, names).map(name => `commit ${commit.sha}: ${name}`)
}

function found(text, names) {
  return names.filter(({ pattern }) => pattern.test(text)).map(({ name }) => name)
}

try {
  process.exitCode = main(process.argv.slice(2), process.env, process.cwd())
} catch (error) {
  if (!(error instanceof Refusal)) throw error
  console.error(`scan-names: ${error.message}`)
  process.exitCode = 2
}
