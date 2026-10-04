import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

function entriesOfTestFolder() {
  try {
    return readdirSync('test', { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

const files = entriesOfTestFolder()
  .filter(entry => !entry.isDirectory() && entry.name.endsWith('.test.mjs'))
  .map(entry => join('test', entry.name))
  .sort()

if (files.length === 0) {
  // Given no files, node --test goes looking on its own and can pass having run nothing.
  console.error('no test files found: nothing in test/ ends in .test.mjs')
  process.exitCode = 1
} else {
  process.exitCode = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' }).status ?? 1
}
