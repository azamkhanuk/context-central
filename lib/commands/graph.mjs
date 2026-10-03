import { parseArgs } from 'node:util'
import { requireEstate } from '../estate.mjs'
import { graphEstate } from '../graph.mjs'
import { plural } from '../text.mjs'

export const summary = 'Check the links between notes: broken links, orphans, unreferenced deep files'

export function run(args, io) {
  const { values } = parseArgs({ args, options: { json: { type: 'boolean' }, strict: { type: 'boolean' } } })
  const graph = graphEstate(requireEstate(io))
  io.out(values.json ? JSON.stringify(graph, null, 2) : report(graph))
  const reported = graph.broken.length + graph.orphans.length + graph.unreferenced.length
  return graph.broken.length > 0 || (values.strict && reported > 0) ? 1 : 0
}

function report(graph) {
  return [
    `${plural(graph.nodes, 'node')}, ${plural(graph.links, 'link')}`,
    ...graph.broken.map(link => `BROKEN ${link.from} -> ${link.target}`),
    ...graph.orphans.map(rel => `ORPHAN ${rel}`),
    ...graph.unreferenced.map(rel => `UNREFERENCED ${rel}`),
  ].join('\n')
}
