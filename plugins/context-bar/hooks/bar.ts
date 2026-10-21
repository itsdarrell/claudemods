import type { SessionContextBreakdown } from 'claude-code'

import type { Segment, Snapshot } from '../types'

export const toSnapshot = (b: SessionContextBreakdown): Snapshot => {
  const segments: Segment[] = []
  for (const c of b.categories) {
    if (c.kind === 'deferred' || c.tokens <= 0) continue
    segments.push({ name: c.name, tokens: c.tokens, color: c.color, kind: c.kind })
  }

  return {
    segments,
    totalTokens: b.totalTokens,
    maxTokens: b.rawMaxTokens,
    percentage: b.percentage,
  }
}

/**
 * Splits `width` cells among the segments by tokens (largest remainder), so
 * the cells always add up to `width`, and any non-empty used row gets at
 * least one cell when there is room.
 */
export const allocate = (segments: Segment[], width: number): number[] => {
  const total = segments.reduce((sum, s) => sum + s.tokens, 0)
  if (total <= 0 || width <= 0) return segments.map(() => 0)

  const exact = segments.map(s => (s.tokens / total) * width)
  const cells = exact.map(Math.floor)
  let left = width - cells.reduce((a, b) => a + b, 0)
  const order = exact
    .map((x, i) => ({ i, rem: x - Math.floor(x) }))
    .sort((a, b) => b.rem - a.rem)
  for (const { i } of order) {
    if (left <= 0) break
    cells[i]! += 1
    left -= 1
  }

  // Give tiny used rows a visible sliver, borrowed from the widest segment.
  segments.forEach((s, i) => {
    if (s.kind !== 'used' || cells[i]! > 0) return
    let widest = 0
    cells.forEach((c, j) => {
      if (c > cells[widest]!) widest = j
    })
    if (cells[widest]! > 1) {
      cells[widest]! -= 1
      cells[i] = 1
    }
  })

  return cells
}

export const formatTokens = (n: number): string =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1000
      ? `${(n / 1000).toFixed(1)}k`
      : `${n}`

// Muted palette for the used rows, in order; free and buffer stay quiet.
const PALETTE = ['#7aa2f7', '#bb9af7', '#7dcfff', '#9ece6a', '#e0af68', '#f7768e', '#73daca']
const FREE = '#3b4261'
const BUFFER = '#565f89'

export const paint = (segments: Segment[]): string[] => {
  let n = 0
  return segments.map(s =>
    s.kind === 'free' ? FREE : s.kind === 'buffer' ? BUFFER : PALETTE[n++ % PALETTE.length]!,
  )
}

const SHORT: Record<string, string> = {
  'System prompt': 'sys',
  'System tools': 'tools',
  'MCP tools': 'mcp',
  'Custom agents': 'agents',
  'Memory files': 'memory',
  'Skills': 'skills',
  'Messages': 'msgs',
  'Free space': 'free',
  'Autocompact buffer': 'buffer',
}

export const shortName = (name: string): string =>
  SHORT[name] ?? name.split(' ')[0]!.toLowerCase()

/** One-line legend entries (`sys 3.1k`), dropping the tail past `columns`. */
export const fitLegend = (segments: Segment[], columns: number) => {
  const out: { i: number; text: string }[] = []
  let used = 0
  segments.forEach((s, i) => {
    const text = `${shortName(s.name)} ${formatTokens(s.tokens)}`
    const w = text.length + 3
    if (used + w > columns) return
    used += w
    out.push({ i, text })
  })
  return out
}
