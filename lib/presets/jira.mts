import type { Entry, PresetBody } from '../presets.mts'

const ANY_KEY = '[A-Z][A-Z0-9]+'

export default {
  program: 'acli',
  kinds: {
    tickets: { references },
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
