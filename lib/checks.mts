export type Fail = (message: string) => never

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function text(value: unknown, name: string, fail: Fail): string {
  if (typeof value !== 'string' || !value) fail(`"${name}" must be text`)
  return value
}

export function strings(value: unknown, name: string, fail: Fail): string[] {
  const items = list(value, name, fail)
  if (items.some(item => typeof item !== 'string' || item === '')) fail(`"${name}" must be a list of non-empty strings`)
  return items as string[]
}

export function list(value: unknown, name: string, fail: Fail): unknown[] {
  if (!Array.isArray(value)) fail(`"${name}" must be a list`)
  return value
}

export function patterns(value: unknown, name: string, fail: Fail) {
  const sources = strings(value, name, fail)
  for (const source of sources) {
    try {
      new RegExp(source)
    } catch {
      fail(`${name}: "${source}" is not a valid regular expression`)
    }
  }
  return sources
}
