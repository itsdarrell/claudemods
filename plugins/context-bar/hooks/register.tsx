import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Snapshot } from '../types'
import { allocate, formatTokens, legendStrip, marquee, paint, scrolls, toSnapshot } from './bar'

const isOn = atom({ plugin: 'context-bar', key: 'isOn' } as const, true)
const snapshot = atom({ plugin: 'context-bar', key: 'snapshot' } as const, null)
const offset = atom({ plugin: 'context-bar', key: 'offset' } as const, 0)
const isScrolling = atom({ plugin: 'context-bar', key: 'isScrolling' } as const, true)

const BAR_WIDTH = 12
const SCROLL_MS = 300

const totalText = (snap: Snapshot) =>
  ` ${snap.percentage}% · ${formatTokens(snap.totalTokens)}/${formatTokens(snap.maxTokens)}`

// The legend scrolls in a window as wide as the bar's own line.
const legendWidth = (snap: Snapshot) => BAR_WIDTH + totalText(snap).length

// Scrolling: the top 3, moving. Still: the top 2, or the top 1 when two don't fit.
const legendFor = (snap: Snapshot, colors: string[], isMoving: boolean, at: number) => {
  const width = legendWidth(snap)
  if (isMoving) return marquee(legendStrip(snap.segments, colors), at, width)
  const two = legendStrip(snap.segments, colors, 2)
  return marquee(scrolls(two, width) ? legendStrip(snap.segments, colors, 1) : two, 0, width)
}

const refresh = async ($: EngineInterface) => {
  const usage = await $.session.usage({ breakdown: 'summary' })
  const b = usage.context.breakdown
  await update($, snapshot, () => (b ? toSnapshot(b) : null))
}

// Moves the legend one cell along, only while it is shown and too wide to fit.
const step = async ($: EngineInterface) => {
  if (!(await read($, isOn)) || !(await read($, isScrolling))) return
  const snap = await read($, snapshot)
  if (!snap || !scrolls(legendStrip(snap.segments, paint(snap.segments)), legendWidth(snap))) return
  await update($, offset, n => (n + 1) % 1_000_000)
}

export const register: Register = on => {
  let timer: Timer | undefined

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'context-bar',
      description: 'Toggle the context window bar above the prompt; `scroll` toggles the moving legend',
      argumentHint: '[scroll]',
    })
    const saved = await $.store.get('isScrolling')
    if (typeof saved === 'boolean') await update($, isScrolling, () => saved)
    if (await read($, isOn)) void refresh($).catch(() => {})
    timer?.cancel()
    timer = $.clock.every(SCROLL_MS, () => void step($).catch(() => {}))

    return next(e)
  })

  on('command.run', { command: 'context-bar' }, async ($, e) => {
    if (e.args.trim() === 'scroll') {
      const moving = !(await read($, isScrolling))
      await update($, isScrolling, () => moving)
      await $.store.set('isScrolling', moving)

      return { text: moving ? 'Legend scrolling: top 3 drivers.' : 'Legend still: top 2 drivers.' }
    }

    const now = !(await read($, isOn))
    await update($, isOn, () => now)
    if (now) await refresh($).catch(() => {})

    return { text: now ? 'Context bar on.' : 'Context bar off.' }
  })

  on('session.measure', async ($, e, next) => {
    if (await read($, isOn)) await refresh($).catch(() => {})

    return next(e)
  })

  on('session.compact', async ($, e, next) => {
    const done = await next(e)
    void read($, isOn)
      .then(shown => (shown ? refresh($) : undefined))
      .catch(() => {})

    return done
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // Another plugin's band (usage-bar, say) is drawn on the bar's right.
    const beside = await next(e)
    if (e.props.hasSurvey || !(await read($, isOn))) return beside
    const snap: Snapshot | null = await read($, snapshot)
    if (!snap || snap.segments.length === 0) return beside

    const { Box, Text } = $.ui.resolve(e)
    const cells = allocate(snap.segments, BAR_WIDTH)
    const colors = paint(snap.segments)
    const total = totalText(snap)
    const legend = legendFor(snap, colors, await read($, isScrolling), await read($, offset))

    return (
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        <Box key="context" flexDirection="column" borderStyle="round" borderDimColor paddingX={1} alignSelf="flex-start">
          <Box key="bar">
            {snap.segments.map((s, i) => (
              <Text key={`seg-${i}`} color={colors[i]}>
                {(s.kind === 'used' ? '━' : '─').repeat(cells[i]!)}
              </Text>
            ))}
            <Text key="total" dimColor>
              {total}
            </Text>
          </Box>
          <Box key="legend">
            {legend.map((r, i) =>
              r.color ? (
                <Text key={`run-${i}`} color={r.color}>
                  {r.text}
                </Text>
              ) : (
                <Text key={`run-${i}`} dimColor>
                  {r.text}
                </Text>
              ),
            )}
          </Box>
        </Box>
        {beside}
      </Box>
    )
  })
}
