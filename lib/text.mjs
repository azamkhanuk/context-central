const BOM = '\uFEFF'
const FRONTMATTER = /^(\uFEFF?---\r?\n)([\s\S]*?)(\r?\n)---(?:\r?\n)?/

export function withoutBom(text) {
  return text.startsWith(BOM) ? text.slice(1) : text
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

export function plural(count, noun, many = `${noun}s`) {
  return `${count} ${count === 1 ? noun : many}`
}

export function parseFrontmatter(text) {
  const match = FRONTMATTER.exec(text)
  if (!match) return { data: {}, body: withoutBom(text) }
  const data = {}
  for (const line of match[2].split(/\r?\n/)) {
    const colon = line.indexOf(':')
    if (colon < 1) continue
    data[line.slice(0, colon).trim()] = unquote(line.slice(colon + 1).trim())
  }
  return { data, body: text.slice(match[0].length) }
}

export function setFrontmatter(text, key, value) {
  const line = `${key}: ${value}`
  const match = FRONTMATTER.exec(text)
  if (!match) return newBlock(text, line)
  const [, opening, block, closingEol] = match
  const lines = block.split('\n')
  const at = lines.findIndex(held => held.includes(':') && held.slice(0, held.indexOf(':')).trimEnd() === key)
  if (at !== -1) lines[at] = lines[at].endsWith('\r') ? `${line}\r` : line
  const changed = at === -1 ? `${block}${closingEol}${line}` : lines.join('\n')
  return `${opening}${changed}${text.slice(opening.length + block.length)}`
}

function newBlock(text, line) {
  const eol = endingOf(text)
  const mark = text.startsWith(BOM) ? BOM : ''
  return `${mark}---${eol}${line}${eol}---${eol}${text.slice(mark.length)}`
}

function endingOf(text) {
  return text.includes('\r\n') ? '\r\n' : '\n'
}

export function firstHeading(body) {
  return /^#\s+(.+?)\s*$/m.exec(body)?.[1] ?? null
}

export function headings(body) {
  return [...body.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)].map(match => match[1])
}

export function withoutCode(text) {
  return text.replace(/^ *(```|~~~)[\s\S]*?^ *\1[^\n]*$/gm, '').replace(/`[^`\n]*`/g, '')
}

export function truncate(text, max, suffix = '') {
  if (text.length <= max) return text
  const room = text.slice(0, max - suffix.length)
  const lastBreak = room.lastIndexOf('\n')
  return (lastBreak > 0 ? room.slice(0, lastBreak) : room) + suffix
}

export function localDate(env) {
  const now = env.CONTEXT_CENTRAL_NOW ? new Date(env.CONTEXT_CENTRAL_NOW) : new Date()
  const pad = number => String(number).padStart(2, '0')
  const month = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
  return { month, day: `${month}-${pad(now.getDate())}` }
}

function unquote(value) {
  const quoted = /^(["'])(.*)\1$/.exec(value)
  return quoted ? quoted[2] : value
}
