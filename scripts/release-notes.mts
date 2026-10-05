import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

const { values } = parseArgs({ options: { tag: { type: 'boolean' }, title: { type: 'boolean' } } })
const { name, version } = JSON.parse(readFileSync(join('.claude-plugin', 'plugin.json'), 'utf8')) as { name: string, version: string }

function sectionOf(changelog: string) {
  const lines = changelog.split('\n')
  const heading = lines.findIndex(line => line === `## ${version}` || line.startsWith(`## ${version} `))
  if (heading === -1) return null
  const below = lines.slice(heading + 1)
  const next = below.findIndex(line => line.startsWith('## '))
  return below
    .slice(0, next === -1 ? below.length : next)
    .join('\n')
    .trim()
}

if (values.tag) {
  console.log(`${name}--v${version}`)
} else if (values.title) {
  console.log(`${name} ${version}`)
} else {
  const notes = sectionOf(readFileSync('CHANGELOG.md', 'utf8'))
  if (notes === null) {
    console.error(`no section for ${version} in CHANGELOG.md`)
    process.exitCode = 1
  } else {
    console.log(notes)
  }
}
