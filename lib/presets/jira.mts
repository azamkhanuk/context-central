import type { Entry, PresetBody } from '../presets.mts'

const ANY_KEY = '[A-Z][A-Z0-9]+'

export default {
  program: 'acli',
  hint: 'install the Atlassian CLI and sign in with "acli jira auth login"',
  kinds: {
    tickets: {
      references,
      read: ({ id }) => ({ args: ['jira', 'workitem', 'view', id, '--fields', '*all', '--json'] }),
    },
  },
} satisfies PresetBody

function references({ keys, site }: Entry) {
  const named = Array.isArray(keys) ? keys.filter((key): key is string => typeof key === 'string' && key !== '').map(literal) : []
  const key = named.length > 0 ? `(?:${named.join('|')})` : null
  const link = typeof site === 'string' && site ? [`${literal(site.replace(/\/+$/, ''))}/browse/(?<id>${key ?? ANY_KEY}-\\d+)`] : []
  return [...(key ? [`(?<id>${key}-\\d+)`] : []), ...link]
}

function literal(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
