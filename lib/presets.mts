import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export type Entry = Record<string, unknown>

export interface Asked {
  reference: string
  id: string
  repo?: string
  entry: Entry
}

export interface Laid {
  id: string
  digest: string
  text: string
}

export interface Reading {
  args: string[]
  layout?: (printed: string, day: string) => Laid
}

export interface Kind {
  references: (entry: Entry) => string[]
  read?: (asked: Asked) => Reading
}

export interface Account {
  user: string
  active: boolean
}

export interface Accounts {
  args: string[]
  read: (printed: string) => Account[]
  fix: (wanted: string) => string
}

export interface OnOldMaps {
  accountKey?: string
  unasked?: boolean
}

export interface PresetBody {
  program: string
  hint?: string
  kinds: Record<string, Kind>
  remote?: (address: string) => Entry | null
  accounts?: Accounts
  onOldMaps?: OnOldMaps
}

export interface Preset extends PresetBody {
  name: string
}

const PLACE = join(dirname(fileURLToPath(import.meta.url)), 'presets')
const EXTENSION = '.mts'

export const PRESETS: Preset[] = await Promise.all(files().map(load))

export function presetNamed(name: unknown) {
  return PRESETS.find(preset => preset.name === name) ?? null
}

function files() {
  try {
    return readdirSync(PLACE)
      .filter(file => file.endsWith(EXTENSION))
      .sort()
  } catch {
    return []
  }
}

async function load(file: string): Promise<Preset> {
  const { default: body } = (await import(pathToFileURL(join(PLACE, file)).href)) as { default: PresetBody }
  return { ...body, name: file.slice(0, -EXTENSION.length) }
}
