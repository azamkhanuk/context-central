import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

const files = readdirSync('test', { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.test.mjs'))
  .map(entry => join('test', entry.name))
  .sort()

if (files.length === 0) {
  // Given no files, node --test goes looking on its own and can pass having run nothing.
  console.error('no test files found: nothing in test/ ends in .test.mjs')
  process.exitCode = 1
} else {
  process.exitCode = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' }).status ?? 1
}
