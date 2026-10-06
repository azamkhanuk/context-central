import type { Entry, PresetBody } from '../presets.mts'

const HOST = 'github.com'

export default {
  program: 'gh',
  kinds: {
    tickets: { references: entry => ['#(?<id>\\d+)', 'GH-(?<id>\\d+)', `${repoAt(entry)}/issues/(?<id>\\d+)`] },
    'pull-requests': { references: entry => [`${repoAt(entry)}/pull/(?<id>\\d+)`] },
  },
  onOldMaps: { accountKey: 'ghUser', unasked: true },
} satisfies PresetBody

function repoAt({ host, org }: Entry) {
  return `https://${literal(typeof host === 'string' && host ? host : HOST)}/${typeof org === 'string' && org ? literal(org) : '[\\w.-]+'}/(?<repo>[\\w.-]+)`
}

function literal(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
