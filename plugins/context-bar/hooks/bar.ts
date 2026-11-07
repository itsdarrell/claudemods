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

/** One character of the legend; no `color` draws it dim. */
export type Cell = { ch: string; color?: string }
/** Neighbouring cells of one color, drawn as one Text. */
export type Run = { text: string; color?: string }

const GAP = '   '

/**
 * The legend as one strip (`● msgs 29.7k   ● tools 12.4k   `): the `top`
 * biggest used rows, largest first; free space and the buffer are left out.
 * Each entry ends with a gap, so the strip loops seamlessly.
 */
export const legendStrip = (segments: Segment[], colors: string[], top = 3): Cell[] => {
  const ranked = segments
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.kind === 'used')
    .sort((a, b) => b.s.tokens - a.s.tokens)
    .slice(0, top)

  const cells: Cell[] = []
  for (const { s, i } of ranked) {
    cells.push({ ch: '●', color: colors[i] })
    for (const ch of ` ${shortName(s.name)} ${formatTokens(s.tokens)}${GAP}`) cells.push({ ch })
  }
  return cells
}

/** Whether the strip, less its trailing gap, is wider than `width`. */
export const scrolls = (strip: Cell[], width: number) => strip.length - GAP.length > width

/**
 * What the legend shows: the whole strip when it fits, else `width` cells of
 * it from `offset`, wrapping around, so the box keeps one width as it moves.
 */
export const marquee = (strip: Cell[], offset: number, width: number): Run[] => {
  const view = scrolls(strip, width)
    ? Array.from({ length: width }, (_, k) => strip[(offset + k) % strip.length]!)
    : strip.slice(0, Math.max(0, strip.length - GAP.length))

  const runs: Run[] = []
  for (const { ch, color } of view) {
    const last = runs[runs.length - 1]
    if (last && last.color === color) last.text += ch
    else runs.push(color ? { text: ch, color } : { text: ch })
  }
  return runs
}
