import type { Entry, PresetBody } from '../presets.mts'

const HOST = 'dev.azure.com'
const SEGMENT = '[^/\\s]+'

export default {
  program: 'az',
  kinds: {
    tickets: { references: entry => ['AB#(?<id>\\d+)', '#(?<id>\\d+)', `${projectAt(entry)}/_workitems/edit/(?<id>\\d+)`] },
    'pull-requests': { references: entry => [`${projectAt(entry)}/_git/(?<repo>${SEGMENT})/pullrequest/(?<id>\\d+)`] },
  },
} satisfies PresetBody

function projectAt({ org, project }: Entry) {
  return `https://${literal(HOST)}/${part(org)}/${part(project)}`
}

function part(value: unknown) {
  return typeof value === 'string' && value ? literal(value) : SEGMENT
}

function literal(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
