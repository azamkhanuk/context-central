import { parseArgs } from 'node:util'
import { requireEstate } from '../estate.mjs'
import { lintEstate } from '../lint.mjs'

export const summary = 'Check the map against its budgets: hub, state files, notes, index'

export function run(args, io) {
  const { values } = parseArgs({ args, options: { json: { type: 'boolean' }, strict: { type: 'boolean' } } })
  const findings = lintEstate(requireEstate(io), io.env)
  io.out(values.json ? JSON.stringify(findings, null, 2) : report(findings))
  const failing = values.strict ? findings : findings.filter(found => found.level === 'ERROR')
  return failing.length > 0 ? 1 : 0
}

function report(findings) {
  if (findings.length === 0) return 'ok'
  return findings.map(found => `${found.level} ${found.message}`).join('\n')
}
