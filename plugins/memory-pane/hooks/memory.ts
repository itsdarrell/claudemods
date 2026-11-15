// Instruction files and auto-memory entries, the paths a write to counts as "memory".
export const MEMORY_PATH =
  /(^|\/)(CLAUDE(\.local)?\.md|\.claude\/rules\/[^/]+\.md|\.claude\/projects\/[^/]+\/memory\/[^/]+\.md)$/

const SECRET = /key|token|secret|password|credential|helper|auth/i

/** A home-relative path: the user's home folder shown as `~`. */
export const tilde = (path: string) => path.replace(/^\/(Users|home)\/[^/]+/, '~')

export const base = (path: string) => path.slice(path.lastIndexOf('/') + 1)

/** The `description:` line of a memory file's frontmatter, if it has one. */
export const describe = (text: string) => /^---[\s\S]*?\ndescription:\s*(.+)\n[\s\S]*?---/.exec(text)?.[1]?.trim()

/** A copy of a settings object with env values and secret-looking strings masked. */
export function mask(value: unknown, key = '', inEnv = false): unknown {
  if (typeof value === 'string') return inEnv || SECRET.test(key) ? '••••' : value
  if (Array.isArray(value)) return value.map(v => mask(v, key, inEnv))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mask(v, k, inEnv || k === 'env')]))
  }
  return value
}
