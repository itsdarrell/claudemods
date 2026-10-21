import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Snapshot } from '../types'
import { allocate, fitLegend, formatTokens, paint, toSnapshot } from './bar'

const isOn = atom({ plugin: 'context-bar', key: 'isOn' } as const, true)
const snapshot = atom({ plugin: 'context-bar', key: 'snapshot' } as const, null)

const refresh = async ($: EngineInterface) => {
  const usage = await $.session.usage({ breakdown: 'summary' })
  const b = usage.context.breakdown
  await update($, snapshot, () => (b ? toSnapshot(b) : null))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'context-bar',
      description: 'Toggle the context window bar above the prompt',
    })
    if (await read($, isOn)) void refresh($).catch(() => {})

    return next(e)
  })

  on('command.run', { command: 'context-bar' }, async $ => {
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
    if (e.props.hasSurvey || !(await read($, isOn))) return next(e)
    const snap: Snapshot | null = await read($, snapshot)
    if (!snap || snap.segments.length === 0) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const columns = e.props.bodyColumns ?? e.viewport?.columns ?? 80
    const width = Math.max(10, Math.min(40, columns - 28))
    const cells = allocate(snap.segments, width)
    const colors = paint(snap.segments)

    const legend = fitLegend(snap.segments, columns - 10)

    return (
      <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1} alignSelf="flex-start">
        <Box key="bar">
          {snap.segments.map((s, i) => (
            <Text key={`seg-${i}`} color={colors[i]}>
              {(s.kind === 'used' ? '━' : '─').repeat(cells[i]!)}
            </Text>
          ))}
          <Text key="total" dimColor>
            {` ${snap.percentage}% · ${formatTokens(snap.totalTokens)}/${formatTokens(snap.maxTokens)}`}
          </Text>
        </Box>
        <Box key="legend">
          {legend.map(({ i, text }) => (
            <Box key={`leg-${i}`} marginRight={1}>
              <Text color={colors[i]}>● </Text>
              <Text dimColor>{text}</Text>
            </Box>
          ))}
        </Box>
      </Box>
    )
  })
}
