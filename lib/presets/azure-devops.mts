import type { Entry, PresetBody } from '../presets.mts'

const HOST = 'dev.azure.com'
const SEGMENT = '[^/\\s]+'
const REMOTES = [
  /^https:\/\/(?:[^@/\s]+@)?dev\.azure\.com\/(?<org>[^/]+)\/(?<project>[^/]+)\/_git\/(?<repo>[^/]+?)\/?$/,
  /^(?:ssh:\/\/)?(?:[^@/\s]+@)?ssh\.dev\.azure\.com(?::\d+)?[:/]v3\/(?<org>[^/]+)\/(?<project>[^/]+)\/(?<repo>[^/]+?)\/?$/,
  /^https:\/\/(?:[^@/\s]+@)?(?<org>[^./]+)\.visualstudio\.com\/(?:DefaultCollection\/)?(?<project>[^/]+)\/_git\/(?<repo>[^/]+?)\/?$/,
]

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
  remote: address => {
    const found = REMOTES.map(shape => shape.exec(address)?.groups).find(Boolean)
    return found ? { ...found } : null
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
