import type { Entry, PresetBody } from '../presets.mts'

const HOST = 'dev.azure.com'
const SEGMENT = '[^/\\s]+'

export default {
  program: 'az',
  hint: 'install the Azure CLI with its azure-devops extension and sign in with "az login"',
  kinds: {
    tickets: {
      references: entry => ['AB#(?<id>\\d+)', '#(?<id>\\d+)', `${projectAt(entry)}/_workitems/edit/(?<id>\\d+)`],
      read: ({ id, entry }) => ({ args: ['boards', 'work-item', 'show', '--id', id, '--expand', 'all', ...inOrganisation(entry), '--output', 'json'] }),
    },
    'pull-requests': {
      references: entry => [`${projectAt(entry)}/_git/(?<repo>${SEGMENT})/pullrequest/(?<id>\\d+)`],
      read: ({ id, entry }) => ({ args: ['repos', 'pr', 'show', '--id', id, ...inOrganisation(entry), '--output', 'json'] }),
    },
  },
} satisfies PresetBody

function inOrganisation({ org }: Entry) {
  return typeof org === 'string' && org ? ['--org', `https://${HOST}/${org}`] : []
}

function projectAt({ org, project }: Entry) {
  return `https://${literal(HOST)}/${part(org)}/${part(project)}`
}

function part(value: unknown) {
  return typeof value === 'string' && value ? literal(value) : SEGMENT
}

function literal(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
