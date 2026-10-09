import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { REPO } from './helpers.mts'

const DOCS = readdirSync(join(REPO, 'docs')).filter(name => name.endsWith('.md')).sort().map(name => `docs/${name}`)

const prose = (file: string) => readFileSync(join(REPO, file), 'utf8').replace(/^[ \t]*```[\s\S]*?^[ \t]*```[ \t]*\r?$/gm, '')
const anchors = (file: string) => [...prose(file).matchAll(/^#+ (.+?)\r?$/gm)].map(([, heading]) => heading.toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, '').replaceAll(' ', '-'))
const links = (file: string) => [...prose(file).replace(/`[^`\n]*`/g, '').matchAll(/\]\(([^)\s]+)\)/g)].map(([, target]) => target).filter(target => !/^[a-z]+:/.test(target))

test('every link in the README and in a file under docs leads to a file that is there, and to a heading that file has', () => {
  const dead = ['README.md', ...DOCS].flatMap(page => links(page)
    .filter(target => {
      const [path, anchor] = target.split('#')
      const file = path ? join(dirname(page), path) : page
      return !existsSync(join(REPO, file)) || (anchor !== undefined && !anchors(file).includes(anchor))
    })
    .map(target => `${page}: ${target}`))

  assert.deepEqual(dead, [])
})

test('the README links every file under docs, so none is reached only by its path', () => {
  const linked = links('README.md').map(target => target.split('#')[0])

  assert.deepEqual(DOCS.filter(file => !linked.includes(file)), [])
})
